import { loanRatioForLiquidity, loanUsdFromPoolLiquidity } from "@/lib/bot/adaptiveMinProfit";
import { tokenWeiToUsd, usdToTokenWei } from "@/lib/bot/configUnits";

/** 2% likuiditas pool V3. 3% untuk AMM cadangan tetap. */
export const CONCENTRATED_LIQUIDITY_PCT = loanRatioForLiquidity(true) * 100;
export const AMM_LIQUIDITY_PCT = loanRatioForLiquidity(false) * 100;

export interface DynamicLoanSizeInput {
  buyReserveQuote: bigint;
  sellReserveQuote: bigint;
  /** TVL sisi beli (USD). Opsional; dipakai bersama cadangan. */
  buyTvlUsd?: number;
  /** TVL sisi jual (USD). */
  sellTvlUsd?: number;
  quoteDecimals: number;
  /** Harga 1 unit token quote dalam USD (stable ≈ 1). */
  quoteUsd: number;
  /** true = V3 (2% pool). false = AMM biasa (3% pool). */
  concentrated: boolean;
}

export interface DynamicLoanSize {
  amountInWei: bigint;
  loanUsd: number;
  safePct: number;
  /** Likuiditas referensi (USD) yang dikalikan persen aman. */
  poolLiquidityUsd: number;
}

function positiveUsd(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return value;
}

/**
 * Ukuran flashloan = 2% (V3) atau 3% (AMM) dari likuiditas pool yang lebih tipis.
 * Pool kosong menghasilkan loan 0, bukan nominal default.
 */
export function optimalFlashloanSize(input: DynamicLoanSizeInput): DynamicLoanSize {
  const ratio = loanRatioForLiquidity(input.concentrated);
  const safePct = ratio * 100;
  const decimals = Number.isFinite(input.quoteDecimals) ? input.quoteDecimals : 18;
  const quoteUsd = Number.isFinite(input.quoteUsd) && input.quoteUsd > 0 ? input.quoteUsd : 1;

  const thinnerReserve =
    input.buyReserveQuote > 0n && input.sellReserveQuote > 0n
      ? input.buyReserveQuote < input.sellReserveQuote
        ? input.buyReserveQuote
        : input.sellReserveQuote
      : input.buyReserveQuote > 0n
        ? input.buyReserveQuote
        : input.sellReserveQuote;

  const buyTvl = positiveUsd(input.buyTvlUsd);
  const sellTvl = positiveUsd(input.sellTvlUsd);
  const thinnerTvl = buyTvl > 0 && sellTvl > 0 ? Math.min(buyTvl, sellTvl) : buyTvl || sellTvl;
  const reserveUsd = tokenWeiToUsd(thinnerReserve, decimals, quoteUsd);
  const referenceUsd = thinnerTvl > 0 && reserveUsd > 0 ? Math.min(thinnerTvl, reserveUsd) : thinnerTvl || reserveUsd;
  const loanUsd = loanUsdFromPoolLiquidity(referenceUsd, ratio);
  const amountInWei = BigInt(usdToTokenWei(loanUsd, decimals, quoteUsd) || "0");

  return {
    amountInWei,
    loanUsd: amountInWei > 0n ? tokenWeiToUsd(amountInWei, decimals, quoteUsd) : 0,
    safePct,
    poolLiquidityUsd: referenceUsd,
  };
}

/** Nominal yang masuk ke kalkulasi arb: hasil dynamic sizing, atau fallback bila cadangan kosong. */
export function resolveDynamicAmountIn(
  dynamicSize: Pick<DynamicLoanSize, "amountInWei"> | null | undefined,
  fallbackAmountIn: bigint
): bigint {
  if (dynamicSize && dynamicSize.amountInWei > 0n) return dynamicSize.amountInWei;
  return fallbackAmountIn > 0n ? fallbackAmountIn : 0n;
}
