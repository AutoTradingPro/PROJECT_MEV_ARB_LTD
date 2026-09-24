/** Harga spot quote/base dari cadangan pool (mis. USDT per WBNB), sudah dinormalisasi desimal. */
export function spotPriceFromReserves(
  reserveQuote: bigint,
  reserveBase: bigint,
  quoteDecimals = 18,
  baseDecimals = 18
): number {
  if (reserveBase <= 0n || quoteDecimals < 0 || baseDecimals < 0) return 0;
  const scale = 1_000_000_000_000n;
  const numer = reserveQuote * 10n ** BigInt(Math.max(0, baseDecimals)) * scale;
  const denom = reserveBase * 10n ** BigInt(Math.max(0, quoteDecimals));
  if (denom <= 0n) return 0;
  const price = Number(numer / denom) / 1e12;
  if (!Number.isFinite(price) || price <= 0) {
    const quote = Number(reserveQuote) / 10 ** quoteDecimals;
    const base = Number(reserveBase) / 10 ** baseDecimals;
    if (!Number.isFinite(quote) || !Number.isFinite(base) || base <= 0) return 0;
    return quote / base;
  }
  return price;
}

export function liveSpotPrice(pool: {
  spotPrice?: number;
  reserveQuote: bigint;
  reserveBase: bigint;
  quoteDecimals: number;
  baseDecimals: number;
}): number {
  if (pool.spotPrice && Number.isFinite(pool.spotPrice) && pool.spotPrice > 0) {
    return pool.spotPrice;
  }
  return spotPriceFromReserves(
    pool.reserveQuote,
    pool.reserveBase,
    pool.quoteDecimals,
    pool.baseDecimals
  );
}

/** Nilai TVL kira-kira (kedua sisi) dalam USD. `quoteUsd` = harga 1 unit quote (1 untuk stable, ETH-USD untuk WETH). */
export function poolLiquidityUsd(
  reserveQuote: bigint,
  reserveBase: bigint,
  quoteDecimals = 18,
  baseDecimals = 18,
  quoteUsd = 1
): number {
  const quote = Number(reserveQuote) / 10 ** quoteDecimals;
  const price = spotPriceFromReserves(reserveQuote, reserveBase, quoteDecimals, baseDecimals);
  const baseUsd = (Number(reserveBase) / 10 ** baseDecimals) * price;
  if (!Number.isFinite(quote) || !Number.isFinite(baseUsd)) return 0;
  const unit = quoteUsd > 0 ? quoteUsd : 1;
  return Math.max(0, (quote + baseUsd) * unit);
}

export function formatUsdPrice(price: number | undefined): string {
  if (price === undefined || !Number.isFinite(price) || price <= 0) return "—";
  return `$${price.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

/** Spread harga murni: beli di DEX A, jual di DEX B → ((P_B - P_A) / P_A) dalam bps (boleh pecahan). */
export function spotSpreadBps(priceBuy: number, priceSell: number): number {
  if (!Number.isFinite(priceBuy) || !Number.isFinite(priceSell) || priceBuy <= 0 || priceSell <= 0) return 0;
  const bps = ((priceSell - priceBuy) / priceBuy) * 10_000;
  if (!Number.isFinite(bps)) return 0;
  return bps;
}

const STABLE_QUOTES = new Set(["USDT", "USDC", "DAI", "BUSD"]);

/** Nilai USD kira-kira per 1 unit token quote (USDT/USDC ≈ 1, WETH ≈ ethUsd). */
export function quoteTokenUsd(symbol: string, ethUsd: number, nativeUsd = ethUsd): number {
  const key = symbol.toUpperCase();
  if (STABLE_QUOTES.has(key)) return 1;
  if (key === "WETH" || key === "ETH") return ethUsd > 0 ? ethUsd : 0;
  if (key === "WMATIC" || key === "MATIC" || key === "POL") return nativeUsd > 0 ? nativeUsd : 0;
  if (key === "WBNB" || key === "BNB") return nativeUsd > 0 ? nativeUsd : 0;
  return 0;
}

export function isExtremeSpotSpread(spreadBps: number, maxAbsBps: number): boolean {
  return Math.abs(spreadBps) > maxAbsBps;
}

export function spreadColorClass(spreadBps: number, _minSpreadBps = 0): string {
  if (spreadBps < 0) return "text-red-400";
  if (spreadBps > 0) return "text-emerald-400";
  return "text-slate-400";
}
