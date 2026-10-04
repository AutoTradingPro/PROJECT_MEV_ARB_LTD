import { mulDiv, mulDivRoundingUp } from "@/scanner/v3/fullMath";
import {
  getAmount0Delta,
  getAmount1Delta,
  getNextSqrtPriceFromInput,
  getNextSqrtPriceFromOutput,
} from "@/scanner/v3/sqrtPriceMath";

const ONE_E6 = 1_000_000n;

export interface SwapStep {
  sqrtRatioNextX96: bigint;
  amountIn: bigint;
  amountOut: bigint;
  feeAmount: bigint;
}

/**
 * SwapMath.computeSwapStep.
 * Fee dipotong dari amountRemaining sebelum sqrtPrice bergerak.
 * Input dibulatkan ke atas, output ke bawah.
 */
export function computeSwapStep(
  sqrtRatioCurrentX96: bigint,
  sqrtRatioTargetX96: bigint,
  liquidity: bigint,
  amountRemaining: bigint,
  feePips: number
): SwapStep {
  const zeroForOne = sqrtRatioCurrentX96 >= sqrtRatioTargetX96;
  const exactIn = amountRemaining >= 0n;
  const fee = BigInt(feePips);
  let amountIn = 0n;
  let amountOut = 0n;
  let sqrtRatioNextX96: bigint;

  if (exactIn) {
    const amountRemainingLessFee = mulDiv(amountRemaining, ONE_E6 - fee, ONE_E6);
    amountIn = zeroForOne
      ? getAmount0Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, true)
      : getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, true);
    if (amountRemainingLessFee >= amountIn) {
      sqrtRatioNextX96 = sqrtRatioTargetX96;
    } else {
      sqrtRatioNextX96 = getNextSqrtPriceFromInput(
        sqrtRatioCurrentX96,
        liquidity,
        amountRemainingLessFee,
        zeroForOne
      );
    }
  } else {
    const amountRemainingAbs = -amountRemaining;
    amountOut = zeroForOne
      ? getAmount1Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, false)
      : getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, false);
    if (amountRemainingAbs >= amountOut) {
      sqrtRatioNextX96 = sqrtRatioTargetX96;
    } else {
      sqrtRatioNextX96 = getNextSqrtPriceFromOutput(
        sqrtRatioCurrentX96,
        liquidity,
        amountRemainingAbs,
        zeroForOne
      );
    }
  }

  const max = sqrtRatioTargetX96 === sqrtRatioNextX96;
  if (zeroForOne) {
    amountIn =
      max && exactIn
        ? amountIn
        : getAmount0Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, true);
    amountOut =
      max && !exactIn
        ? amountOut
        : getAmount1Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, false);
  } else {
    amountIn =
      max && exactIn
        ? amountIn
        : getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, true);
    amountOut =
      max && !exactIn
        ? amountOut
        : getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, false);
  }

  if (!exactIn && amountOut > -amountRemaining) amountOut = -amountRemaining;

  let feeAmount: bigint;
  if (exactIn && sqrtRatioNextX96 !== sqrtRatioTargetX96) {
    feeAmount = amountRemaining - amountIn;
  } else {
    feeAmount = mulDivRoundingUp(amountIn, fee, ONE_E6 - fee);
  }

  return { sqrtRatioNextX96, amountIn, amountOut, feeAmount };
}
