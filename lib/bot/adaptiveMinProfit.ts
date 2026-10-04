/**
 * Ukuran loan dan target laba bersih, sama di setiap jaringan.
 * Loan V3 = 2% likuiditas pool, AMM = 3%. minProfit = 0,1% dari loan itu.
 * Biaya swap, gas, dan bribe dipotong dari net, bukan ditambahkan ke target.
 */

/** V3 / likuiditas terkonsentrasi: 2% pool. */
export const V3_LOAN_OF_POOL_RATIO = 0.02;
/** AMM cadangan tetap (x*y): 3% pool. */
export const AMM_LOAN_OF_POOL_RATIO = 0.03;
/** Default lama. V3 memakai 2%; AMM memakai `AMM_LOAN_OF_POOL_RATIO`. */
export const LOAN_OF_POOL_RATIO = V3_LOAN_OF_POOL_RATIO;

export function loanRatioForLiquidity(concentrated: boolean): number {
  return concentrated ? V3_LOAN_OF_POOL_RATIO : AMM_LOAN_OF_POOL_RATIO;
}
/** Target keuntungan bersih = 0,1% dari loan rute. */
export const MIN_PROFIT_OF_LOAN_RATIO = 0.001;

export const ADAPTIVE_MIN_PROFIT = {
  loanAnchorRatio: MIN_PROFIT_OF_LOAN_RATIO,
} as const;

export interface AdaptiveMinProfitInput {
  /** Diabaikan. Target tidak lagi membaca jangkar dolar yang tersimpan. */
  configMinProfitUsd?: number;
  gasCostUsd: number;
  bribeUsd?: number;
  bribePct?: number;
  spreadBps?: number;
  minSpreadBps?: number;
  extreme?: boolean;
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

/** Loan USD dari likuiditas pool. Rasio default 2% (V3); oper 0.03 untuk AMM. */
export function loanUsdFromPoolLiquidity(poolLiquidityUsd: number, ratio = LOAN_OF_POOL_RATIO): number {
  const liquidity = Number(poolLiquidityUsd);
  const used = Number.isFinite(ratio) && ratio > 0 ? ratio : LOAN_OF_POOL_RATIO;
  if (!Number.isFinite(liquidity) || liquidity <= 0) return 0;
  return liquidity * used;
}

/** minProfitUsd = loanAmountUsd × 0,1%. */
export function minProfitUsdFromLoan(loanAmountUsd: number): number {
  const loan = Number(loanAmountUsd);
  if (!Number.isFinite(loan) || loan <= 0) return 0;
  return loan * MIN_PROFIT_OF_LOAN_RATIO;
}

/** Nama lama. Isinya sekarang loan × 0,1%, bukan 0,60% dan bukan default $10.000. */
export function proportionalMinProfitAnchorUsd(loanAmountUsd: number): number {
  return minProfitUsdFromLoan(loanAmountUsd);
}

/** Sama untuk Solana: loan × 0,1%, tanpa lantai $5 dan tanpa loan default. */
export function solanaMinProfitFloorUsd(loanAmountUsd: number): number {
  return minProfitUsdFromLoan(loanAmountUsd);
}

/** Spread minimum mengikuti pengaturan chain, tanpa lantai Solana terpisah. */
export function solanaEffectiveMinSpreadPct(configuredPct: number): number {
  const configured = Number(configuredPct);
  if (!Number.isFinite(configured) || configured <= 0) return 0;
  return configured;
}

export function formatNetProfitSkip(netUsd: number, minProfitUsd: number): string {
  const net = Number.isFinite(netUsd) ? netUsd : 0;
  const target = Number.isFinite(minProfitUsd) ? minProfitUsd : 0;
  return `[SKIP] Net profit $${net.toFixed(3)} < target minProfitUsd $${target.toFixed(3)} (loan×0.10%).`;
}

export const NET_PROFIT_SKIP_REASON = "[SKIP] Net profit di bawah target minProfitUsd (loan×0.10%).";

function resolveLoanUsd(input: AdaptiveMinProfitInput): number {
  const loan = Number(input.loanAmountUsd);
  if (Number.isFinite(loan) && loan > 0) return loan;
  return 0;
}

export function resolveAdaptiveMinProfitUsd(input: AdaptiveMinProfitInput): AdaptiveMinProfit {
  const loan = resolveLoanUsd(input);
  const minProfitUsd = minProfitUsdFromLoan(loan);
  return {
    minProfitUsd,
    baseAnchorUsd: minProfitUsd,
    costFloorUsd: 0,
    configScale: 1,
    volMul: 1,
    reason: `minProfit=loan×0.10% ($${loan.toFixed(2)} → $${minProfitUsd.toFixed(3)})`,
  };
}
