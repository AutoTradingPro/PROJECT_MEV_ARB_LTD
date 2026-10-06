import { minProfitWeiFromLoan } from "./dynamicSlippage";
import {
  clampMinPoolLiquidityUsd,
  evaluatePoolRouteSafety,
  livePoolLiquidityUsd,
  pairKnownBelowMinLiquidity,
  pairMeetsMinLiquidityForScan,
} from "./poolSafety";
import { toEngineConfig, tokenWeiToUsd, usdToTokenWei } from "./configUnits";
import { directedDexRoutes } from "./dexDirections";
import { orderOpportunitiesByPairList } from "./opportunityOrder";
import { isExtremeSpotSpread, liveSpotPrice, quoteTokenUsd, spotSpreadBps } from "./pricing";
import { estimateTwoDexFlashArb } from "./profitEngine";
import { optimalFlashloanSize } from "@/src/engine/dynamicSizing";
import { fetchDexPoolsBatch, poolKey, type LivePool } from "./reserves";
import { getBlockNumber, getGasPriceWei, peekMemoizedGasWei, rpcUrl } from "./rpc";
import {
  explainAutoExecuteSkip,
  featuredScanRoute,
  formatAutoExecuteQueueLine,
  formatAutoSignalSkipLine,
  formatAutoSpreadWaitLine,
  formatMonadScanCycle,
  formatRuntimeScanLine,
  orderAutoExecuteQueue,
  scanPairHighlights,
  minSpreadBpsFromConfig,
  noteAutoSpreadWaitPeak,
  pickLiveGasWei,
  readyOpportunityCount,
  spreadMeetsMinimum,
  takeAutoSpreadWaitPeakIfDue,
} from "./autoExecute";
import { flashLoanProviderLabel, resolveFlashLoanFeePct, scanPoolFeePctFromBps } from "./flashLoanProviders";
import {
  bestFlashloanForTradingChain,
  feePpmToBps,
  feePpmToPct,
  flashloanExecutionBlock,
} from "@/src/flashloan/globalProviderSelector";
import { logSkipProfitBreakdown } from "./skipProfitBreakdown";
import { fetchSignerLiveBalances, logLowNativeGasIfNeeded, nativeSymbolForChain, type SignerLiveBalances, peekScanSignerBalances, rememberScanSignerBalances } from "./signerBalances";
import { recordHeartbeatScan } from "@/lib/bot/heartbeat";
import { formatAutonomousSignerLine } from "@/lib/bot/privateSigner";
import { patchBotState, readBotState } from "./store";
import { appendServerLog } from "./serverLog";
import { publishFeedFromOpportunities } from "./liveHub";
import type { DexId, Opportunity } from "./types";
import { detectUniswapV3PoolFeePct } from "./uniswapV3Fee";
import { getChain, type ChainId } from "@/lib/chain/networks";
import { defaultPairForChain, getPair, onChainTokensForPair, type OnChainPairTokens, type TokenPairConfig } from "@/lib/chain/tokenPairs";
import { normalizeTradingChainId } from "@/config/networks";
import { stringifyUnknownError } from "@/lib/wallet/rpcError";
import {
  DEFAULT_BOT_CONFIG,
  AUTO_EXECUTE,
  MAX_SPOT_SPREAD_BPS,
  dexIsConcentrated,
  dexLabel,
  scanPlanForChain,
} from "./constants";
import { isScanRpcAllowed } from "@/lib/owner/chainQuota";
import { hydrateChainQuotaFromDisk } from "@/lib/owner/chainQuotaPersist";
import {
  ScanRuntimeAbortError,
  assertScanLive,
  beginScanCycle,
  isForeignScanChain,
  isScanLive,
  onScanRuntimeReset,
} from "./scanRuntime";

function nativeGasCostUsd(gasPriceWei: bigint, gasLimit: bigint, nativeUsd: number): number {
  if (nativeUsd <= 0 || gasPriceWei <= 0n || gasLimit <= 0n) return 0;
  const native = Number(gasPriceWei * gasLimit) / 1e18;
  const usd = native * nativeUsd;
  return Number.isFinite(usd) && usd > 0 ? usd : 0;
}

let lastSignerBanner = "";
/**
 * Early-filter cache: pair yang TVL-nya jelas di bawah Min Pool Liquidity
 * di-skip sebelum fetchDexPoolsBatch / kalkulasi spread (hemat RPC + log bersih).
 */
const thinPairSkipUntil = new Map<string, number>();
const thinPairSkipThreshold = new Map<string, number>();
const THIN_PAIR_SKIP_MS = 90_000;
let lastMinLiqGate = -1;

function thinPairKey(chainId: ChainId, pairId: string): string {
  return `${chainId}:${pairId}`;
}

function clearThinPairGate(): void {
  thinPairSkipUntil.clear();
  thinPairSkipThreshold.clear();
}

function markThinPair(chainId: ChainId, pairId: string, minLiqUsd: number): void {
  const key = thinPairKey(chainId, pairId);
  thinPairSkipUntil.set(key, Date.now() + THIN_PAIR_SKIP_MS);
  thinPairSkipThreshold.set(key, minLiqUsd);
}

function shouldSkipThinPair(chainId: ChainId, pairId: string, minLiqUsd: number): boolean {
  if (minLiqUsd <= 0) return false;
  const key = thinPairKey(chainId, pairId);
  const until = thinPairSkipUntil.get(key) ?? 0;
  if (until <= Date.now()) {
    thinPairSkipUntil.delete(key);
    thinPairSkipThreshold.delete(key);
    return false;
  }
  const cachedThreshold = thinPairSkipThreshold.get(key) ?? 0;
  /** User menurunkan min → pair mungkin lolos; jangan skip. */
  if (minLiqUsd < cachedThreshold) {
    thinPairSkipUntil.delete(key);
    thinPairSkipThreshold.delete(key);
    return false;
  }
  return true;
}

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

function hasSpotPrice(pool: LivePool | undefined): pool is LivePool {
  if (!pool?.pair || pool.reserveBase <= 0n || pool.reserveQuote <= 0n) return false;
  return liveSpotPrice(pool) > 0;
}

function scanSinglePair(input: {
  pair: TokenPairConfig;
  tokens: OnChainPairTokens;
  chainId: ChainId;
  active: DexId[];
  pools: Map<string, LivePool>;
  engine: ReturnType<typeof toEngineConfig>;
  gasPrice: bigint;
  minProfitUsd: number;
  quoteUsd: number;
  gasUsd: number;
  minerTipPct: number;
  aaveFeePct: number;
  minPoolLiquidityUsd: number;
  maxPriceImpactPct: number;
  uniswapPoolFeePct?: number;
  detectedBlock?: number;
}): Opportunity[] {
  const { pair, tokens, chainId, active, pools, engine, gasPrice } = input;
  const quoteDecimals = tokens.quoteDecimals;
  const quoteUsd = input.quoteUsd > 0 ? input.quoteUsd : 1;
  const found: Opportunity[] = [];

  for (const { buyDex, sellDex } of directedDexRoutes(active)) {
      const buyPool = pools.get(poolKey(pair.id, buyDex));
      const sellPool = pools.get(poolKey(pair.id, sellDex));
      if (!hasSpotPrice(buyPool) || !hasSpotPrice(sellPool)) continue;

      /** Early filter global: skip sebelum spread / profit (tidak log, tidak kalkulasi). */
      const minLiq = clampMinPoolLiquidityUsd(input.minPoolLiquidityUsd);
      const buyLiq = livePoolLiquidityUsd(buyPool, quoteUsd);
      const sellLiq = livePoolLiquidityUsd(sellPool, quoteUsd);
      const routeLiq = Math.min(buyLiq, sellLiq);
      if (minLiq > 0 && routeLiq > 0 && routeLiq < minLiq) {
        continue;
      }

      const priceDexAUsd = liveSpotPrice(buyPool);
      const priceDexBUsd = liveSpotPrice(sellPool);
      const spreadBps = spotSpreadBps(priceDexAUsd, priceDexBUsd);
      if (isExtremeSpotSpread(spreadBps, MAX_SPOT_SPREAD_BPS)) continue;

      const concentrated = dexIsConcentrated(buyDex) || dexIsConcentrated(sellDex);
      const dynamicSize = optimalFlashloanSize({
        buyReserveQuote: buyPool.reserveQuote,
        sellReserveQuote: sellPool.reserveQuote,
        buyTvlUsd: buyLiq,
        sellTvlUsd: sellLiq,
        quoteDecimals,
        quoteUsd,
        concentrated,
      });
      const amountIn = dynamicSize.amountInWei;
      if (amountIn <= 0n) continue;

      const poolCheck = evaluatePoolRouteSafety({
        buyPool,
        sellPool,
        amountIn,
        quoteUsd,
        minPoolLiquidityUsd: input.minPoolLiquidityUsd,
        maxPriceImpactPct: input.maxPriceImpactPct,
      });
      if (!poolCheck.ok) continue;

      const gasCostQuoteWei = BigInt(usdToTokenWei(input.gasUsd, quoteDecimals, quoteUsd));
      const routedFlash = bestFlashloanForTradingChain(chainId, {
        poolFee: buyPool.v3Fee,
        poolFeePct: scanPoolFeePctFromBps(buyPool.feeBps),
      });
      const pairEngine = {
        ...engine,
        minProfitWei: minProfitWeiFromLoan(amountIn).toString(),
        flashFeePpm: routedFlash?.feePpm ?? engine.flashFeePpm,
        aaveFeeBps: routedFlash ? feePpmToBps(routedFlash.feePpm) : engine.aaveFeeBps,
      };
      const result = estimateTwoDexFlashArb({
        amountIn,
        dynamicSize,
        buy: {
          reserveIn: buyPool.reserveQuote,
          reserveOut: buyPool.reserveBase,
          feeBps: buyPool.feeBps,
          v3: buyPool.v3Quote,
          zeroForOne: buyPool.quoteIsToken0,
        },
        sell: {
          reserveIn: sellPool.reserveBase,
          reserveOut: sellPool.reserveQuote,
          feeBps: sellPool.feeBps,
          v3: sellPool.v3Quote,
          zeroForOne: !sellPool.quoteIsToken0,
        },
        gasPriceWei: gasPrice,
        gasLimit: BigInt(engine.gasLimit),
        config: pairEngine,
        spotSpreadBps: spreadBps,
        gasCostQuoteWei,
        useSpotFill: true,
      });

      const netProfit = result.netProfit;
      const grossProfit = result.grossProfit;
      const loanUsdActual = tokenWeiToUsd(amountIn, quoteDecimals, quoteUsd);
      const ready = result.profitable;
      const grossForBribeUsd = loanUsdActual * (spreadBps / 10_000);
      const bribeUsd = Math.max(0, grossForBribeUsd) * ((Number.isFinite(input.minerTipPct) ? input.minerTipPct : 0) / 100);
      found.push({
        id: `${pair.id}-${buyDex}-${sellDex}`,
        tokenPair: pair.label,
        tokenIn: pair.quoteSymbol,
        tokenOut: pair.baseSymbol,
        buyDex,
        sellDex,
        buyExchange: dexLabel(buyDex) || buyDex,
        sellExchange: dexLabel(sellDex) || sellDex,
        dexAName: dexLabel(buyDex) || buyDex,
        dexBName: dexLabel(sellDex) || sellDex,
        priceDexAUsd,
        priceDexBUsd,
        amountInWei: amountIn.toString(),
        amountOutWei: (result.amountOut > 0n ? result.amountOut : result.repay + netProfit).toString(),
        repayWei: result.repay.toString(),
        spreadBps,
        estimatedProfitWei: grossProfit.toString(),
        gasCostWei: result.gasCost.toString(),
        netProfitWei: netProfit.toString(),
        flashPair: buyPool.pair,
        amount0Out: buyPool.quoteIsToken0 ? amountIn.toString() : "0",
        amount1Out: buyPool.quoteIsToken0 ? "0" : amountIn.toString(),
        live: true,
        pairId: pair.id,
        chainId,
        quoteDecimals,
        quoteUsd,
        status: ready ? "ready" : "rejected",
        detectedBlock: input.detectedBlock,
        reason: ready ? undefined : result.rejectReason,
        scanPoolFeePct: scanPoolFeePctFromBps(buyPool.feeBps),
        uniswapPoolFeePct: input.uniswapPoolFeePct,
        buyPoolFee: buyPool.v3Fee,
        sellPoolFee: sellPool.v3Fee,
        poolLiquidityUsd: poolCheck.poolLiquidityUsd,
        buyLiquidityUsd: poolCheck.buyLiquidityUsd,
        sellLiquidityUsd: poolCheck.sellLiquidityUsd,
        priceImpactPct: poolCheck.priceImpactPct,
        bribeUsd,
      });
  }

  return found;
}

export interface ScanOptions {
  /** Daftar pair id yang akan dipindai; default dari config.scanMode / pairId */
  pairIds?: string[];
  scanMode?: "single" | "full";
  /**
   * Cadangan sudah ada di RAM (log Sync/Swap).
   * Scan tidak memanggil getReserves, slot0, atau getAmountsOut.
   */
  eventDriven?: boolean;
  /** Rantai milik snapshot RAM. Dipakai agar scan event tidak pindah ke chainId di config. */
  chainId?: ChainId;
  localPools?: Map<string, LivePool>;
  blockNumber?: number;
  gasPriceWei?: bigint;
}

function resolveScanPairIds(
  catalog: { id: string }[],
  config: { pairId?: string; scanMode?: "single" | "full" },
  options?: ScanOptions
): string[] {
  const mode = options?.scanMode === "full" || options?.scanMode === "single"
    ? options.scanMode
    : config.scanMode === "full"
      ? "full"
      : "single";
  if (mode === "full") {
    return catalog.map((item) => item.id);
  }
  const requested =
    options?.pairIds?.length && options.pairIds.length > 0
      ? options.pairIds
      : config.pairId
        ? [config.pairId]
        : [];
  const scoped = requested.filter((id) => catalog.some((item) => item.id === id));
  if (scoped.length > 0) return scoped;
  if (config.pairId && catalog.some((item) => item.id === config.pairId)) return [config.pairId];
  return catalog[0] ? [catalog[0].id] : [];
}

let lastQueueLogLine = "";
let lastQueueLogAt = 0;
const uniFeeCache = new Map<string, { pct: number; at: number }>();
const UNI_FEE_CACHE_MS = 60_000;
const lastNativeUsd = new Map<string, number>();
let lastPairScopeLog = "";
let lastEventSignature = "";
let lastMonadScanBlock = -1;

function resetScannerLocals(): void {
  lastSignerBanner = "";
  rememberScanSignerBalances(null);
  uniFeeCache.clear();
  lastNativeUsd.clear();
  lastPairScopeLog = "";
  lastEventSignature = "";
  clearThinPairGate();
  lastMinLiqGate = -1;
}

onScanRuntimeReset(resetScannerLocals);

export { peekScanSignerBalances, rememberScanSignerBalances } from "./signerBalances";

export async function scanOpportunities(options?: ScanOptions): Promise<Opportunity[]> {
  hydrateChainQuotaFromDisk();
  const state = await readBotState();
  if (state.killed) {
    await patchBotState((current) => ({
      ...current,
      running: false,
      opportunities: [],
      lastError: undefined,
    }));
    return [];
  }

  const config = { ...DEFAULT_BOT_CONFIG, ...state.config };
  const chainId = options?.chainId
    ? normalizeTradingChainId(options.chainId)
    : normalizeTradingChainId(config.chainId);
  const blocked = flashloanExecutionBlock(chainId);
  if (blocked) {
    const reason = `[SKIP] ${blocked}`;
    appendServerLog(reason);
    console.log(reason);
    await patchBotState((current) => ({
      ...current,
      opportunities: [],
      lastError: reason,
    }));
    return [];
  }
  const engine = toEngineConfig({ ...config, chainId });
  const bestFlash = bestFlashloanForTradingChain(chainId);
  const autoFlashFeePct = bestFlash
    ? feePpmToPct(bestFlash.feePpm)
    : resolveFlashLoanFeePct(config.flashLoanPlatforms, config.flashLoanProvider).feePct;
  const cycle = beginScanCycle(chainId);
  const gen = cycle.generation;
  const plan = scanPlanForChain(chainId, config.activeDexIds);
  const selectedDex = plan.dexIds;
  /** Pair on-chain dari katalog jaringan aktif saja. */
  const catalog = plan.pairs;

  const scanMode: "single" | "full" =
    options?.scanMode === "full" || options?.scanMode === "single"
      ? options.scanMode
      : config.scanMode === "full"
        ? "full"
        : "single";
  const scanPairIds = resolveScanPairIds(catalog, config, { ...options, scanMode });
  const scopeLog = `[SCAN] ${scanMode === "full" ? "Full pair Scan" : "Single aktif"} · ${chainId} · ${
    scanMode === "full" ? `${scanPairIds.length} pair` : scanPairIds[0] || "—"
  } · RPC/WSS hanya pair ini`;
  if (scopeLog !== lastPairScopeLog) {
    lastPairScopeLog = scopeLog;
    if (!isForeignScanChain(chainId)) console.log(scopeLog);
  }

  try {
    const signerLine = formatAutonomousSignerLine(chainId);
    if (signerLine !== lastSignerBanner) {
      lastSignerBanner = signerLine;
      if (!isForeignScanChain(chainId)) console.log(signerLine);
    }
    const canScanOnChain = plan.evm;
    if (isForeignScanChain(chainId)) {
      return [];
    }
    if (!isScanRpcAllowed(chainId)) {
      await patchBotState((current) => ({
        ...current,
        running: true,
        opportunities: [],
        lastError: `Jaringan ${chainId} OFF di Owner Overview — scan RPC ditahan.`,
      }));
      return [];
    }

    // Solana: worker mandiri (Ankr scan + QuickNode exec) — lib/bot/solana
    if (chainId === "solana") {
      const { runSolanaWorker } = await import("@/lib/bot/solana/worker");
      const { opportunities } = await runSolanaWorker({
        config,
        pairIds: scanPairIds,
        persist: true,
      });
      assertScanLive(gen, chainId);
      return opportunities;
    }

    if (!canScanOnChain || !rpcUrl(chainId)) {
      const lastError = !canScanOnChain
        ? `Scan on-chain belum tersedia untuk ${chainId}.`
        : chainId === "polygon"
          ? "RPC polygon belum dikonfigurasi. Isi Primary RPC di Owner Dashboard atau set POLYGON_RPC_URL (or RPC_HTTP_URL_POLYGON) di .env.local."
          : `RPC ${chainId} belum dikonfigurasi.`;
      await patchBotState((current) => ({
        ...current,
        running: true,
        opportunities: [],
        lastError,
      }));
      return [];
    }

    const targets: { pair: TokenPairConfig; tokens: OnChainPairTokens }[] = [];
    const minLiqGate = clampMinPoolLiquidityUsd(config.minPoolLiquidityUsd);
    if (lastMinLiqGate !== minLiqGate) {
      clearThinPairGate();
      lastMinLiqGate = minLiqGate;
    }
    for (const pid of scanPairIds) {
      const pair = getPair(chainId, pid);
      if (!pair) continue;
      const tokens = onChainTokensForPair(pair);
      if (!tokens) continue;
      if (shouldSkipThinPair(chainId, pair.id, minLiqGate)) continue;
      targets.push({ pair, tokens });
    }

    const fetchPairs = [...targets.map((item) => item.tokens)];
    const gasUsdPair = defaultPairForChain(chainId).id;
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
    if (scanMode === "full") {
      if (!fetchPairs.some((item) => item.pairId === gasUsdPair)) {
        const gasPair = getPair(chainId, gasUsdPair);
        const gasTokens = gasPair ? onChainTokensForPair(gasPair) : null;
        if (gasTokens) fetchPairs.push(gasTokens);
      }
      if (ethUsdPair && !fetchPairs.some((item) => item.pairId === ethUsdPair)) {
        const ethPair = getPair(chainId, ethUsdPair);
        const ethTokens = ethPair ? onChainTokensForPair(ethPair) : null;
        if (ethTokens) fetchPairs.push(ethTokens);
      }
    }

    const eventDriven = Boolean(options?.eventDriven && options.localPools);
    let gasPrice: bigint;
    let block: number;
    let livePools: Map<string, LivePool>;
    if (eventDriven && options?.localPools) {
      livePools = options.localPools;
      block = options.blockNumber ?? 0;
      gasPrice =
        options.gasPriceWei && options.gasPriceWei > 0n
          ? options.gasPriceWei
          : peekMemoizedGasWei(chainId);
    } else {
      const [nextGas, nextBlock, nextPools] = await Promise.all([
        getGasPriceWei(undefined, chainId),
        getBlockNumber(undefined, chainId),
        fetchDexPoolsBatch(selectedDex, fetchPairs, chainId),
      ]);
      gasPrice = nextGas;
      block = nextBlock;
      livePools = nextPools;
    }
    assertScanLive(gen, chainId);
    let nativeUsd = midQuoteUsd(livePools, gasUsdPair);
    if (!(nativeUsd > 0)) nativeUsd = lastNativeUsd.get(chainId) ?? 0;
    if (nativeUsd > 0) lastNativeUsd.set(chainId, nativeUsd);
    const ethUsd = ethUsdPair ? midQuoteUsd(livePools, ethUsdPair) || nativeUsd : nativeUsd;
    const gasUsd = nativeGasCostUsd(gasPrice, BigInt(engine.gasLimit), nativeUsd);

    const uniFeeByPair = new Map<string, number>();
    const minLiqUsd = clampMinPoolLiquidityUsd(config.minPoolLiquidityUsd);
    if (
      !eventDriven &&
      (config.flashLoanProvider === "uniswap" || config.flashLoanPlatforms?.uniswap?.enabled)
    ) {
      const now = Date.now();
      await Promise.all(
        targets.map(async ({ pair, tokens }) => {
          const quoteUsd = quoteTokenUsd(pair.quoteSymbol, ethUsd, nativeUsd);
          const spotPools = selectedDex
            .map((id) => livePools.get(poolKey(pair.id, id)))
            .filter((pool): pool is LivePool => hasSpotPrice(pool));
          if (quoteUsd > 0 && !pairMeetsMinLiquidityForScan(spotPools, quoteUsd, minLiqUsd)) {
            return;
          }
          const cacheKey = `${chainId}:${pair.id}`;
          const cached = uniFeeCache.get(cacheKey);
          if (cached && now - cached.at < UNI_FEE_CACHE_MS) {
            uniFeeByPair.set(pair.id, cached.pct);
            return;
          }
          const detected = await detectUniswapV3PoolFeePct({
            chainId,
            tokenA: tokens.baseAddress,
            tokenB: tokens.quoteAddress,
          });
          if (detected != null) {
            uniFeeByPair.set(pair.id, detected);
            uniFeeCache.set(cacheKey, { pct: detected, at: now });
          }
        })
      );
    }
    assertScanLive(gen, chainId);

    const allFound: Opportunity[] = [];
    for (const { pair, tokens } of targets) {
      const validDex = selectedDex.filter((id) => hasSpotPrice(livePools.get(poolKey(pair.id, id))));
      if (validDex.length < 2) continue;
      const quoteUsd = quoteTokenUsd(pair.quoteSymbol, ethUsd, nativeUsd);
      if (!(quoteUsd > 0)) continue;
      const spotPools = validDex
        .map((id) => livePools.get(poolKey(pair.id, id)))
        .filter((pool): pool is LivePool => Boolean(pool));
      if (!pairMeetsMinLiquidityForScan(spotPools, quoteUsd, minLiqUsd)) {
        if (pairKnownBelowMinLiquidity(spotPools, quoteUsd, minLiqUsd)) {
          markThinPair(chainId, pair.id, minLiqUsd);
        }
        continue;
      }
      thinPairSkipUntil.delete(thinPairKey(chainId, pair.id));
      thinPairSkipThreshold.delete(thinPairKey(chainId, pair.id));
      allFound.push(
        ...scanSinglePair({
          pair,
          tokens,
          chainId,
          active: validDex,
          pools: livePools,
          engine,
          gasPrice,
          minProfitUsd: config.minProfitUsd,
          quoteUsd,
          gasUsd,
          minerTipPct: config.minerTipPct,
          aaveFeePct: autoFlashFeePct,
          minPoolLiquidityUsd: minLiqUsd,
          maxPriceImpactPct: config.maxPriceImpactPct,
          uniswapPoolFeePct: uniFeeByPair.get(pair.id),
          detectedBlock: block,
        })
      );
    }

    const ordered = orderOpportunitiesByPairList(
      allFound,
      targets.map((item) => item.pair.id)
    );

    const latest = await readBotState();
    if (!isScanLive(gen, chainId) || normalizeTradingChainId(latest.config.chainId) !== chainId) {
      return [];
    }
    const previousLive = latest.opportunities.filter((item) => item.live && item.chainId === chainId);
    let lastError: string | undefined;
    let nextOpportunities = ordered;

    if (targets.length === 0) {
      lastError = "Pair terpilih tidak memiliki alamat token on-chain.";
      nextOpportunities = [];
    } else if (allFound.length === 0) {
      lastError = `Tidak ada rute ${selectedDex.map(dexLabel).join(" / ")} dengan harga spot valid (|spread| ≤ ${MAX_SPOT_SPREAD_BPS / 100}%).`;
      nextOpportunities = previousLive.filter(
        (item) =>
          scanPairIds.includes(item.pairId) &&
          !isExtremeSpotSpread(item.spreadBps, MAX_SPOT_SPREAD_BPS)
      );
    }

    await patchBotState((current) => {
      if (normalizeTradingChainId(current.config.chainId) !== chainId) return current;
      return {
        ...current,
        running: true,
        config: { ...current.config, scanMode, pairId: current.config.pairId || scanPairIds[0] },
        lastBlock: block > 0 ? block : 0,
        gasPriceWei: pickLiveGasWei(gasPrice.toString(), peekMemoizedGasWei(chainId).toString()),
        opportunities: nextOpportunities.filter(
          (item) => item.chainId === chainId && scanPairIds.includes(item.pairId)
        ),
        lastError,
      };
    });
    publishFeedFromOpportunities(nextOpportunities);

    try {
      recordHeartbeatScan({
        routes: nextOpportunities.length,
        ready: nextOpportunities.filter((item) => item.status === "ready").length,
        block: block > 0 ? block : 0,
        ok: true,
      });
    } catch {
      /* heartbeat tidak boleh menggagalkan scan */
    }

    const pairHighlights = scanPairHighlights(nextOpportunities);
    const minBps = minSpreadBpsFromConfig(config);
    const highlight = pairHighlights[0] ?? featuredScanRoute(nextOpportunities);
    const readyCount = readyOpportunityCount(nextOpportunities);
    const maxSpreadBps = highlight?.spreadBps ?? 0;
    const signerBalances = eventDriven
      ? peekScanSignerBalances()
      : peekScanSignerBalances() ??
        (await fetchSignerLiveBalances({
          chainId,
          quoteSymbol: highlight?.quoteSymbol,
          baseSymbol: highlight?.baseSymbol,
        }));
    rememberScanSignerBalances(signerBalances);
    if (!eventDriven) {
      void fetchSignerLiveBalances({
        chainId,
        quoteSymbol: highlight?.quoteSymbol,
        baseSymbol: highlight?.baseSymbol,
      }).then((fresh) => {
        if (fresh && isScanLive(gen, chainId)) rememberScanSignerBalances(fresh);
      });
    }
    logLowNativeGasIfNeeded(Boolean(signerBalances?.nativeLow), chainId);
    if (!isScanLive(gen, chainId)) return [];
    const gasSymbol = nativeSymbolForChain(chainId);
    const gasBalances =
      signerBalances?.nativeSymbol === gasSymbol ? signerBalances : null;
    if (chainId === "monad" && block !== lastMonadScanBlock) {
      lastMonadScanBlock = block;
      const cycleLine = formatMonadScanCycle({ block, opportunities: nextOpportunities });
      console.log(cycleLine);
      appendServerLog({ level: "scan", source: "MONAD", chainId: "monad", message: cycleLine });
    }
    if (eventDriven) {
      const signature = `${chainId}:${readyCount}:${Math.round(maxSpreadBps)}:${nextOpportunities.length}`;
      if (signature === lastEventSignature) return nextOpportunities;
      lastEventSignature = signature;
    }
    if (readyCount > 0) {
      appendServerLog({
        level: "exec",
        source: "VALIDATED",
        chainId,
        message: `Spread ${(maxSpreadBps / 100).toFixed(2)}% lolos ambang · ${readyCount} rute · ${highlight?.pair || "—"} (${highlight?.dexIn || "DEX"} → ${highlight?.dexOut || "DEX"})`,
      });
    }
    console.log(
      formatRuntimeScanLine({
        sandbox: false,
        block: block > 0 ? block : 0,
        routes: nextOpportunities.length,
        ready: readyCount,
        maxSpreadBps,
        gasPriceWei: pickLiveGasWei(gasPrice.toString(), peekMemoizedGasWei(chainId).toString()),
        provider: bestFlash?.name ?? flashLoanProviderLabel(config.flashLoanProvider),
        pair: highlight?.pair,
        dexIn: highlight?.dexIn,
        dexOut: highlight?.dexOut,
        chainId,
        pairHighlights,
        scannedPairLabels: targets.map((item) => item.pair.label),
        minSpreadBps: minBps,
        minPoolLiquidityUsd: minLiqUsd,
        nativeSymbol: gasSymbol,
        nativeBalance: gasBalances?.nativeFormatted,
        gasLimit: config.gasLimit,
        tokenSymbol: gasBalances?.tokenSymbol,
        tokenBalance: gasBalances?.vaultFormatted ?? gasBalances?.tokenFormatted,
        vaultEth: gasBalances?.vaultEthFormatted,
        vaultUsdc: gasBalances?.vaultUsdcFormatted,
        vaultUsdt: gasBalances?.vaultUsdtFormatted,
      })
    );
    const execQueue = orderAutoExecuteQueue(nextOpportunities, config, {
      lastRotateOppId: latest.lastExecRotateOppId,
    });
    if (execQueue.length > 0) {
      const queueLine = formatAutoExecuteQueueLine(execQueue, config, { chainId });
      const loggedAt = Date.now();
      if (
        queueLine !== lastQueueLogLine ||
        loggedAt - lastQueueLogAt >= AUTO_EXECUTE.signalSkipLogMs
      ) {
        lastQueueLogLine = queueLine;
        lastQueueLogAt = loggedAt;
        console.log(queueLine);
        appendServerLog({ level: "info", source: "QUEUE", chainId, message: queueLine });
      }
    }
    noteAutoSpreadWaitPeak(maxSpreadBps);
    if (spreadMeetsMinimum(maxSpreadBps, minBps) && readyCount === 0) {
      const peak = takeAutoSpreadWaitPeakIfDue(AUTO_EXECUTE.signalSkipLogMs);
      if (peak !== null) {
        const topReject = [...nextOpportunities]
          .filter((item) => item.status !== "ready")
          .sort((a, b) => (b.spreadBps || 0) - (a.spreadBps || 0))[0];
        const skipLine = formatAutoSignalSkipLine({
            maxSpreadBps: Math.max(peak, maxSpreadBps),
            minSpreadPct: config.minSpreadPct,
            minSpreadBps: minBps,
            reason: explainAutoExecuteSkip({ opportunities: nextOpportunities, config }),
            pair: highlight?.pair || topReject?.tokenPair,
            dexIn: highlight?.dexIn || topReject?.dexAName || topReject?.buyExchange,
            dexOut: highlight?.dexOut || topReject?.dexBName || topReject?.sellExchange,
            chainId,
          });
        console.log(skipLine);
        appendServerLog({ level: "warn", source: "SKIPPED", chainId, message: skipLine });
        if (topReject) {
          logSkipProfitBreakdown({
            opp: topReject,
            config,
            liveGasWei: pickLiveGasWei(gasPrice.toString(), peekMemoizedGasWei(chainId).toString()),
            nativeUsd: lastNativeUsd.get(chainId),
            chainId,
            headline: `[SKIP] ${explainAutoExecuteSkip({ opportunities: nextOpportunities, config })}`,
            detailReason: explainAutoExecuteSkip({ opportunities: nextOpportunities, config }),
            decisionStatus: "SKIP_PROFIT_RENDAH",
            phase: "skip",
          });
        }
      }
    } else if (readyCount === 0) {
      const peak = takeAutoSpreadWaitPeakIfDue();
      if (peak !== null) {
        const topReject = [...nextOpportunities]
          .filter((item) => item.status !== "ready")
          .sort((a, b) => (b.spreadBps || 0) - (a.spreadBps || 0))[0];
        const waitLine = formatAutoSpreadWaitLine({
            maxSpreadBps: peak,
            minSpreadPct: config.minSpreadPct,
            minSpreadBps: minSpreadBpsFromConfig(config),
            reason: topReject?.reason,
            provider: bestFlash?.name ?? flashLoanProviderLabel(config.flashLoanProvider),
            pair: highlight?.pair || topReject?.tokenPair,
            dexIn: highlight?.dexIn || topReject?.dexAName || topReject?.buyExchange,
            dexOut: highlight?.dexOut || topReject?.dexBName || topReject?.sellExchange,
            chainId,
          });
        console.log(waitLine);
        appendServerLog({ level: "warn", source: "SKIPPED", chainId, message: waitLine });
      }
    }

    return nextOpportunities;
  } catch (error) {
    if (error instanceof ScanRuntimeAbortError) return [];
    const lastError = stringifyUnknownError(error);
    await patchBotState((current) => ({ ...current, lastError }));
    try {
      recordHeartbeatScan({ routes: 0, ready: 0, ok: false });
    } catch {
      /* ignore */
    }
    return state.opportunities;
  }
}
