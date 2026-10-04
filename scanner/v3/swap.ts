import { applyLiquidityDelta } from "@/scanner/v3/sqrtPriceMath";
import { computeSwapStep } from "@/scanner/v3/swapMath";
import {
  nextInitializedTickWithinOneWord,
  type TickBook,
} from "@/scanner/v3/tickBitmap";
import {
  MAX_SQRT_RATIO,
  MAX_TICK,
  MIN_SQRT_RATIO,
  MIN_TICK,
  getSqrtRatioAtTick,
  getTickAtSqrtRatio,
} from "@/scanner/v3/tickMath";

export interface V3QuotePool {
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  feePips: number;
  tickSpacing: number;
  ticks: TickBook;
}

export interface V3SwapResult {
  amountIn: bigint;
  amountOut: bigint;
  feeAmount: bigint;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
}

const MAX_STEPS = 8192;

/**
 * Loop swap exact-input UniswapV3Pool.swap.
 * Saat harga menyentuh tick terinisialisasi, L ditambah liquidityNet
 * (dinegasi jika zeroForOne), sama seperti ticks.cross.
 */
export function quoteV3ExactInput(input: {
  pool: V3QuotePool;
  amountIn: bigint;
  zeroForOne: boolean;
}): V3SwapResult {
  if (input.amountIn <= 0n || input.pool.liquidity < 0n) {
    return {
      amountIn: 0n,
      amountOut: 0n,
      feeAmount: 0n,
      sqrtPriceX96: input.pool.sqrtPriceX96,
      tick: input.pool.tick,
      liquidity: input.pool.liquidity,
    };
  }

  const sqrtPriceLimitX96 = input.zeroForOne ? MIN_SQRT_RATIO + 1n : MAX_SQRT_RATIO - 1n;
  let amountSpecifiedRemaining = input.amountIn;
  let amountCalculated = 0n;
  let sqrtPriceX96 = input.pool.sqrtPriceX96;
  let tick = input.pool.tick;
  let liquidity = input.pool.liquidity;
  let feePaid = 0n;

  for (let stepIndex = 0; stepIndex < MAX_STEPS; stepIndex += 1) {
    if (amountSpecifiedRemaining === 0n || sqrtPriceX96 === sqrtPriceLimitX96) break;
    const sqrtPriceStartX96 = sqrtPriceX96;
    let { next: tickNext, initialized } = nextInitializedTickWithinOneWord(
      input.pool.ticks,
      tick,
      input.pool.tickSpacing,
      input.zeroForOne
    );
    if (tickNext < MIN_TICK) {
      tickNext = MIN_TICK;
      initialized = false;
    } else if (tickNext > MAX_TICK) {
      tickNext = MAX_TICK;
      initialized = false;
    }

    const sqrtPriceNextX96 = getSqrtRatioAtTick(tickNext);
    const target = input.zeroForOne
      ? sqrtPriceNextX96 < sqrtPriceLimitX96
        ? sqrtPriceLimitX96
        : sqrtPriceNextX96
      : sqrtPriceNextX96 > sqrtPriceLimitX96
        ? sqrtPriceLimitX96
        : sqrtPriceNextX96;

    let step;
    try {
      step = computeSwapStep(sqrtPriceX96, target, liquidity, amountSpecifiedRemaining, input.pool.feePips);
    } catch {
      break;
    }

    sqrtPriceX96 = step.sqrtRatioNextX96;
    amountSpecifiedRemaining -= step.amountIn + step.feeAmount;
    amountCalculated -= step.amountOut;
    feePaid += step.feeAmount;

    if (amountSpecifiedRemaining < 0n) amountSpecifiedRemaining = 0n;

    if (sqrtPriceX96 === sqrtPriceNextX96) {
      if (initialized) {
        let liquidityNet = input.pool.ticks.liquidityNet.get(tickNext) ?? 0n;
        if (input.zeroForOne) liquidityNet = -liquidityNet;
        try {
          liquidity = applyLiquidityDelta(liquidity, liquidityNet);
        } catch {
          break;
        }
      }
      tick = input.zeroForOne ? tickNext - 1 : tickNext;
    } else if (sqrtPriceX96 !== sqrtPriceStartX96) {
      tick = getTickAtSqrtRatio(sqrtPriceX96);
    } else {
      break;
    }
  }

  const used = input.amountIn - (amountSpecifiedRemaining < 0n ? 0n : amountSpecifiedRemaining);
  return {
    amountIn: used,
    amountOut: amountCalculated < 0n ? -amountCalculated : 0n,
    feeAmount: feePaid,
    sqrtPriceX96,
    tick,
    liquidity,
  };
}
