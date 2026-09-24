import { AAVE_FLASH_FEE_PCT, DEFAULT_BOT_CONFIG, MAX_SPOT_SPREAD_BPS, MIN_POOL_LIQUIDITY_USD } from "@/lib/bot/constants";

/** Kebijakan akuntansi platform (CaLK) — sumber tunggal untuk laporan owner. */
export const FINANCE_POLICY = {
  functionalCurrency: "IDR",
  basis: "akrual",
  framework: "5 Pilar Laporan Keuangan (adaptasi PSAK / IFRS untuk dApp custodial)",
  /** Bagian laba bersih eksekusi Mode Pro yang menjadi pendapatan platform. */
  platformProfitSharePct: 15,
  stakingAprPct: 8,
  stakingMinUsd: 100,
  stakingLockDays: 30,
  affiliateSharePct: 5,
  aaveFeePctFree: AAVE_FLASH_FEE_PCT.free,
  aaveFeePctPro: AAVE_FLASH_FEE_PCT.pro,
  minerTipPct: DEFAULT_BOT_CONFIG.minerTipPct,
  minSpreadPct: DEFAULT_BOT_CONFIG.minSpreadPct,
  slippageMode: "dynamic-offchain" as const,
  minProfitUsd: DEFAULT_BOT_CONFIG.minProfitUsd,
  minPoolLiquidityUsd: MIN_POOL_LIQUIDITY_USD,
  maxSpotSpreadBps: MAX_SPOT_SPREAD_BPS,
  policyVersion: "FR-2026.09",
} as const;

export type FinancePeriodId = "day" | "week" | "month" | "aug2026";

export const FINANCE_PERIODS: { id: FinancePeriodId; label: string }[] = [
  { id: "aug2026", label: "Agu–Sep 2026" },
  { id: "day", label: "Harian" },
  { id: "week", label: "Mingguan" },
  { id: "month", label: "Bulanan" },
];

export function parseFinancePeriod(raw: string | null | undefined): FinancePeriodId {
  if (raw === "day" || raw === "week" || raw === "month" || raw === "aug2026") return raw;
  return "aug2026";
}

export type FinancePillarId = "income" | "balance" | "cashflow" | "equity" | "notes";

export const FINANCE_PILLARS: { id: FinancePillarId; label: string; short: string }[] = [
  { id: "income", label: "Laporan Laba Rugi", short: "Laba Rugi" },
  { id: "balance", label: "Laporan Posisi Keuangan", short: "Neraca" },
  { id: "cashflow", label: "Laporan Arus Kas", short: "Arus Kas" },
  { id: "equity", label: "Laporan Perubahan Ekuitas", short: "Ekuitas" },
  { id: "notes", label: "Catatan atas Laporan Keuangan", short: "CaLK" },
];
