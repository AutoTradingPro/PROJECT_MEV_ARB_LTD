import { applySlippage, bpsOf } from "@/lib/bot/dexMath";
import { toEngineConfig } from "@/lib/bot/configUnits";
import type { BotConfig, Opportunity } from "@/lib/bot/types";

/**
 * Standar global eksekusi — target laba bersih = loan × 0.10% (10 bps).
 * amountOutMin mengambil haircut
 * slippage 0.5%–1.0% dari expectedOut agar rute Uniswap/Sushi tidak
 * revert SlippageExceeded hanya karena pergeseran harga mikro.
 */
export const GLOBAL_EXEC_MIN_PROFIT_BPS = 10;
export const ADAPTIVE_MIN_PROFIT_BPS_FLOOR = 10;
/** Toleransi slippage minimum (0.5%). */
export const ADAPTIVE_SLIPPAGE_BPS_FLOOR = 50;
/** Toleransi slippage maksimum (1.0%). */
export const ADAPTIVE_SLIPPAGE_BPS_CAP = 100;

export const DYNAMIC_SLIPPAGE = {
  minBps: ADAPTIVE_SLIPPAGE_BPS_FLOOR,
  minProfitBps: GLOBAL_EXEC_MIN_PROFIT_BPS,
  adaptiveMinProfitBpsFloor: ADAPTIVE_MIN_PROFIT_BPS_FLOOR,
  adaptiveSlippageBpsFloor: ADAPTIVE_SLIPPAGE_BPS_FLOOR,
  adaptiveSlippageBpsCap: ADAPTIVE_SLIPPAGE_BPS_CAP,
} as const;

function clampDecimals(decimals: number | undefined): number {
  if (!Number.isFinite(decimals)) return 18;
  return Math.max(0, Math.min(18, Math.floor(decimals as number)));
}

/** Spread + price impact (bps) sebagai proksi volatilitas rute. */
export function routeVolatilityBps(spreadBps: number, priceImpactPct?: number): number {
  const spread = Number.isFinite(spreadBps) ? Math.max(0, spreadBps) : 0;
  const impactBps = Number.isFinite(priceImpactPct) ? Math.max(0, Math.round((priceImpactPct as number) * 100)) : 0;
  return spread + impactBps;
}

/** Lantai laba (bps): 0,10% dari loan. */
export function adaptiveMinProfitBps(_spreadBps: number, _priceImpactPct?: number): number {
  return GLOBAL_EXEC_MIN_PROFIT_BPS;
}

/**
 * Haircut expectedOut (bps): ~35% dari spread + 60% impact,
 * diklem ke rentang 0.5%–1.0% agar bot tidak terlalu sensitif.
 */
export function adaptiveExpectedSlippageBps(spreadBps: number, priceImpactPct?: number): number {
  const spread = Number.isFinite(spreadBps) ? Math.max(0, spreadBps) : 0;
  const impactBps = Number.isFinite(priceImpactPct) ? Math.max(0, Math.round((priceImpactPct as number) * 100)) : 0;
  const raw = Math.round(spread * 0.35 + impactBps * 0.6);
  return Math.max(ADAPTIVE_SLIPPAGE_BPS_FLOOR, Math.min(ADAPTIVE_SLIPPAGE_BPS_CAP, raw));
}

export function impliedSlippageBps(expectedOut: bigint, minAmountOut: bigint): number {
  if (expectedOut <= 0n) return 0;
  if (minAmountOut >= expectedOut) return 0;
  const slipped = expectedOut - minAmountOut;
  const bps = Number((slipped * 10_000n) / expectedOut);
  return Number.isFinite(bps) ? Math.max(0, Math.floor(bps)) : 0;
}

export function minProfitWeiFromLoan(loanWei: bigint, minProfitBps = GLOBAL_EXEC_MIN_PROFIT_BPS): bigint {
  if (loanWei <= 0n) return 1n;
  const bps = BigInt(Math.max(0, Math.min(10_000, minProfitBps)));
  if (bps === 0n) return 0n;
  const profit = (loanWei * bps) / 10_000n;
  return profit > 0n ? profit : 1n;
}

/**
 * amountOutMin: pembagian integer ke bawah + buffer 1 wei (unit terkecil token)
 * agar USDC 6 desimal dan WETH 18 desimal tidak gagal karena round-up ke wei.
 */
export function floorAmountOutMin(amount: bigint, _decimals?: number): bigint {
  if (amount <= 1n) return 1n;
  return amount - 1n;
}

export function formatTokenWei(amount: bigint, decimals?: number): string {
  const dec = clampDecimals(decimals);
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const scale = 10n ** BigInt(dec);
  const whole = abs / scale;
  const frac = abs % scale;
  const fracStr = frac.toString().padStart(dec, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${fracStr ? `.${fracStr}` : ""}`;
}

export function globalExecFloorWei(input: {
  loanWei: bigint;
  repayWei: bigint;
  gasCostWei: bigint;
  minerTipWei: bigint;
  minProfitBps?: number;
}): { minAmountOut: bigint; minProfitWei: bigint } {
  const loan = input.loanWei > 0n ? input.loanWei : 0n;
  const minProfitWei = minProfitWeiFromLoan(loan, input.minProfitBps ?? GLOBAL_EXEC_MIN_PROFIT_BPS);
  const repay = input.repayWei > 0n ? input.repayWei : loan;
  const gas = input.gasCostWei > 0n ? input.gasCostWei : 0n;
  const tip = input.minerTipWei > 0n ? input.minerTipWei : 0n;
  const floor = repay + gas + tip + minProfitWei;
  return {
    minProfitWei,
    minAmountOut: floor > 1n ? floor : 1n,
  };
}

export function dynamicMinAmountOut(input: {
  expectedOut: bigint;
  repay: bigint;
  gasCost: bigint;
  minerTip: bigint;
  minProfit: bigint;
  loanWei?: bigint;
  spreadBps?: number;
  priceImpactPct?: number;
  quoteDecimals?: number;
}): { minAmountOut: bigint; slippageBps: number; minProfitWei: bigint; minProfitBps: number } {
  const loanWei = input.loanWei && input.loanWei > 0n ? input.loanWei : 0n;
  const spreadBps = input.spreadBps ?? 0;
  const minProfitBps = adaptiveMinProfitBps(spreadBps, input.priceImpactPct);
  const slipBps = adaptiveExpectedSlippageBps(spreadBps, input.priceImpactPct);
  const repay = input.repay > 0n ? input.repay : loanWei;
  const gas = input.gasCost > 0n ? input.gasCost : 0n;
  const tip = input.minerTip > 0n ? input.minerTip : 0n;
  const breakEvenRaw = repay + gas + tip;
  const breakEven = breakEvenRaw > 1n ? breakEvenRaw : 1n;
  const minProfitWei = minProfitWeiFromLoan(loanWei, minProfitBps);
  const profitFloor = breakEven + minProfitWei;
  const sold = input.expectedOut > 0n ? input.expectedOut : 0n;
  const fromExpected = sold > 0n ? applySlippage(sold, slipBps) : 0n;
  let minAmountOut = profitFloor;
  if (fromExpected > breakEven) {
    minAmountOut = fromExpected < profitFloor ? fromExpected : profitFloor;
  } else if (sold > breakEven) {
    minAmountOut = breakEven;
  }
  if (minAmountOut < breakEven) minAmountOut = breakEven;
  return {
    minAmountOut,
    minProfitWei,
    minProfitBps,
    slippageBps: impliedSlippageBps(sold, minAmountOut > sold && sold > 0n ? sold : minAmountOut),
  };
}

export function minAmountOutForExec(
  opp: Pick<
    Opportunity,
    | "amountInWei"
    | "amountOutWei"
    | "repayWei"
    | "gasCostWei"
    | "estimatedProfitWei"
    | "spreadBps"
    | "priceImpactPct"
    | "quoteDecimals"
  >,
  config: BotConfig,
  minerTipOverride?: bigint
): { minAmountOut: bigint; slippageBps: number; minProfitWei: bigint; minProfitBps: number } {
  const engine = toEngineConfig(config);
  const loanWei = BigInt(opp.amountInWei || "0");
  const expectedOut = BigInt(opp.amountOutWei || "0");
  const repay = BigInt(opp.repayWei || "0");
  const gasCost = BigInt(opp.gasCostWei || "0");
  const minerTip =
    minerTipOverride !== undefined
      ? minerTipOverride
      : bpsOf(BigInt(opp.estimatedProfitWei || "0"), engine.minerTipBps);
  return dynamicMinAmountOut({
    expectedOut,
    repay,
    gasCost,
    minerTip,
    minProfit: minProfitWeiFromLoan(loanWei),
    loanWei,
    spreadBps: opp.spreadBps,
    priceImpactPct: opp.priceImpactPct,
    quoteDecimals: opp.quoteDecimals,
  });
}

export function isSlippageLikeRevert(message: string): boolean {
  return /SlippageExceeded|Slippage Exceeded|INSUFFICIENT_OUTPUT_AMOUNT|InsufficientOutput/i.test(
    message || ""
  );
}

export function logSlippageExceededDetail(input: {
  expectedOut: bigint;
  amountOutMin: bigint;
  actualOut?: bigint | null;
  spreadBps: number;
  slippageBps: number;
  minProfitBps: number;
  quoteDecimals?: number;
  quoteSymbol?: string;
  routerSell?: string;
  buyDex?: string;
  sellDex?: string;
  cooldownMs?: number;
}): void {
  const dec = clampDecimals(input.quoteDecimals);
  const symbol = input.quoteSymbol || "quote";
  const expected = input.expectedOut;
  const minOut = input.amountOutMin;
  const actual = input.actualOut;
  const headroom = expected > minOut ? expected - minOut : 0n;
  const headroomBps = impliedSlippageBps(expected, minOut);
  const cooldown = input.cooldownMs ?? 8_000;
  const expectedFmt = `${expected.toString()} (${formatTokenWei(expected, dec)} ${symbol})`;
  const minFmt = `${minOut.toString()} (${formatTokenWei(minOut, dec)} ${symbol})`;

  console.warn(
    `[SLIPPAGE] ${input.buyDex || "?"}→${input.sellDex || "?"} routerSell=${input.routerSell || "?"} ` +
      `spread=${(Number.isFinite(input.spreadBps) ? input.spreadBps / 100 : 0).toFixed(3)}% ` +
      `adaptiveHaircut=${input.slippageBps}bps (floor ${ADAPTIVE_SLIPPAGE_BPS_FLOOR}–cap ${ADAPTIVE_SLIPPAGE_BPS_CAP}) ` +
      `minProfit=${input.minProfitBps}bps · jeda ${Math.round(cooldown / 1000)}s`
  );
  console.warn(`[SLIPPAGE] COMPARE expectedOut=${expectedFmt}`);
  console.warn(`[SLIPPAGE] COMPARE amountOutMin=${minFmt} · headroom=${headroom.toString()} (${headroomBps} bps vs expected)`);

  if (actual != null && actual !== undefined) {
    const vsExpected = expected - actual;
    const vsMin = actual - minOut;
    const shortfallBps =
      expected > 0n && actual < expected
        ? Number(((expected - actual) * 10_000n) / expected)
        : 0;
    const passedMin = actual >= minOut;
    console.warn(
      `[SLIPPAGE] COMPARE actualOut=${actual.toString()} (${formatTokenWei(actual, dec)} ${symbol}) ` +
        `deltaExpected=${vsExpected.toString()} (${shortfallBps} bps below expected) ` +
        `deltaMin=${vsMin.toString()} (${passedMin ? "lolos min" : "GAGAL vs amountOutMin"})`
    );
  } else {
    console.warn(
      "[SLIPPAGE] COMPARE actualOut=<tidak tersedia di payload revert> — bandingkan expectedOut vs amountOutMin di atas"
    );
  }
}
