/**
 * Konstanta Kamino K-Lend — aman untuk import client (tanpa Node/fs / QuickNode fetch).
 */
import { FLASH_FEE_PPM } from "@/src/flashloan/globalProviderSelector";

export const KAMINO_FLASH_CHAIN_ID = "solana" as const;

/** Program KLend (Kamino Lending) — Solana mainnet. */
export const KAMINO_KLEND_PROGRAM_ID = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";

export const KAMINO_FLASH_LOAN_SOURCE = KAMINO_KLEND_PROGRAM_ID;

/** 10 ppm = 0.001%. */
export const KAMINO_FLASH_FEE_PPM = FLASH_FEE_PPM.KAMINO;
export const KAMINO_FLASH_FEE_PCT = KAMINO_FLASH_FEE_PPM / 10_000;

/** 0.001% = principal × 10 / 1_000_000. */
export function kaminoFlashFeeWei(amountIn: bigint): bigint {
  if (amountIn <= 0n) return 0n;
  return (amountIn * BigInt(KAMINO_FLASH_FEE_PPM)) / 1_000_000n;
}

export function isKaminoFlashProvider(provider?: string | null): boolean {
  const id = (provider || "").toLowerCase();
  return id === "kamino" || id === "dydx";
}

/** Estimasi biaya flash borrow Kamino untuk nominal USD. */
export function kaminoFlashFeeUsd(loanAmountUsd: number): number {
  return (Number(loanAmountUsd) || 0) * (KAMINO_FLASH_FEE_PCT / 100);
}
