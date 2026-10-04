/** FullMath.mulDiv / mulDivRoundingUp. BigInt menampung produk 512-bit tanpa overflow uint256. */

export function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("mulDiv denominator");
  return (a * b) / denominator;
}

export function mulDivRoundingUp(a: bigint, b: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("mulDivRoundingUp denominator");
  const product = a * b;
  const quotient = product / denominator;
  return product % denominator === 0n ? quotient : quotient + 1n;
}

export function divRoundingUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("divRoundingUp denominator");
  const quotient = numerator / denominator;
  return numerator % denominator === 0n ? quotient : quotient + 1n;
}
