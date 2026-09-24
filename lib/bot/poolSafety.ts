import { getAmountOut } from "@/lib/bot/dexMath";
import { poolLiquidityUsd } from "@/lib/bot/pricing";
import { dexLabel, MIN_POOL_LIQUIDITY_USD } from "@/lib/bot/constants";
import type { DexId } from "@/lib/bot/types";

export const DEFAULT_MAX_PRICE_IMPACT_PCT = 1;

export interface LivePoolLike {
  reserveBase: bigint;
  reserveQuote: bigint;
  feeBps: bigint;
  quoteDecimals: number;
  baseDecimals: number;
  tvlReliable?: boolean;
}

export function clampMinPoolLiquidityUsd(value: number | undefined): number {
  if (!Number.isFinite(value as number) || (value as number) < 0) return MIN_POOL_LIQUIDITY_USD;
  return Math.min(50_000_000, Math.max(0, value as number));
}

export function clampMaxPriceImpactPct(value: number | undefined): number {
  if (!Number.isFinite(value as number) || (value as number) <= 0) return DEFAULT_MAX_PRICE_IMPACT_PCT;
  return Math.min(15, Math.max(0.05, value as number));
}

export const DEFAULT_MAX_SPOT_SPREAD_PCT = 5;

/** Batas atas spread wajar (glitch tick V3 vs cadangan V2). */
export function clampMaxSpotSpreadPct(value: number | undefined): number {
  if (!Number.isFinite(value as number) || (value as number) <= 0) return DEFAULT_MAX_SPOT_SPREAD_PCT;
  return Math.min(25, Math.max(1, value as number));
}

/** Price impact AMM ≈ amountIn / (amountIn + reserveIn), dalam persen. */
export function reservePriceImpactPct(amountIn: bigint, reserveIn: bigint): number {
  if (amountIn <= 0n) return 0;
  if (reserveIn <= 0n) return 100;
  const denom = amountIn + reserveIn;
  if (denom <= 0n) return 100;
  const bps = Number((amountIn * 10_000n) / denom);
  if (!Number.isFinite(bps) || bps < 0) return 100;
  return bps / 100;
}

export function formatPoolLiquidityUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0";
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}

/** Label tabel/log: TVL tidak terbaca → — */
export function formatPoolLiquidityLabel(usd: number | undefined): string {
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) return "—";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 10_000) return `$${(usd / 1_000).toFixed(1)}k`;
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}

export interface PoolRouteCheck {
  ok: boolean;
  poolLiquidityUsd: number;
  buyLiquidityUsd: number;
  sellLiquidityUsd: number;
  priceImpactPct: number;
  buyImpactPct: number;
  sellImpactPct: number;
  reason?: string;
}

function poolTvlUsd(pool: LivePoolLike, quoteUsd: number): number {
  if (pool.tvlReliable === false) return 0;
  return poolLiquidityUsd(
    pool.reserveQuote,
    pool.reserveBase,
    pool.quoteDecimals,
    pool.baseDecimals,
    quoteUsd
  );
}

export function livePoolLiquidityUsd(pool: LivePoolLike, quoteUsd: number): number {
  return poolTvlUsd(pool, quoteUsd);
}

/** True jika TVL ≥ min (min ≤ 0 = bypass). TVL 0/unknown diizinkan agar cadangan gagal tidak mematikan rute. */
export function meetsMinPoolLiquidityUsd(
  poolLiquidityUsd: number | undefined,
  minPoolLiquidityUsd: number
): boolean {
  const minLiq = clampMinPoolLiquidityUsd(minPoolLiquidityUsd);
  if (minLiq <= 0) return true;
  if (typeof poolLiquidityUsd !== "number" || !Number.isFinite(poolLiquidityUsd) || poolLiquidityUsd <= 0) {
    return true;
  }
  return poolLiquidityUsd >= minLiq;
}

/**
 * Pair layak di-scan bila ≥2 pool tidak diketahui tipis.
 * TVL 0 (cadangan gagal dibaca) tetap diizinkan agar tidak false-negative.
 */
export function pairMeetsMinLiquidityForScan(
  pools: LivePoolLike[],
  quoteUsd: number,
  minPoolLiquidityUsd: number
): boolean {
  const minLiq = clampMinPoolLiquidityUsd(minPoolLiquidityUsd);
  if (minLiq <= 0) return pools.length >= 2;
  const usable = pools.filter((pool) => {
    const liq = poolTvlUsd(pool, quoteUsd);
    return !(liq > 0 && liq < minLiq);
  });
  return usable.length >= 2;
}

/** Semua pool terbaca dan semuanya di bawah min → aman di-skip fetch beberapa detik. */
export function pairKnownBelowMinLiquidity(
  pools: LivePoolLike[],
  quoteUsd: number,
  minPoolLiquidityUsd: number
): boolean {
  const minLiq = clampMinPoolLiquidityUsd(minPoolLiquidityUsd);
  if (minLiq <= 0 || pools.length === 0) return false;
  return pools.every((pool) => {
    const liq = poolTvlUsd(pool, quoteUsd);
    return liq > 0 && liq < minLiq;
  });
}

export function evaluatePoolRouteSafety(input: {
  buyPool: LivePoolLike;
  sellPool: LivePoolLike;
  amountIn: bigint;
  quoteUsd: number;
  minPoolLiquidityUsd: number;
  maxPriceImpactPct: number;
}): PoolRouteCheck {
  const minLiq = clampMinPoolLiquidityUsd(input.minPoolLiquidityUsd);
  const quoteUsd = input.quoteUsd > 0 ? input.quoteUsd : 1;
  const buyLiquidityUsd = poolTvlUsd(input.buyPool, quoteUsd);
  const sellLiquidityUsd = poolTvlUsd(input.sellPool, quoteUsd);
  const poolLiq = Math.min(buyLiquidityUsd, sellLiquidityUsd);

  const buyImpactPct = reservePriceImpactPct(input.amountIn, input.buyPool.reserveQuote);
  const bought = getAmountOut(
    input.amountIn,
    input.buyPool.reserveQuote,
    input.buyPool.reserveBase,
    input.buyPool.feeBps
  );
  const sellIn = bought > 0n ? bought : input.amountIn;
  const sellImpactPct = reservePriceImpactPct(sellIn, input.sellPool.reserveBase);
  const priceImpactPct = Math.max(buyImpactPct, sellImpactPct);

  if (minLiq > 0 && poolLiq > 0 && poolLiq < minLiq) {
    return {
      ok: false,
      poolLiquidityUsd: poolLiq,
      buyLiquidityUsd,
      sellLiquidityUsd,
      priceImpactPct,
      buyImpactPct,
      sellImpactPct,
      reason: `likuiditas ${formatPoolLiquidityUsd(poolLiq)} < min ${formatPoolLiquidityUsd(minLiq)}`,
    };
  }
  return {
    ok: true,
    poolLiquidityUsd: poolLiq,
    buyLiquidityUsd,
    sellLiquidityUsd,
    priceImpactPct,
    buyImpactPct,
    sellImpactPct,
  };
}

export function formatPoolCheckLog(input: {
  pair: string;
  buyDex: DexId;
  sellDex: DexId;
  check: PoolRouteCheck;
}): string {
  const route = `${dexLabel(input.buyDex) || input.buyDex} → ${dexLabel(input.sellDex) || input.sellDex}`;
  const impact = `${input.check.priceImpactPct.toFixed(2)}%`;
  const liq = formatPoolLiquidityUsd(input.check.poolLiquidityUsd);
  const base = `[POOL CHECK] Pair: ${input.pair} · ${route} | Liquidity: ${liq} | Price Impact: ${impact}`;
  if (input.check.ok) return base;
  return `${base} | SKIP ${input.check.reason ?? "filter pool"}`;
}

export function opportunityFailsPoolSafety(
  opp: {
    poolLiquidityUsd?: number;
    priceImpactPct?: number;
  },
  minPoolLiquidityUsd: number,
  _maxPriceImpactPct?: number
): string | null {
  const minLiq = clampMinPoolLiquidityUsd(minPoolLiquidityUsd);
  if (minLiq <= 0) return null;
  if (typeof opp.poolLiquidityUsd !== "number" || !(opp.poolLiquidityUsd > 0)) return null;
  if (opp.poolLiquidityUsd < minLiq) {
    return `Likuiditas pool ${formatPoolLiquidityUsd(opp.poolLiquidityUsd)} di bawah min ${formatPoolLiquidityUsd(minLiq)}.`;
  }
  return null;
}
