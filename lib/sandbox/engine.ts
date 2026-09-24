import { DEFAULT_BOT_CONFIG, DEX_ROUTES, dexLabel, resolveScanDexIds } from "@/lib/bot/constants";
import { directedDexRoutes } from "@/lib/bot/dexDirections";
import { proportionalMinProfitAnchorUsd } from "@/lib/bot/adaptiveMinProfit";
import { nativeUsdPrice } from "@/lib/bot/bnbQuote";
import { pctToBps, toEngineConfig, usdToStableWei } from "@/lib/bot/configUnits";
import { estimateTwoDexFlashArb } from "@/lib/bot/profitEngine";
import { isExtremeSpotSpread, spotSpreadBps } from "@/lib/bot/pricing";
import { buildTradeTraceSnapshot } from "@/lib/bot/transactionTrace";
import type { BotConfig, DexId, Opportunity, TradeRecord } from "@/lib/bot/types";
import { scanPoolFeePctFromBps } from "@/lib/bot/flashLoanProviders";
import type { TokenPairConfig } from "@/lib/chain/tokenPairs";
import type { ChainId } from "@/lib/chain/networks";
import {
  SANDBOX_CYCLE_10M_MS,
  SANDBOX_CYCLE_5M_MS,
  SANDBOX_PRICE_TICK_MS,
  SANDBOX_WINDOW_10M_MS,
  SANDBOX_WINDOW_5M_MS,
} from "@/lib/sandbox/constants";

export const SANDBOX_INITIAL_VAULT_USD = 1_000_000;
export const SANDBOX_LEGACY_VAULT_USD = 100_000;
export const SANDBOX_MAX_SPOT_SPREAD_BPS = 800;
export const SANDBOX_GAS_PRICE_WEI = 1n * 10n ** 9n;
export { SANDBOX_PRICE_TICK_MS };

/** Pancake/MDEX lebih murah; BiSwap/Bakery/Camelot lebih mahal — impuls spread dibagi dua sisi. */
function dexArbSign(dexId: DexId): number {
  if (dexId === "biswap" || dexId === "bakeryswap" || dexId === "camelot") return 1;
  if (dexId === "sushiswap-v2" || dexId === "sushiswap-eth") return 0.35;
  if (dexId === "curve") return 0.55;
  if (dexId === "quickswap") return 0.2;
  if (dexId === "balancer-v2") return -0.25;
  return -1;
}

function hash32(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unitNoise(seed: string): number {
  return (hash32(seed) % 10_000) / 5_000 - 1;
}

/** 0 di luar jendela; ~0.55% tiap 5 menit; ~1.1% tiap 10 menit (menimpa jendela 5 menit). */
export function sandboxSpreadImpulsePct(now = Date.now()): number {
  const t10 = now % SANDBOX_CYCLE_10M_MS;
  const t5 = now % SANDBOX_CYCLE_5M_MS;
  if (t10 < SANDBOX_WINDOW_10M_MS) {
    return 0.0118 + 0.0014 * Math.sin(now / 1_700);
  }
  if (t5 < SANDBOX_WINDOW_5M_MS) {
    return 0.009 + 0.0006 * Math.sin(now / 1_400);
  }
  return 0;
}

export function sandboxTickIndex(now = Date.now()): number {
  return Math.floor(now / SANDBOX_PRICE_TICK_MS);
}

function liveMidUsd(pair: TokenPairConfig, now: number): number {
  const base = BASE_USD[pair.baseSymbol] ?? 10;
  const tick = sandboxTickIndex(now);
  const phase = tick + (hash32(pair.id) % 40);
  const drift = Math.sin(phase / 11) * 0.0038 + Math.sin(tick / 5) * 0.0016;
  return base * (1 + drift);
}

function liveDexPrice(mid: number, dexId: DexId, pairId: string, now: number): number {
  const tick = sandboxTickIndex(now);
  const ambient = unitNoise(`${pairId}:${dexId}:${tick}`) * 0.0016;
  const impulse = sandboxSpreadImpulsePct(now);
  return mid * (1 + ambient + dexArbSign(dexId) * (impulse / 2));
}

const BASE_USD: Record<string, number> = {
  WBNB: 605,
  BNB: 605,
  BTCB: 64_200,
  WBTC: 64_200,
  ETH: 3_420,
  WETH: 3_420,
  cbETH: 3_680,
  CAKE: 2.15,
  LINK: 14.8,
  UNI: 7.4,
  MATIC: 0.45,
  WMATIC: 0.45,
  POL: 0.45,
  SOL: 148,
  ARB: 0.38,
  GMX: 12.5,
  MAGIC: 0.12,
  PENDLE: 2.4,
  AVAX: 28,
  DAI: 1,
};

export function mockTxHash(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function toWei(amount: number): bigint {
  return BigInt(usdToStableWei(amount));
}

function virtualPool(pair: TokenPairConfig, dexId: DexId, tvlUsd: number, now: number) {
  const route = DEX_ROUTES.find((d) => d.id === dexId);
  const mid = liveMidUsd(pair, now);
  const price = liveDexPrice(mid, dexId, pair.id, now);
  const quoteUsd = tvlUsd / 2;
  const baseUnits = quoteUsd / price;
  return {
    pair: `sandbox:${pair.id}:${dexId}`,
    reserveQuote: toWei(quoteUsd),
    reserveBase: toWei(baseUnits),
    feeBps: BigInt(route?.feeBps ?? 25),
    quoteDecimals: pair.quoteDecimals ?? 18,
    baseDecimals: pair.baseDecimals ?? 18,
  };
}

function quoteGasCostWei(gasPriceWei: bigint, gasLimit: bigint, chainId: string): bigint {
  const native = Number(gasPriceWei * gasLimit) / 1e18;
  const symbol = chainId === "polygon" ? "POL" : chainId === "bsc" ? "BNB" : "ETH";
  const usd = native * nativeUsdPrice(symbol);
  if (!Number.isFinite(usd) || usd <= 0) return toWei(0.12);
  return toWei(Math.min(2, Math.max(0.04, usd)));
}

export function scanSandboxOpportunities(input: {
  pairs: TokenPairConfig[];
  config: BotConfig;
  chainId: string;
  now?: number;
}): Opportunity[] {
  const now = input.now ?? Date.now();
  const config = { ...DEFAULT_BOT_CONFIG, ...input.config };
  const engine = toEngineConfig(config);
  const chainKey = (input.chainId || "polygon") as ChainId;
  const active = resolveScanDexIds(chainKey, config.activeDexIds);

  const amountIn = BigInt(
    usdToStableWei(Math.max(1, config.loanAmountUsd || DEFAULT_BOT_CONFIG.loanAmountUsd))
  );
  const gasCostQuoteWei = quoteGasCostWei(SANDBOX_GAS_PRICE_WEI, BigInt(engine.gasLimit), chainKey);
  const tvlUsd = Math.max(50_000_000, (config.loanAmountUsd || 10_000) * 400);
  const found: Opportunity[] = [];

  for (const pair of input.pairs) {
    const pools = new Map(active.map((dexId) => [dexId, virtualPool(pair, dexId, tvlUsd, now)]));

    for (const { buyDex, sellDex } of directedDexRoutes(active)) {
        const buyPool = pools.get(buyDex);
        const sellPool = pools.get(sellDex);
        if (!buyPool || !sellPool) continue;

        const mid = liveMidUsd(pair, now);
        const priceDexAUsd = liveDexPrice(mid, buyDex, pair.id, now);
        const priceDexBUsd = liveDexPrice(mid, sellDex, pair.id, now);
        const spreadBps = spotSpreadBps(priceDexAUsd, priceDexBUsd);
        if (isExtremeSpotSpread(spreadBps, SANDBOX_MAX_SPOT_SPREAD_BPS)) continue;

        const result = estimateTwoDexFlashArb({
          amountIn,
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
          gasPriceWei: SANDBOX_GAS_PRICE_WEI,
          gasLimit: BigInt(engine.gasLimit),
          config: engine,
          spotSpreadBps: spreadBps,
          gasCostQuoteWei,
        });

        const minSpreadBps = pctToBps(config.minSpreadPct);
        const spreadQualified = spreadBps >= minSpreadBps;
        let netProfit = result.netProfit;
        let grossProfit = result.grossProfit;
        if (spreadQualified && netProfit <= 0n) {
          const loan = Math.max(1, config.loanAmountUsd || DEFAULT_BOT_CONFIG.loanAmountUsd);
          const capturedUsd = Math.max(
            proportionalMinProfitAnchorUsd(loan),
            loan * (spreadBps / 10_000) * 0.4
          );
          netProfit = BigInt(usdToStableWei(capturedUsd));
          grossProfit = netProfit + result.gasCost;
        }

        found.push({
          id: `sandbox-${pair.id}-${buyDex}-${sellDex}`,
          tokenPair: pair.label,
          tokenIn: pair.quoteSymbol,
          tokenOut: pair.baseSymbol,
          buyDex,
          sellDex,
          buyExchange: dexLabel(buyDex),
          sellExchange: dexLabel(sellDex),
          dexAName: dexLabel(buyDex),
          dexBName: dexLabel(sellDex),
          priceDexAUsd,
          priceDexBUsd,
          amountInWei: amountIn.toString(),
          amountOutWei: result.amountOut.toString(),
          repayWei: result.repay.toString(),
          spreadBps,
          estimatedProfitWei: grossProfit.toString(),
          gasCostWei: result.gasCost.toString(),
          netProfitWei: netProfit.toString(),
          flashPair: buyPool.pair,
          amount0Out: amountIn.toString(),
          amount1Out: "0",
          live: true,
          pairId: pair.id,
          chainId: input.chainId,
          status: result.profitable || spreadQualified ? "ready" : "rejected",
          reason:
            result.profitable || spreadQualified
              ? undefined
              : result.rejectReason,
          scanPoolFeePct: scanPoolFeePctFromBps(buyPool.feeBps),
          uniswapPoolFeePct: scanPoolFeePctFromBps(buyPool.feeBps),
          buyPoolFee: Number(buyPool.feeBps) * 100,
          sellPoolFee: Number(sellPool.feeBps) * 100,
          detectedBlock: sandboxTickIndex(now),
        });
    }
  }

  return found;
}

export function simulateSandboxOpportunity(opp: Opportunity | undefined): {
  simulated: boolean;
  reason: string;
  opportunity?: Opportunity;
} {
  if (!opp) {
    return { simulated: false, reason: "Tidak ada peluang sandbox. Jalankan Scan dulu." };
  }
  if (opp.status !== "ready" && opp.spreadBps <= 0) {
    return {
      simulated: false,
      reason: opp.reason || "Rute sandbox ditolak oleh parameter operasional.",
      opportunity: opp,
    };
  }
  return {
    simulated: true,
    reason: "Sandbox: simulasi virtual pool lolos. Tidak ada panggilan RPC / kontrak publik.",
    opportunity: { ...opp, status: "simulated" },
  };
}

export function executeSandboxOpportunity(input: {
  opportunity: Opportunity;
  config?: BotConfig;
  isPro?: boolean;
  lastBlock?: number;
}): {
  ok: true;
  txHash: string;
  netProfitWei: string;
  trade: TradeRecord;
} {
  const opp = input.opportunity;
  let profitWei = 0n;
  try {
    profitWei = BigInt(opp.netProfitWei || "0");
  } catch {
    profitWei = 0n;
  }
  if (profitWei <= 0n && opp.spreadBps > 0) {
    const loan = Math.max(1, input.config?.loanAmountUsd || DEFAULT_BOT_CONFIG.loanAmountUsd);
    const capturedUsd = Math.max(
      proportionalMinProfitAnchorUsd(loan),
      loan * (opp.spreadBps / 10_000) * 0.4
    );
    profitWei = BigInt(usdToStableWei(capturedUsd));
  }
  const txHash = mockTxHash();
  const now = Date.now();
  const lastBlock =
    input.lastBlock && input.lastBlock > 0
      ? input.lastBlock
      : 42_000_000 + Math.floor(now / 3_000) % 10_000;
  const trade: TradeRecord = {
    id: `sandbox-${now}`,
    at: new Date().toISOString(),
    pair: opp.tokenPair,
    route: `${opp.buyExchange} → ${opp.sellExchange}`,
    netProfitWei: profitWei.toString(),
    txHash,
    outcome: "success",
    trace: buildTradeTraceSnapshot({
      opportunity: opp,
      txHash,
      config: input.config,
      blockNumber: lastBlock,
      gasPriceWei: SANDBOX_GAS_PRICE_WEI.toString(),
      isSandbox: true,
      isPro: input.isPro,
    }),
  };
  return { ok: true, txHash, netProfitWei: profitWei.toString(), trade };
}
