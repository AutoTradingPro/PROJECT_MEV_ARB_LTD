import type { LivePool } from "@/lib/bot/reserves";
import { v3SqrtPriceToQuotePerBase } from "@/lib/bot/uniswapV3Fee";
import { tickSpacingForFee } from "@/scanner/localQuote";
import type { V3QuotePool } from "@/scanner/v3/swap";
import { emptyTickBook, updateTickLiquidity } from "@/scanner/v3/tickBitmap";
import { applyLiquidityDelta } from "@/scanner/v3/sqrtPriceMath";

export interface TrackedPool {
  key: string;
  address: string;
  kind: "v2" | "v3";
  base: string;
  quote: string;
  tick?: number;
  sqrtPriceX96?: bigint;
  v3?: V3QuotePool;
  pool: LivePool;
}

export class ReserveBook {
  private readonly byAddress = new Map<string, TrackedPool[]>();
  blockNumber = 0;
  dirty = false;

  clear(): void {
    this.byAddress.clear();
    this.dirty = false;
  }

  /** Salinan untuk kalkulasi. Mutasi log berikutnya tidak mengubah snapshot ini. */
  snapshot(): Map<string, LivePool> {
    const map = new Map<string, LivePool>();
    for (const entries of this.byAddress.values()) {
      for (const entry of entries) {
        map.set(entry.key, {
          ...entry.pool,
          sqrtPriceX96: entry.sqrtPriceX96 ?? entry.pool.sqrtPriceX96,
          tick: entry.tick ?? entry.pool.tick,
          v3Quote: entry.v3
            ? {
                ...entry.v3,
                ticks: {
                  bitmap: new Map(entry.v3.ticks.bitmap),
                  liquidityNet: new Map(entry.v3.ticks.liquidityNet),
                  liquidityGross: new Map(entry.v3.ticks.liquidityGross),
                },
              }
            : entry.pool.v3Quote,
        });
      }
    }
    return map;
  }

  addresses(): string[] {
    return [...this.byAddress.keys()];
  }

  size(): number {
    let count = 0;
    for (const entries of this.byAddress.values()) count += entries.length;
    return count;
  }

  replace(entries: TrackedPool[]): void {
    this.byAddress.clear();
    for (const entry of entries) this.add(entry);
    this.dirty = true;
  }

  private add(entry: TrackedPool): void {
    const address = entry.address.toLowerCase();
    const list = this.byAddress.get(address) ?? [];
    const index = list.findIndex((item) => item.key === entry.key);
    if (index >= 0) list[index] = entry;
    else list.push(entry);
    this.byAddress.set(address, list);
  }

  applySync(poolAddress: string, reserve0: bigint, reserve1: bigint): boolean {
    const list = this.byAddress.get(poolAddress.toLowerCase());
    if (!list || list.length === 0) return false;
    let changed = false;
    for (const entry of list) {
      if (entry.kind !== "v2") continue;
      const quoteIsToken0 = entry.pool.quoteIsToken0;
      const reserveQuote = quoteIsToken0 ? reserve0 : reserve1;
      const reserveBase = quoteIsToken0 ? reserve1 : reserve0;
      if (reserveBase <= 0n || reserveQuote <= 0n) continue;
      entry.pool = {
        ...entry.pool,
        reserveBase,
        reserveQuote,
        spotPrice: undefined,
        tvlReliable: true,
      };
      changed = true;
    }
    if (changed) this.dirty = true;
    return changed;
  }

  applyV3Swap(
    poolAddress: string,
    update: { sqrtPriceX96: bigint; liquidity: bigint; tick: number }
  ): boolean {
    const list = this.byAddress.get(poolAddress.toLowerCase());
    if (!list || list.length === 0) return false;
    let changed = false;
    for (const entry of list) {
      if (entry.kind !== "v3") continue;
      const price = v3SqrtPriceToQuotePerBase({
        sqrtPriceX96: update.sqrtPriceX96,
        token0: entry.pool.token0,
        base: entry.base,
        quote: entry.quote,
        baseDecimals: entry.pool.baseDecimals,
        quoteDecimals: entry.pool.quoteDecimals,
      });
      entry.tick = update.tick;
      entry.sqrtPriceX96 = update.sqrtPriceX96;
      const feePips = entry.pool.v3Fee ?? Number(entry.pool.feeBps) * 100;
      const v3 = entry.v3 ?? {
        sqrtPriceX96: update.sqrtPriceX96,
        tick: update.tick,
        liquidity: update.liquidity,
        feePips,
        tickSpacing: tickSpacingForFee(feePips),
        ticks: emptyTickBook(),
      };
      v3.sqrtPriceX96 = update.sqrtPriceX96;
      v3.tick = update.tick;
      v3.liquidity = update.liquidity;
      entry.v3 = v3;
      entry.pool = {
        ...entry.pool,
        liquidity: update.liquidity,
        sqrtPriceX96: update.sqrtPriceX96,
        tick: update.tick,
        spotPrice: price > 0 ? price : entry.pool.spotPrice,
        v3Quote: v3,
      };
      changed = true;
    }
    if (changed) this.dirty = true;
    return changed;
  }

  applyV3Liquidity(
    poolAddress: string,
    update: { tickLower: number; tickUpper: number; liquidityDelta: bigint }
  ): boolean {
    const list = this.byAddress.get(poolAddress.toLowerCase());
    if (!list || list.length === 0) return false;
    let changed = false;
    for (const entry of list) {
      if (entry.kind !== "v3" || !entry.v3) continue;
      try {
        const spacing = entry.v3.tickSpacing;
        updateTickLiquidity(entry.v3.ticks, update.tickLower, spacing, update.liquidityDelta, false);
        updateTickLiquidity(entry.v3.ticks, update.tickUpper, spacing, update.liquidityDelta, true);
        const current = entry.v3.tick;
        if (current >= update.tickLower && current < update.tickUpper) {
          entry.v3.liquidity = applyLiquidityDelta(entry.v3.liquidity, update.liquidityDelta);
          entry.pool = { ...entry.pool, liquidity: entry.v3.liquidity, v3Quote: entry.v3 };
        }
        changed = true;
      } catch {
        /* tick di luar spacing diabaikan */
      }
    }
    if (changed) this.dirty = true;
    return changed;
  }
}
