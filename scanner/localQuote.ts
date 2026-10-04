import { getAmountOut } from "@/lib/bot/dexMath";
import { quoteV3ExactInput, type V3QuotePool, type V3SwapResult } from "@/scanner/v3/swap";

export type { V3QuotePool, V3SwapResult };

/** Amount-out V2 dari cadangan di RAM. */
export function quoteLocalAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: bigint
): bigint {
  return getAmountOut(amountIn, reserveIn, reserveOut, feeBps);
}

/** Swap exact-input Uniswap V3. Fee tier dipotong di dalam SwapMath sebelum sqrtPrice berubah. */
export function quoteLocalV3ExactIn(input: {
  pool: V3QuotePool;
  amountIn: bigint;
  zeroForOne: boolean;
}): V3SwapResult {
  return quoteV3ExactInput(input);
}

export function tickSpacingForFee(feePips: number): number {
  if (feePips === 100) return 1;
  if (feePips === 500) return 10;
  if (feePips === 2500) return 50;
  if (feePips === 3000) return 60;
  if (feePips === 10000) return 200;
  return 60;
}
