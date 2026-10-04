import { tokenWeiToUsd, toEngineConfig, usdToTokenWei } from "@/lib/bot/configUnits";
import { DEFAULT_BOT_CONFIG, dexLabel } from "@/lib/bot/constants";
import { nativeUsdPrice } from "@/lib/bot/bnbQuote";
import { resolveFlashLoanFeePct, scanPoolFeePctFromBps } from "@/lib/bot/flashLoanProviders";
import {
  bestFlashloanForTradingChain,
  feePpmToBps,
  feePpmToPct,
  flashloanExecutionBlock,
} from "@/src/flashloan/globalProviderSelector";
import { estimateTwoDexFlashArb } from "@/lib/bot/profitEngine";
import { optimalFlashloanSize } from "@/src/engine/dynamicSizing";
import { dexIsConcentrated } from "@/lib/bot/dexRegistry";
import { liveSpotPrice, poolLiquidityUsd, quoteTokenUsd, spotSpreadBps } from "@/lib/bot/pricing";
import {
  BOT_MODE,
  MAX_ALLOWABLE_SPREAD_PCT,
  MAX_PRICE_IMPACT_PCT,
  MIN_NET_PROFIT_USD,
} from "@/lib/scanOnly/config.js";
import { formatScanOnlyMatrix } from "@/lib/scanOnly/matrix";
import { defaultBotMode } from "@/lib/scanOnly/mode";
import { formatScanOnlyRoute, scanOnlyDexIdsForChain, scanOnlyTargetsForChain } from "@/lib/scanOnly/targets";
import type { ScanEligibility, ScanOnlyReport, ScanOnlyRow } from "@/lib/scanOnly/types";
import { clampMaxPriceImpactPct, clampMaxSpotSpreadPct, reservePriceImpactPct } from "@/lib/bot/poolSafety";
import { resolveDynamicBribePercent } from "@/lib/bot/dynamicBribe";
import { fetchDexPoolsBatch, poolKey, type LivePool } from "@/lib/bot/reserves";
import { getBlockNumber, getGasPriceWei } from "@/lib/bot/rpc";
import { nativeSymbolForChain } from "@/lib/bot/signerBalances";
import { getAmountOut } from "@/lib/bot/dexMath";
import type { BotConfig } from "@/lib/bot/types";
import { getPair, onChainTokensForPair } from "@/lib/chain/tokenPairs";
import { normalizeTradingChainId } from "@/config/networks";
import type { ChainId } from "@/lib/chain/networks";
import { hydrateChainQuotaFromDisk } from "@/lib/owner/chainQuotaPersist";
import { hardAdoptScanChain } from "@/lib/bot/scanRuntime";

function midQuoteUsd(pools: Map<string, LivePool>, pairPrefix: string): number {
  const prices: number[] = [];
  for (const [key, pool] of pools) {
    if (!key.startsWith(`${pairPrefix}:`)) continue;
    const price = liveSpotPrice(pool);
    if (price > 0) prices.push(price);
  }
  if (prices.length === 0) return 0;
  return prices.reduce((sum, value) => sum + value, 0) / prices.length;
}

function nativeGasCostUsd(gasPriceWei: bigint, gasLimit: bigint, nativeUsd: number): number {
  if (nativeUsd <= 0 || gasPriceWei <= 0n || gasLimit <= 0n) return 0;
  const native = Number(gasPriceWei * gasLimit) / 1e18;
  const usd = native * nativeUsd;
  return Number.isFinite(usd) && usd > 0 ? usd : 0;
}

function poolTvl(pool: LivePool | undefined, quoteUsd: number): number {
  if (!pool || pool.tvlReliable === false) return 0;
  return poolLiquidityUsd(pool.reserveQuote, pool.reserveBase, pool.quoteDecimals, pool.baseDecimals, quoteUsd);
}

function emptyPnl() {
  return {
    maxSafeLoanUsd: 0,
    priceImpactPct: 0,
    spreadBps: 0,
    grossUsd: 0,
    dexFeeUsd: 0,
    flashFeeUsd: 0,
    bribeUsd: 0,
    netUsd: 0,
  };
}

function classifyEligibility(input: {
  skipLabel?: string;
  skipReason?: string;
  netUsd: number;
  maxSafeLoanUsd: number;
}): { status: ScanEligibility; statusLabel: string; reason?: string } {
  if (input.skipLabel) {
    return { status: "skip", statusLabel: input.skipLabel, reason: input.skipReason };
  }
  if (!(input.maxSafeLoanUsd > 0)) {
    return { status: "skip", statusLabel: "❌ Skip", reason: "Max Safe Loan = 0" };
  }
  if (input.netUsd >= MIN_NET_PROFIT_USD) {
    return { status: "layak", statusLabel: "✅ Layak Eksekusi" };
  }
  if (input.netUsd > 0) {
    return { status: "tipis", statusLabel: "⚠️ Tipis / Rawan" };
  }
  return { status: "skip", statusLabel: "❌ Skip", reason: "Est. net ≤ 0 setelah fee + gas + bribe" };
}

function quoteUsdForSymbol(symbol: string, ethUsd: number, nativeUsd: number): number {
  const key = symbol.toUpperCase();
  if (key.includes("USD")) return 1;
  const fromTable = quoteTokenUsd(symbol, ethUsd, nativeUsd);
  return fromTable > 0 ? fromTable : nativeUsd > 0 ? nativeUsd : 1;
}

export async function runScanOnlyAnalysis(input: {
  chainId: string;
  config?: Partial<BotConfig>;
}): Promise<ScanOnlyReport> {
  const chainId = normalizeTradingChainId(input.chainId) as ChainId;
  hydrateChainQuotaFromDisk();
  hardAdoptScanChain(chainId, "scan-only");
  const config: BotConfig = { ...DEFAULT_BOT_CONFIG, ...input.config, chainId };
  const engine = toEngineConfig(config);
  const minSpreadPct = Number.isFinite(config.minSpreadPct) && config.minSpreadPct > 0 ? config.minSpreadPct : 0.5;
  const maxSpotSpreadPct = clampMaxSpotSpreadPct(
    config.maxSpotSpreadPct ?? MAX_ALLOWABLE_SPREAD_PCT
  );
  const maxImpactPct = clampMaxPriceImpactPct(config.maxPriceImpactPct ?? MAX_PRICE_IMPACT_PCT);
  const bribePct = resolveDynamicBribePercent(config);
  const targets = scanOnlyTargetsForChain(chainId);
  const dexIds = scanOnlyDexIdsForChain(chainId);
  const blocked = flashloanExecutionBlock(chainId);
  if (blocked) {
    const rows: ScanOnlyRow[] = targets.map((target) => ({
      no: target.no,
      pairId: target.pairId,
      pair: target.pairLabel,
      route: formatScanOnlyRoute(target.dexA, target.dexB),
      dexA: target.dexA,
      dexB: target.dexB,
      poolTvlUsd: 0,
      maxSafeLoanUsd: 0,
      priceImpactPct: 0,
      spreadBps: 0,
      grossUsd: 0,
      dexFeeUsd: 0,
      flashFeeUsd: 0,
      bribeUsd: 0,
      gasUsd: 0,
      netUsd: 0,
      status: "skip",
      statusLabel: "❌ Skip",
      reason: blocked,
    }));
    return {
      botMode: defaultBotMode(),
      chainId,
      blockNumber: 0,
      gasPriceWei: "0",
      maxPriceImpactPct: maxImpactPct,
      minSpreadPct,
      maxSpotSpreadPct,
      bribePct,
      minNetProfitUsd: MIN_NET_PROFIT_USD,
      scannedAt: new Date().toISOString(),
      rows,
      matrix: formatScanOnlyMatrix(rows, 0),
      layakCount: 0,
      tipisCount: 0,
      skipCount: rows.length,
      bestNetUsd: 0,
    };
  }
  const tokens = targets
    .map((target) => {
      const pair = getPair(chainId, target.pairId);
      return pair ? onChainTokensForPair(pair) : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const gasUsdPair =
    chainId === "polygon"
      ? "wmatic-usdc-pol"
      : chainId === "bsc"
        ? "wbnb-usdt"
        : chainId === "avalanche"
          ? "wavax-usdce"
          : chainId === "fantom"
            ? "wftm-usdc"
            : null;
  const ethUsdPair =
    chainId === "polygon"
      ? "weth-usdc-pol"
      : chainId === "ethereum"
        ? "weth-usdc-eth"
        : chainId === "arbitrum"
          ? "weth-usdc-arb"
          : chainId === "optimism"
            ? "weth-usdc-op"
            : chainId === "base"
              ? "weth-usdc-base"
              : null;

  const extra = [...tokens];
  for (const pid of [gasUsdPair, ethUsdPair]) {
    if (!pid || extra.some((item) => item.pairId === pid)) continue;
    const pair = getPair(chainId, pid);
    const tok = pair ? onChainTokensForPair(pair) : null;
    if (tok) extra.push(tok);
  }

  const [gasPrice, block, pools] = await Promise.all([
    getGasPriceWei(undefined, chainId).catch(() => 0n),
    getBlockNumber(undefined, chainId).catch(() => 0),
    tokens.length && dexIds.length
      ? fetchDexPoolsBatch(dexIds, extra, chainId).catch(() => new Map<string, LivePool>())
      : Promise.resolve(new Map<string, LivePool>()),
  ]);

  const nativeUsdLive = gasUsdPair ? midQuoteUsd(pools, gasUsdPair) : 0;
  const nativeUsd =
    nativeUsdLive > 0 ? nativeUsdLive : nativeUsdPrice(nativeSymbolForChain(chainId));
  const ethUsd = ethUsdPair ? midQuoteUsd(pools, ethUsdPair) || nativeUsd : nativeUsd;
  const gasUsd = nativeGasCostUsd(gasPrice, BigInt(engine.gasLimit), nativeUsd);
  const bestFlash = bestFlashloanForTradingChain(chainId);
  const flash = bestFlash
    ? { feePct: feePpmToPct(bestFlash.feePpm) }
    : resolveFlashLoanFeePct(config.flashLoanPlatforms, config.flashLoanProvider, {
        aaveFeePct: config.aaveFeePct,
      });

  const rows: ScanOnlyRow[] = targets.map((target) => {
    const buyPool = pools.get(poolKey(target.pairId, target.dexA));
    const sellPool = pools.get(poolKey(target.pairId, target.dexB));
    const route = formatScanOnlyRoute(target.dexA, target.dexB);
    const quoteUsd = quoteUsdForSymbol(target.quoteSymbol, ethUsd, nativeUsd);
    const buyTvl = poolTvl(buyPool, quoteUsd);
    const sellTvl = poolTvl(sellPool, quoteUsd);
    const poolTvlUsd = Math.min(buyTvl || Infinity, sellTvl || Infinity);
    const tvl = Number.isFinite(poolTvlUsd) ? poolTvlUsd : 0;

    if (!buyPool || !sellPool || buyPool.reserveQuote <= 0n || sellPool.reserveBase <= 0n) {
      const gate = classifyEligibility({
        skipLabel: "❌ Skip",
        skipReason: `Cadangan ${dexLabel(target.dexA)} / ${dexLabel(target.dexB)} belum terbaca`,
        netUsd: 0,
        maxSafeLoanUsd: 0,
      });
      return {
        no: target.no,
        pairId: target.pairId,
        pair: target.pairLabel,
        route,
        dexA: target.dexA,
        dexB: target.dexB,
        poolTvlUsd: tvl,
        ...emptyPnl(),
        gasUsd,
        ...gate,
      };
    }

    const priceA = liveSpotPrice(buyPool);
    const priceB = liveSpotPrice(sellPool);
    const spreadBps = spotSpreadBps(priceA, priceB);
    const spreadPct = spreadBps / 100;

    if (!(spreadBps > 0) || spreadPct + 1e-12 < minSpreadPct) {
      const gate = classifyEligibility({
        skipLabel: "❌ Skip",
        skipReason: `Spread ${spreadPct.toFixed(3)}% < minimum ${minSpreadPct.toFixed(2)}%`,
        netUsd: 0,
        maxSafeLoanUsd: 0,
      });
      return {
        no: target.no,
        pairId: target.pairId,
        pair: target.pairLabel,
        route,
        dexA: target.dexA,
        dexB: target.dexB,
        poolTvlUsd: tvl,
        ...emptyPnl(),
        spreadBps,
        gasUsd,
        ...gate,
        statusLabel: "❌ Skip",
        reason: gate.reason,
      };
    }

    if (spreadPct - 1e-12 > maxSpotSpreadPct) {
      const gate = classifyEligibility({
        skipLabel: "❌ Skip (Glitch/Spread Tidak Wajar)",
        skipReason: `Spread ${spreadPct.toFixed(2)}% > max wajar ${maxSpotSpreadPct.toFixed(1)}% (anomali V3/V2)`,
        netUsd: 0,
        maxSafeLoanUsd: 0,
      });
      return {
        no: target.no,
        pairId: target.pairId,
        pair: target.pairLabel,
        route,
        dexA: target.dexA,
        dexB: target.dexB,
        poolTvlUsd: tvl,
        ...emptyPnl(),
        spreadBps,
        gasUsd,
        ...gate,
      };
    }

    const dynamicSize = optimalFlashloanSize({
      buyReserveQuote: buyPool.reserveQuote,
      sellReserveQuote: sellPool.reserveQuote,
      buyTvlUsd: buyTvl,
      sellTvlUsd: sellTvl,
      quoteDecimals: target.quoteDecimals,
      quoteUsd,
      concentrated: dexIsConcentrated(target.dexA) || dexIsConcentrated(target.dexB),
    });
    const amountIn = dynamicSize.amountInWei;

    const bought = getAmountOut(amountIn, buyPool.reserveQuote, buyPool.reserveBase, buyPool.feeBps);
    const buyImpact = reservePriceImpactPct(amountIn, buyPool.reserveQuote);
    const sellImpact = reservePriceImpactPct(bought > 0n ? bought : amountIn, sellPool.reserveBase);
    const priceImpactPct = Math.max(buyImpact, sellImpact);
    const maxSafeLoanUsd = tokenWeiToUsd(amountIn, target.quoteDecimals, quoteUsd);

    if (amountIn <= 0n) {
      const gate = classifyEligibility({
        skipLabel: "❌ Skip",
        skipReason: "Likuiditas pool tidak cukup untuk ukuran flashloan 2%/3%",
        netUsd: 0,
        maxSafeLoanUsd,
      });
      return {
        no: target.no,
        pairId: target.pairId,
        pair: target.pairLabel,
        route,
        dexA: target.dexA,
        dexB: target.dexB,
        poolTvlUsd: tvl,
        ...emptyPnl(),
        maxSafeLoanUsd,
        priceImpactPct,
        spreadBps,
        gasUsd,
        ...gate,
      };
    }

    const gasCostQuoteWei = BigInt(usdToTokenWei(gasUsd, target.quoteDecimals, quoteUsd));
    const routedFlash = bestFlashloanForTradingChain(chainId, {
      poolFee: buyPool.v3Fee,
      poolFeePct: scanPoolFeePctFromBps(buyPool.feeBps),
    });
    const routeEngine = {
      ...engine,
      flashFeePpm: routedFlash?.feePpm ?? engine.flashFeePpm,
      aaveFeeBps: routedFlash ? feePpmToBps(routedFlash.feePpm) : engine.aaveFeeBps,
    };
    const routeFlashPct = routedFlash ? feePpmToPct(routedFlash.feePpm) : flash.feePct;
    const result = estimateTwoDexFlashArb({
      amountIn,
      dynamicSize,
      buy: {
        reserveIn: buyPool.reserveQuote,
        reserveOut: buyPool.reserveBase,
        feeBps: buyPool.feeBps,
      },
      sell: {
        reserveIn: sellPool.reserveBase,
        reserveOut: sellPool.reserveQuote,
        feeBps: sellPool.feeBps,
      },
      gasPriceWei: gasPrice,
      gasLimit: BigInt(engine.gasLimit),
      config: routeEngine,
      spotSpreadBps: spreadBps,
      gasCostQuoteWei,
      useSpotFill: true,
    });

    const grossUsd = tokenWeiToUsd(result.grossProfit, target.quoteDecimals, quoteUsd);
    const buyFeePct = scanPoolFeePctFromBps(buyPool.feeBps);
    const sellFeePct = scanPoolFeePctFromBps(sellPool.feeBps);
    const dexFeeUsd =
      maxSafeLoanUsd * (buyFeePct / 100) + Math.max(0, maxSafeLoanUsd + grossUsd) * (sellFeePct / 100);
    const flashFeeUsd = maxSafeLoanUsd * (routeFlashPct / 100);
    const bribeUsd = Math.max(0, grossUsd) * (bribePct / 100);
    const netUsd = grossUsd - dexFeeUsd - flashFeeUsd - gasUsd - bribeUsd;
    const gate = classifyEligibility({ netUsd, maxSafeLoanUsd });

    return {
      no: target.no,
      pairId: target.pairId,
      pair: target.pairLabel,
      route,
      dexA: target.dexA,
      dexB: target.dexB,
      poolTvlUsd: tvl,
      maxSafeLoanUsd,
      priceImpactPct,
      spreadBps,
      grossUsd: Math.max(0, grossUsd),
      dexFeeUsd: Math.max(0, dexFeeUsd),
      flashFeeUsd: Math.max(0, flashFeeUsd),
      bribeUsd,
      gasUsd,
      netUsd,
      ...gate,
    };
  });

  const layakCount = rows.filter((row) => row.status === "layak").length;
  const tipisCount = rows.filter((row) => row.status === "tipis").length;
  const skipCount = rows.filter((row) => row.status === "skip").length;
  const bestNetUsd = rows
    .filter((row) => row.status === "layak" || row.status === "tipis")
    .reduce((max, row) => (row.netUsd > max ? row.netUsd : max), 0);

  return {
    botMode: defaultBotMode(),
    chainId,
    blockNumber: Number(block) || 0,
    gasPriceWei: gasPrice.toString(),
    maxPriceImpactPct: maxImpactPct,
    minSpreadPct,
    maxSpotSpreadPct,
    bribePct,
    minNetProfitUsd: MIN_NET_PROFIT_USD,
    scannedAt: new Date().toISOString(),
    rows,
    matrix: formatScanOnlyMatrix(rows, Number(block) || 0),
    layakCount,
    tipisCount,
    skipCount,
    bestNetUsd,
  };
}

export { BOT_MODE, MAX_PRICE_IMPACT_PCT, MIN_NET_PROFIT_USD };
