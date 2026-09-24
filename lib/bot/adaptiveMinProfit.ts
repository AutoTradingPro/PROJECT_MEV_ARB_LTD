/**
 * Min profit EVM = max(Loan × 0.60%, costFloor gas+bribe).
 * 0.60% menutup ~2× fee DEX 0.30% (beli+jual) sebelum gas/bribe.
 *
 * Solana memakai lantai terpisah: max(Loan × 0.10%, $5) dan minSpread ≥ 0.65%.
 */
export const ADAPTIVE_MIN_PROFIT = {
  /** EVM: 0.60% dari loan (Loan × 0.006). */
  loanAnchorRatio: 0.006,
  /** Buffer di atas biaya gas aktual (anti fluktuasi fee L2). */
  gasCoverMul: 1.4,
  /** Pengali bribe ke lantai biaya (anti tip/slippage kilat). */
  bribeCoverMul: 1.25,
  /** Buffer tetap (USD) di atas gas+bribe. */
  dustUsd: 2.0,
} as const;

/** Lantai Solana — terpisah dari jangkar EVM. */
export const SOLANA_MIN_PROFIT = {
  /** Loan × 0.10%. */
  loanAnchorRatio: 0.001,
  /** Lantai absolut USD. */
  absoluteFloorUsd: 5.0,
  /** Spread minimum operasional Solana (%). */
  minSpreadPct: 0.65,
} as const;

export interface AdaptiveMinProfitInput {
  /** Cadangan lama; hanya dipakai jika loanAmountUsd kosong. */
  configMinProfitUsd?: number;
  /** Biaya gas aktual / estimasi dalam USD (gasLimit × gasPrice). */
  gasCostUsd: number;
  /** Estimasi bribe/tip dalam USD (0 jika sudah masuk gas EIP-1559). */
  bribeUsd?: number;
  /** Bribe % jika bribeUsd belum dihitung. */
  bribePct?: number;
  /** Spread rute saat itu (bps). */
  spreadBps?: number;
  /** Spread minimum operasional (bps). */
  minSpreadBps?: number;
  /** Mode Extreme: sedikit lebih ketat. */
  extreme?: boolean;
  /** Nominal pinjaman kilat (USD) — sumber jangkar EVM 0.60%. */
  loanAmountUsd?: number;
}

export interface AdaptiveMinProfit {
  minProfitUsd: number;
  baseAnchorUsd: number;
  costFloorUsd: number;
  configScale: number;
  volMul: number;
  reason: string;
}

function resolveLoanUsd(input: AdaptiveMinProfitInput): number {
  const loan = Number(input.loanAmountUsd);
  if (Number.isFinite(loan) && loan > 0) return loan;
  const fallback = Number(input.configMinProfitUsd);
  if (Number.isFinite(fallback) && fallback > 0) {
    return fallback / ADAPTIVE_MIN_PROFIT.loanAnchorRatio;
  }
  return 10_000;
}

/**
 * Jangkar EVM: 0.60% dari loan ($10k→$60, $20k→$120, $100k→$600).
 * Untuk Solana pakai `solanaMinProfitFloorUsd`.
 */
export function proportionalMinProfitAnchorUsd(loanAmountUsd: number): number {
  const loan = Number.isFinite(loanAmountUsd) && loanAmountUsd > 0 ? loanAmountUsd : 10_000;
  return loan * ADAPTIVE_MIN_PROFIT.loanAnchorRatio;
}

/** Solana: max(Loan × 0.10%, $5). */
export function solanaMinProfitFloorUsd(loanAmountUsd: number): number {
  const loan = Number.isFinite(loanAmountUsd) && loanAmountUsd > 0 ? loanAmountUsd : 10_000;
  return Math.max(loan * SOLANA_MIN_PROFIT.loanAnchorRatio, SOLANA_MIN_PROFIT.absoluteFloorUsd);
}

/** Solana: minSpreadPct efektif ≥ 0.65%. */
export function solanaEffectiveMinSpreadPct(configuredPct: number): number {
  const configured = Number.isFinite(configuredPct) && configuredPct > 0 ? configuredPct : 0;
  return Math.max(configured, SOLANA_MIN_PROFIT.minSpreadPct);
}

function resolveBribeUsd(input: AdaptiveMinProfitInput): number {
  if (typeof input.bribeUsd === "number" && Number.isFinite(input.bribeUsd) && input.bribeUsd > 0) {
    return input.bribeUsd;
  }
  const pct = Number(input.bribePct);
  const loan = Number(input.loanAmountUsd);
  const spreadBps = Number(input.spreadBps);
  if (Number.isFinite(pct) && pct > 0 && Number.isFinite(loan) && loan > 0 && Number.isFinite(spreadBps) && spreadBps > 0) {
    const gross = loan * (spreadBps / 10_000);
    return Math.max(0, gross * (pct / 100));
  }
  return 0;
}

/**
 * Ambang min profit USD EVM = max(Loan × 0.60%, costFloor).
 * costFloor = gas×1.4 + bribe×1.25 + $2.
 */
export function resolveAdaptiveMinProfitUsd(input: AdaptiveMinProfitInput): AdaptiveMinProfit {
  const loan = resolveLoanUsd(input);
  const baseAnchorUsd = proportionalMinProfitAnchorUsd(loan);
  const gas = Math.max(0, Number.isFinite(input.gasCostUsd) ? input.gasCostUsd : 0);
  const bribe = resolveBribeUsd(input);
  const costFloorUsd =
    gas * ADAPTIVE_MIN_PROFIT.gasCoverMul +
    bribe * ADAPTIVE_MIN_PROFIT.bribeCoverMul +
    ADAPTIVE_MIN_PROFIT.dustUsd;

  const adaptive = Math.max(baseAnchorUsd, costFloorUsd);
  const gatedByGas = adaptive > baseAnchorUsd + 1e-9;

  return {
    minProfitUsd: adaptive,
    baseAnchorUsd,
    costFloorUsd,
    configScale: 1,
    volMul: 1,
    reason:
      `minProfit=loan×0.60% ($${loan.toFixed(0)} → $${baseAnchorUsd.toFixed(3)})` +
      ` gas=$${gas.toFixed(3)} floor=$${costFloorUsd.toFixed(3)}` +
      (gatedByGas ? ` · gas floor menang → $${adaptive.toFixed(3)}` : ` → $${adaptive.toFixed(3)}`),
  };
}
