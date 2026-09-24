/**
 * Konstanta Kamino K-Lend — aman untuk import client (tanpa Node/fs / QuickNode fetch).
 */
export const KAMINO_FLASH_CHAIN_ID = "solana" as const;

/** Program KLend (Kamino Lending) — Solana mainnet. */
export const KAMINO_KLEND_PROGRAM_ID = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";

export const KAMINO_FLASH_LOAN_SOURCE = KAMINO_KLEND_PROGRAM_ID;

/** Fee flash borrow Kamino K-Lend (persen) — 0.001%. */
export const KAMINO_FLASH_FEE_PCT = 0.001;

/** 0.001% = 1 / 100_000 dari principal (wei/lamports base units). */
export function kaminoFlashFeeWei(amountIn: bigint): bigint {
  if (amountIn <= 0n) return 0n;
  return amountIn / 100_000n;
}

export function isKaminoFlashProvider(provider?: string | null): boolean {
  const id = (provider || "").toLowerCase();
  return id === "kamino" || id === "dydx";
}

/** Estimasi biaya flash borrow Kamino untuk nominal USD. */
export function kaminoFlashFeeUsd(loanAmountUsd: number): number {
  return (Number(loanAmountUsd) || 0) * (KAMINO_FLASH_FEE_PCT / 100);
}
