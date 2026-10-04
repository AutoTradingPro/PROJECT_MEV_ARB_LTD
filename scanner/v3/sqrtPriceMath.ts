import { divRoundingUp, mulDiv, mulDivRoundingUp } from "@/scanner/v3/fullMath";
import { Q96 } from "@/scanner/v3/tickMath";

const MAX_UINT160 = (1n << 160n) - 1n;

function addDeltaLiquidity(x: bigint, y: bigint): bigint {
  const z = x + y;
  if (z < 0n || z > (1n << 128n) - 1n) throw new Error("liquidity delta");
  return z;
}

export function getAmount0Delta(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
  roundUp: boolean
): bigint {
  let a = sqrtRatioAX96;
  let b = sqrtRatioBX96;
  if (a > b) {
    const swap = a;
    a = b;
    b = swap;
  }
  if (a <= 0n) throw new Error("sqrt ratio");
  const numerator1 = liquidity << 96n;
  const numerator2 = b - a;
  if (roundUp) {
    return divRoundingUp(mulDivRoundingUp(numerator1, numerator2, b), a);
  }
  return mulDiv(numerator1, numerator2, b) / a;
}

export function getAmount1Delta(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
  roundUp: boolean
): bigint {
  let a = sqrtRatioAX96;
  let b = sqrtRatioBX96;
  if (a > b) {
    const swap = a;
    a = b;
    b = swap;
  }
  const delta = b - a;
  return roundUp ? mulDivRoundingUp(liquidity, delta, Q96) : mulDiv(liquidity, delta, Q96);
}

function getNextSqrtPriceFromAmount0RoundingUp(
  sqrtPX96: bigint,
  liquidity: bigint,
  amount: bigint,
  add: boolean
): bigint {
  if (amount === 0n) return sqrtPX96;
  const numerator1 = liquidity << 96n;
  if (add) {
    const product = amount * sqrtPX96;
    if (amount === 0n || product / amount === sqrtPX96) {
      const denominator = numerator1 + product;
      if (denominator >= numerator1) {
        return mulDivRoundingUp(numerator1, sqrtPX96, denominator);
      }
    }
    return divRoundingUp(numerator1, numerator1 / sqrtPX96 + amount);
  }
  const product = amount * sqrtPX96;
  if (product / amount !== sqrtPX96 || numerator1 <= product) throw new Error("amount0");
  const denominator = numerator1 - product;
  return mulDivRoundingUp(numerator1, sqrtPX96, denominator);
}

function getNextSqrtPriceFromAmount1RoundingDown(
  sqrtPX96: bigint,
  liquidity: bigint,
  amount: bigint,
  add: boolean
): bigint {
  if (add) {
    const quotient =
      amount <= MAX_UINT160 ? (amount << 96n) / liquidity : mulDiv(amount, Q96, liquidity);
    return sqrtPX96 + quotient;
  }
  const quotient =
    amount <= MAX_UINT160
      ? divRoundingUp(amount << 96n, liquidity)
      : mulDivRoundingUp(amount, Q96, liquidity);
  if (sqrtPX96 <= quotient) throw new Error("amount1");
  return sqrtPX96 - quotient;
}

export function getNextSqrtPriceFromInput(
  sqrtPX96: bigint,
  liquidity: bigint,
  amountIn: bigint,
  zeroForOne: boolean
): bigint {
  if (sqrtPX96 <= 0n || liquidity <= 0n) throw new Error("price input");
  const next = zeroForOne
    ? getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountIn, true)
    : getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountIn, true);
  if (next > MAX_UINT160) throw new Error("sqrt overflow");
  return next;
}

export function getNextSqrtPriceFromOutput(
  sqrtPX96: bigint,
  liquidity: bigint,
  amountOut: bigint,
  zeroForOne: boolean
): bigint {
  if (sqrtPX96 <= 0n || liquidity <= 0n) throw new Error("price output");
  const next = zeroForOne
    ? getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountOut, false)
    : getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountOut, false);
  if (next > MAX_UINT160) throw new Error("sqrt overflow");
  return next;
}

export function applyLiquidityDelta(liquidity: bigint, delta: bigint): bigint {
  return addDeltaLiquidity(liquidity, delta);
}
