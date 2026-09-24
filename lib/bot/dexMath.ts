/** Uniswap V2 / Pancake V2 amount-out with 0.25% or 0.30% fee as basis points. */

export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: bigint = 25n
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const feeFactor = 10_000n - feeBps;
  const amountInWithFee = amountIn * feeFactor;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10_000n + amountInWithFee;
  return numerator / denominator;
}

export function getAmountIn(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: bigint = 25n
): bigint {
  if (amountOut <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  if (amountOut >= reserveOut) return 0n;
  const feeFactor = 10_000n - feeBps;
  const numerator = reserveIn * amountOut * 10_000n;
  const denominator = (reserveOut - amountOut) * feeFactor;
  return numerator / denominator + 1n;
}

export function flashRepayAmount(borrowed: bigint, feeBps: bigint = 25n): bigint {
  return (borrowed * 10_000n) / (10_000n - feeBps) + 1n;
}

/** Premi Aave: repay = borrowed + borrowed * premiumBps / 10_000 */
export function aaveFlashRepayAmount(borrowed: bigint, premiumBps: bigint): bigint {
  if (borrowed <= 0n) return 0n;
  const premium = (borrowed * premiumBps) / 10_000n;
  return borrowed + premium;
}

export function applySlippage(amount: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, slippageBps));
  return (amount * (10_000n - bps)) / 10_000n;
}

export function bpsOf(amount: bigint, bps: number): bigint {
  return (amount * BigInt(Math.max(0, bps))) / 10_000n;
}

/** Perkiraan amount-out quote setelah beli+jual, dari spread spot (tanpa cadangan V2 palsu). */
export function estimateSpotRoundTripQuote(
  amountIn: bigint,
  spreadBps: number,
  buyFeeBps: bigint,
  sellFeeBps: bigint
): bigint {
  if (amountIn <= 0n) return 0n;
  const spread = BigInt(Math.max(0, Math.round(Number.isFinite(spreadBps) ? spreadBps : 0)));
  const clampFee = (fee: bigint) => (fee < 0n ? 0n : fee > 9_000n ? 9_000n : fee);
  const afterBuy = (amountIn * (10_000n - clampFee(buyFeeBps))) / 10_000n;
  const afterSpread = (afterBuy * (10_000n + spread)) / 10_000n;
  return (afterSpread * (10_000n - clampFee(sellFeeBps))) / 10_000n;
}

export function formatWeiToBnb(wei: string | bigint, digits = 4): string {
  const value = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const whole = abs / 10n ** 18n;
  const frac = abs % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, "0").slice(0, digits);
  return `${neg ? "-" : ""}${whole.toString()}.${fracStr} BNB`;
}

export function formatBps(bps: number): string {
  const sign = bps >= 0 ? "+" : "";
  return `${sign}${(bps / 100).toFixed(3)}%`;
}
