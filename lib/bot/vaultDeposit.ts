import { MOCK_BNB_USD } from "@/lib/bot/bnbQuote";
import { DEFAULT_BOT_CONFIG } from "./constants";

/** Fallback harga BNB (USD) jika quote live belum tersedia. */
export const FALLBACK_BNB_USD = MOCK_BNB_USD;
/** Gas price BSC tipikal (gwei) jika RPC belum mengembalikan nilai. */
export const FALLBACK_GAS_PRICE_GWEI = 3;
/** Cadangan pengaman: deposit = (fee + gas) × 2 */
export const VAULT_DEPOSIT_SAFETY_MULTIPLIER = 2;

export interface VaultDepositEstimate {
  loanAmountUsd: number;
  aaveFeePct: number;
  flashFeeUsd: number;
  gasLimit: number;
  gasPriceGwei: number;
  gasBnb: number;
  gasUsd: number;
  baseUsd: number;
  totalUsd: number;
  safetyMultiplier: number;
  bnbAmount: number;
  usdtAmount: number;
}

function toFinite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function estimateVaultDeposit(input: {
  loanAmountUsd: number;
  aaveFeePct: number;
  gasLimit?: number;
  gasPriceWei?: string | bigint | null;
  bnbUsd?: number | null;
}): VaultDepositEstimate {
  const loanAmountUsd = Math.max(0, toFinite(input.loanAmountUsd, 0));
  const aaveFeePct = Math.max(0, toFinite(input.aaveFeePct, DEFAULT_BOT_CONFIG.aaveFeePct));
  const gasLimit = Math.max(1, Math.floor(toFinite(input.gasLimit ?? DEFAULT_BOT_CONFIG.gasLimit, DEFAULT_BOT_CONFIG.gasLimit)));
  const bnbUsd = input.bnbUsd && input.bnbUsd > 0 ? input.bnbUsd : FALLBACK_BNB_USD;

  let gasPriceWei = 0n;
  if (input.gasPriceWei != null && input.gasPriceWei !== "") {
    try {
      const parsed = BigInt(input.gasPriceWei);
      if (parsed > 0n) gasPriceWei = parsed;
    } catch {
      gasPriceWei = 0n;
    }
  }
  if (gasPriceWei <= 0n) {
    gasPriceWei = BigInt(Math.round(FALLBACK_GAS_PRICE_GWEI * 1e9));
  }

  const flashFeeUsd = loanAmountUsd * (aaveFeePct / 100);
  const gasBnb = Number(gasPriceWei * BigInt(gasLimit)) / 1e18;
  const gasUsd = gasBnb * bnbUsd;
  const baseUsd = flashFeeUsd + gasUsd;
  const totalUsd = baseUsd * VAULT_DEPOSIT_SAFETY_MULTIPLIER;
  const bnbAmount = bnbUsd > 0 ? totalUsd / bnbUsd : gasBnb * VAULT_DEPOSIT_SAFETY_MULTIPLIER;

  return {
    loanAmountUsd,
    aaveFeePct,
    flashFeeUsd,
    gasLimit,
    gasPriceGwei: Number(gasPriceWei) / 1e9,
    gasBnb,
    gasUsd,
    baseUsd,
    totalUsd,
    safetyMultiplier: VAULT_DEPOSIT_SAFETY_MULTIPLIER,
    bnbAmount,
    usdtAmount: totalUsd,
  };
}

export function formatDepositAmount(value: number, digits: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.?0+$/, "") || "0";
}
