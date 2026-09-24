import type { PricingPlan, PricingPlanId } from "@/lib/pricing/plans";

export type PaymentMethodId = "card" | "crypto" | "bank";

export const USD_TO_IDR = 16_250;

export const CRYPTO_ASSETS = [
  { id: "usdt", symbol: "USDT", name: "Tether", network: "Ethereum / Tron" },
  { id: "usdc", symbol: "USDC", name: "USD Coin", network: "Ethereum / Solana" },
  { id: "eth", symbol: "ETH", name: "Ethereum", network: "Ethereum" },
  { id: "sol", symbol: "SOL", name: "Solana", network: "Solana" },
] as const;

export type CryptoAssetId = (typeof CRYPTO_ASSETS)[number]["id"];

export const TRANSFER_BANKS = [
  {
    id: "bca",
    name: "Bank Central Asia (BCA)",
    shortName: "BCA",
    vaPrefix: "8808",
  },
  {
    id: "mandiri",
    name: "Bank Mandiri",
    shortName: "Mandiri",
    vaPrefix: "88808",
  },
  {
    id: "bni",
    name: "Bank Negara Indonesia (BNI)",
    shortName: "BNI",
    vaPrefix: "9880",
  },
  {
    id: "bri",
    name: "Bank Rakyat Indonesia (BRI)",
    shortName: "BRI",
    vaPrefix: "0021",
  },
] as const;

export type TransferBankId = (typeof TRANSFER_BANKS)[number]["id"];

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatIdr(amountUsd: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.round(amountUsd * USD_TO_IDR));
}

export function bankDetailsForPlan(plan: PricingPlan, bankId: TransferBankId = "bca") {
  const suffix = plan.id.replace(/\D/g, "").padStart(2, "0") || "00";
  const bank = TRANSFER_BANKS.find((item) => item.id === bankId) ?? TRANSFER_BANKS[0];
  const amount = String(plan.priceUsd).padStart(4, "0");
  return {
    bank: bank.name,
    shortName: bank.shortName,
    accountName: "MEV ARB",
    virtualAccount: `${bank.vaPrefix} 1625 20${suffix} ${amount}`,
    note: `INV-${plan.id.toUpperCase()}-${bank.shortName.toUpperCase()}-2026`,
  };
}

export function checkoutCtaLabel(planId: PricingPlanId, processing: boolean): string {
  if (processing) return "Memproses…";
  if (planId === "free") return "Aktifkan Gratis";
  return "Proses Sekarang";
}
