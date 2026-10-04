/** TickBitmap + liquidityNet di RAM. wordPos -> uint256, tick -> liquidityNet. */

const WORD_MASK = (1n << 256n) - 1n;

export interface TickBook {
  bitmap: Map<number, bigint>;
  liquidityNet: Map<number, bigint>;
  liquidityGross: Map<number, bigint>;
}

export function emptyTickBook(): TickBook {
  return { bitmap: new Map(), liquidityNet: new Map(), liquidityGross: new Map() };
}

export function cloneTickBook(book: TickBook): TickBook {
  return {
    bitmap: new Map(book.bitmap),
    liquidityNet: new Map(book.liquidityNet),
    liquidityGross: new Map(book.liquidityGross),
  };
}

function wordAndBit(tick: number): { wordPos: number; bitPos: number } {
  const wordPos = Number(BigInt(tick) >> 8n);
  const mod = BigInt(tick) % 256n;
  const bitPos = Number(mod < 0n ? mod + 256n : mod);
  return { wordPos, bitPos };
}

function mostSignificantBit(x: bigint): number {
  if (x <= 0n) throw new Error("msb");
  return x.toString(2).length - 1;
}

function leastSignificantBit(x: bigint): number {
  if (x <= 0n) throw new Error("lsb");
  let value = x;
  let bit = 0;
  while ((value & 1n) === 0n) {
    value >>= 1n;
    bit += 1;
  }
  return bit;
}

export function flipTick(book: TickBook, tick: number, tickSpacing: number): void {
  if (tick % tickSpacing !== 0) throw new Error("tick spacing");
  const compressed = tick / tickSpacing;
  const { wordPos, bitPos } = wordAndBit(compressed);
  const mask = 1n << BigInt(bitPos);
  const next = ((book.bitmap.get(wordPos) ?? 0n) ^ mask) & WORD_MASK;
  if (next === 0n) book.bitmap.delete(wordPos);
  else book.bitmap.set(wordPos, next);
}

/** Sama dengan TickBitmap.nextInitializedTickWithinOneWord. */
export function nextInitializedTickWithinOneWord(
  book: TickBook,
  tick: number,
  tickSpacing: number,
  lte: boolean
): { next: number; initialized: boolean } {
  let compressed = Math.trunc(tick / tickSpacing);
  if (tick < 0 && tick % tickSpacing !== 0) compressed -= 1;

  if (lte) {
    const { wordPos, bitPos } = wordAndBit(compressed);
    const mask = (1n << BigInt(bitPos + 1)) - 1n;
    const masked = (book.bitmap.get(wordPos) ?? 0n) & mask;
    const initialized = masked !== 0n;
    const next = initialized
      ? (compressed - (bitPos - mostSignificantBit(masked))) * tickSpacing
      : (compressed - bitPos) * tickSpacing;
    return { next, initialized };
  }

  const { wordPos, bitPos } = wordAndBit(compressed + 1);
  const mask = (~((1n << BigInt(bitPos)) - 1n)) & WORD_MASK;
  const masked = (book.bitmap.get(wordPos) ?? 0n) & mask;
  const initialized = masked !== 0n;
  const next = initialized
    ? (compressed + 1 + (leastSignificantBit(masked) - bitPos)) * tickSpacing
    : (compressed + 1 + (255 - bitPos)) * tickSpacing;
  return { next, initialized };
}

export function installInitializedTick(
  book: TickBook,
  tick: number,
  tickSpacing: number,
  liquidityGross: bigint,
  liquidityNet: bigint
): void {
  if (liquidityGross <= 0n) return;
  const exists = (book.liquidityGross.get(tick) ?? 0n) > 0n;
  book.liquidityGross.set(tick, liquidityGross);
  book.liquidityNet.set(tick, liquidityNet);
  if (!exists) flipTick(book, tick, tickSpacing);
}

/** Tick kelipatan spacing di [current-radius, current+radius]. */
export function ticksInWindow(currentTick: number, tickSpacing: number, radius: number): number[] {
  if (tickSpacing <= 0 || radius < 0) return [];
  const low = currentTick - radius;
  const high = currentTick + radius;
  const start = alignUp(low, tickSpacing);
  const end = alignDown(high, tickSpacing);
  const ticks: number[] = [];
  for (let tick = start; tick <= end; tick += tickSpacing) ticks.push(tick);
  return ticks;
}

function alignUp(value: number, spacing: number): number {
  const base = Math.floor(value / spacing) * spacing;
  return base >= value ? base : base + spacing;
}

function alignDown(value: number, spacing: number): number {
  return Math.floor(value / spacing) * spacing;
}

/**
 * Mint/Burn: liquidityNet naik di tick bawah dan turun di tick atas.
 * Bitmap dibalik saat liquidityGross melewati nol.
 */
export function updateTickLiquidity(
  book: TickBook,
  tick: number,
  tickSpacing: number,
  liquidityDelta: bigint,
  upper: boolean
): void {
  const grossBefore = book.liquidityGross.get(tick) ?? 0n;
  const grossAfter = grossBefore + liquidityDelta;
  if (grossAfter < 0n) throw new Error("liquidityGross");
  const flipped = (grossAfter === 0n) !== (grossBefore === 0n);
  const netBefore = book.liquidityNet.get(tick) ?? 0n;
  const netAfter = upper ? netBefore - liquidityDelta : netBefore + liquidityDelta;
  if (grossAfter === 0n) {
    book.liquidityGross.delete(tick);
    book.liquidityNet.delete(tick);
  } else {
    book.liquidityGross.set(tick, grossAfter);
    book.liquidityNet.set(tick, netAfter);
  }
  if (flipped) flipTick(book, tick, tickSpacing);
}
