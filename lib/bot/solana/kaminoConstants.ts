/**
 * Konstanta Kamino K-Lend — aman untuk import client (tanpa Node/fs / QuickNode fetch).
 */
import bs58 from "bs58";
import { FLASH_FEE_PPM } from "@/src/flashloan/globalProviderSelector";

export const KAMINO_FLASH_CHAIN_ID = "solana" as const;

/** Program KLend (Kamino Lending) — Solana mainnet. */
export const KAMINO_KLEND_PROGRAM_ID = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";

export const KAMINO_FLASH_LOAN_SOURCE = KAMINO_KLEND_PROGRAM_ID;

/** 10 ppm = 0.001%. */
export const KAMINO_FLASH_FEE_PPM = FLASH_FEE_PPM.KAMINO;
export const KAMINO_FLASH_FEE_PCT = KAMINO_FLASH_FEE_PPM / 10_000;

function isSolanaProgramId(value: string): boolean {
  try {
    return bs58.decode(value).length === 32;
  } catch {
    return false;
  }
}

/**
 * Target instruksi flash loan.
 * `SOLANA_EXECUTOR_PROGRAM_ID` atau `NEXT_PUBLIC_SOLANA_PROGRAM_ID` menang bila terisi
 * dan berupa pubkey. Keduanya kosong atau tidak valid → Kamino K-Lend.
 */
export function resolveSolanaExecutorProgramId(): string {
  const fromExecutor = (process.env.SOLANA_EXECUTOR_PROGRAM_ID ?? "").trim();
  if (isSolanaProgramId(fromExecutor)) return fromExecutor;
  const fromPublic = (process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID ?? "").trim();
  if (isSolanaProgramId(fromPublic)) return fromPublic;
  return KAMINO_KLEND_PROGRAM_ID;
}

/** 0.001% dari pokok, dibulatkan ke atas agar repay menutup fee protokol. */
export function kaminoFlashFeeWei(amountIn: bigint): bigint {
  if (amountIn <= 0n) return 0n;
  const ppm = BigInt(KAMINO_FLASH_FEE_PPM);
  const denom = 1_000_000n;
  return (amountIn * ppm + denom - 1n) / denom;
}

export type KaminoFlashCycle = {
  borrowAmount: bigint;
  feeAmount: bigint;
  repayAmount: bigint;
  amountOut: bigint;
  netProfit: bigint;
};

/** Net = hasil jual − (borrow + fee). Nol bila hasil tidak menutup repay. */
export function quoteKaminoFlashCycle(input: {
  borrowAmount: bigint;
  amountOut: bigint;
}): KaminoFlashCycle {
  const borrowAmount = input.borrowAmount > 0n ? input.borrowAmount : 0n;
  const feeAmount = kaminoFlashFeeWei(borrowAmount);
  const repayAmount = borrowAmount + feeAmount;
  const amountOut = input.amountOut > 0n ? input.amountOut : 0n;
  const netProfit = amountOut > repayAmount ? amountOut - repayAmount : 0n;
  return { borrowAmount, feeAmount, repayAmount, amountOut, netProfit };
}

export function isKaminoFlashProvider(provider?: string | null): boolean {
  const id = (provider || "").toLowerCase();
  return id === "kamino" || id === "dydx";
}

/** Estimasi biaya flash borrow Kamino untuk nominal USD. */
export function kaminoFlashFeeUsd(loanAmountUsd: number): number {
  return (Number(loanAmountUsd) || 0) * (KAMINO_FLASH_FEE_PCT / 100);
}
