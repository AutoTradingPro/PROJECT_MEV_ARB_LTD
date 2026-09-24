import { tokenWeiToUsd, stableWeiToUsd } from "@/lib/bot/configUnits";
import type { Opportunity } from "@/lib/bot/types";

/** Harga mock rata-rata BNB (USD) untuk konversi profit Testnet / tampilan BNB. */
export const MOCK_BNB_USD = 600;
export const MOCK_ETH_USD = 3500;
export const MOCK_POL_USD = 0.45;

export function nativeUsdPrice(symbol: string): number {
  const key = symbol.toUpperCase();
  if (key === "ETH") return MOCK_ETH_USD;
  if (key === "POL" || key === "MATIC") return MOCK_POL_USD;
  return MOCK_BNB_USD;
}

export function usdToBnb(usd: number, bnbUsd = MOCK_BNB_USD): number {
  const px = Number.isFinite(bnbUsd) && bnbUsd > 0 ? bnbUsd : MOCK_BNB_USD;
  if (!Number.isFinite(usd)) return 0;
  return usd / px;
}

export function usdToNative(usd: number, symbol: string): number {
  return usdToBnb(usd, nativeUsdPrice(symbol));
}

export function formatNativeAmount(amount: number, symbol: string, digits = 4): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(digits)} ${symbol}`;
}

export function formatBnbAmount(bnb: number, digits = 4): string {
  return formatNativeAmount(bnb, "BNB", digits);
}

/** Konversi nominal USD → label BNB (`5.23` USD → `0.0087 BNB` pada $600/BNB). */
export function formatUsdAsBnb(usd: number, digits = 4, symbol = "BNB"): string {
  return formatNativeAmount(usdToNative(usd, symbol), symbol, digits);
}

/** `netProfitWei` sandbox/engine memakai 18 desimal USDT, bukan wei native. */
export function formatStableWeiAsBnb(wei: string | bigint, digits = 4, symbol = "BNB"): string {
  return formatUsdAsBnb(stableWeiToUsd(wei), digits, symbol);
}

/** Label laba dari wei token quote on-chain (WETH 18 / USDC 6), bukan asumsi USDT-18 → BNB. */
export function formatOpportunityNet(
  opp: Pick<Opportunity, "netProfitWei" | "quoteDecimals" | "quoteUsd">,
  digits = 4,
  symbol = "BNB"
): string {
  const usd = tokenWeiToUsd(opp.netProfitWei || "0", opp.quoteDecimals ?? 18, opp.quoteUsd ?? 1);
  if (usd > 0) return formatUsdAsBnb(usd, digits, symbol);
  return formatStableWeiAsBnb(opp.netProfitWei || "0", digits, symbol);
}
