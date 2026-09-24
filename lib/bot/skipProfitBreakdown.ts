import { resolveAdaptiveMinProfitUsd } from "@/lib/bot/adaptiveMinProfit";
import { tokenWeiToUsd } from "@/lib/bot/configUnits";
import { nativeUsdPrice } from "@/lib/bot/bnbQuote";
import { DEX_ROUTES, flashLoanFeePctForProvider } from "@/lib/bot/dexRegistry";
import {
  defaultFlashLoanPlatforms,
  flashLoanProviderLabel,
  resolveFlashLoanFeePct,
} from "@/lib/bot/flashLoanProviders";
import { nativeSymbolForChain } from "@/lib/bot/signerBalances";
import { networkScanTag } from "@/lib/bot/autoExecute";
import type { BotConfig, DexId, FlashLoanProviderId, Opportunity } from "@/lib/bot/types";
import type { ChainId } from "@/lib/chain/networks";

export type SkipProfitPhase = "skip" | "fail" | "exec";

/** Status keputusan evaluasi rute untuk log [FINANCIAL BREAKDOWN]. */
export type FinancialDecisionStatus =
  | "DISEKUSI"
  | "SKIP_PROFIT_RENDAH"
  | "REVERT_PREFLIGHT"
  | "REVERT_ONCHAIN"
  | "SKIP_LAIN";

export interface SkipProfitBreakdown {
  pair: string;
  buyDex: string;
  sellDex: string;
  spreadBps: number;
  spreadPct: number;
  loanUsd: number;
  loanToken: string;
  grossUsd: number;
  buyFeePct: number;
  sellFeePct: number;
  buyFeeUsd: number;
  sellFeeUsd: number;
  swapFeeUsd: number;
  flashProvider: string;
  flashFeePct: number;
  premiumUsd: number;
  gasNative: number;
  gasUsd: number;
  nativeSymbol: string;
  minerTipUsd: number;
  netUsd: number;
  engineNetUsd: number;
  floorUsd: number;
  deficitUsd: number;
  decisionNetUsd: number;
}

export interface SkipProfitBreakdownInput {
  opp: Partial<Opportunity> & {
    amountInWei?: string;
    netProfitWei?: string;
    spreadBps?: number;
    gasCostWei?: string;
  };
  config?: Partial<BotConfig> | null;
  liveGasWei?: bigint | string | number;
  gasLimit?: number;
  nativeUsd?: number;
  chainId?: string;
  headline?: string;
  phase?: SkipProfitPhase;
  /** Status keputusan eksplisit; jika kosong diinfer dari phase/headline. */
  decisionStatus?: FinancialDecisionStatus;
  /** Pesan mentah skip / preflight / revert untuk baris Alasan Detail. */
  detailReason?: string;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function formatUsd(value: number, digits = 3): string {
  const n = finite(value);
  const abs = Math.abs(n);
  const text = abs.toFixed(digits);
  return `${n < 0 ? "-" : ""}$${text}`;
}

function formatPct(value: number, digits = 3): string {
  return `${finite(value).toFixed(digits)}%`;
}

function v3FeeToPct(fee?: number): number | null {
  if (typeof fee !== "number" || !Number.isFinite(fee) || fee <= 0) return null;
  return fee / 10_000;
}

function registryFeePct(dexId?: DexId): number {
  const bps = DEX_ROUTES.find((item) => item.id === dexId)?.feeBps;
  if (typeof bps !== "number" || !Number.isFinite(bps) || bps < 0) return 0.3;
  return bps / 100;
}

function dexSwapFeePct(
  dexId: DexId | undefined,
  poolFee?: number,
  scanPct?: number
): number {
  const fromV3 = v3FeeToPct(poolFee);
  if (fromV3 != null) return fromV3;
  if (typeof scanPct === "number" && Number.isFinite(scanPct) && scanPct > 0) return scanPct;
  return registryFeePct(dexId);
}

function asBigInt(value: bigint | string | number | undefined): bigint {
  if (typeof value === "bigint") return value < 0n ? 0n : value;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    try {
      return BigInt(Math.floor(value));
    } catch {
      return 0n;
    }
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = BigInt(value);
      return parsed < 0n ? 0n : parsed;
    } catch {
      return 0n;
    }
  }
  return 0n;
}

function nativeGasAmount(gasPriceWei: bigint, gasLimit: bigint): number {
  if (gasPriceWei <= 0n || gasLimit <= 0n) return 0;
  return (Number(gasPriceWei) / 1e18) * Number(gasLimit);
}

function resolveFlashFee(config: Partial<BotConfig> | null | undefined, opp: Opportunity): {
  providerId: FlashLoanProviderId | undefined;
  feePct: number;
  label: string;
} {
  const provider = config?.flashLoanProvider;
  if (config?.flashLoanPlatforms && provider) {
    const resolved = resolveFlashLoanFeePct(config.flashLoanPlatforms, provider, {
      aaveFeePct: config.aaveFeePct,
      uniswapPoolFeePct: opp.uniswapPoolFeePct,
    });
    return {
      providerId: resolved.providerId,
      feePct: resolved.feePct,
      label: flashLoanProviderLabel(resolved.providerId),
    };
  }
  if (provider) {
    return {
      providerId: provider,
      feePct: flashLoanFeePctForProvider(provider, opp.uniswapPoolFeePct),
      label: flashLoanProviderLabel(provider),
    };
  }
  const platforms = defaultFlashLoanPlatforms();
  const resolved = resolveFlashLoanFeePct(platforms, "balancer", {
    uniswapPoolFeePct: opp.uniswapPoolFeePct,
  });
  return {
    providerId: resolved.providerId,
    feePct: resolved.feePct,
    label: flashLoanProviderLabel(resolved.providerId),
  };
}

export function computeSkipProfitBreakdown(input: SkipProfitBreakdownInput): SkipProfitBreakdown {
  const { opp, config } = input;
  const decimals = opp.quoteDecimals ?? 18;
  const quoteUsd = opp.quoteUsd ?? 1;
  const loanFromWei = tokenWeiToUsd(opp.amountInWei || "0", decimals, quoteUsd);
  const loanUsd =
    loanFromWei > 0
      ? loanFromWei
      : finite(Number(config?.loanAmountUsd), 0) > 0
        ? Number(config?.loanAmountUsd)
        : 0;
  const spreadBps = finite(opp.spreadBps);
  const spreadPct = spreadBps / 100;
  const grossUsd = loanUsd * (spreadBps / 10_000);
  const buyFeePct = dexSwapFeePct(opp.buyDex, opp.buyPoolFee, opp.scanPoolFeePct);
  const sellFeePct = dexSwapFeePct(opp.sellDex, opp.sellPoolFee);
  const buyFeeUsd = loanUsd * (buyFeePct / 100);
  const sellNotional = Math.max(0, loanUsd - buyFeeUsd + grossUsd);
  const sellFeeUsd = sellNotional * (sellFeePct / 100);
  const swapFeeUsd = buyFeeUsd + sellFeeUsd;
  const flash = resolveFlashFee(config, opp);
  const premiumUsd = loanUsd * (flash.feePct / 100);

  const chainId = (input.chainId || opp.chainId || config?.chainId || "ethereum") as ChainId;
  const nativeSymbol = nativeSymbolForChain(chainId);
  const gasLimit = BigInt(
    Math.max(21_000, Math.floor(input.gasLimit || config?.gasLimit || 650_000))
  );
  const liveGas = asBigInt(input.liveGasWei);
  const quoteGasUsd = tokenWeiToUsd(opp.gasCostWei || "0", decimals, quoteUsd);
  const nativeUsd =
    input.nativeUsd && input.nativeUsd > 0 ? input.nativeUsd : nativeUsdPrice(nativeSymbol);
  const gasNativeLive = nativeGasAmount(liveGas, gasLimit);
  const gasUsdLive = gasNativeLive > 0 && nativeUsd > 0 ? gasNativeLive * nativeUsd : 0;
  const gasUsd = gasUsdLive > 0 ? gasUsdLive : quoteGasUsd;
  const gasNative =
    gasNativeLive > 0 ? gasNativeLive : nativeUsd > 0 ? gasUsd / nativeUsd : 0;

  const minerTipPct = finite(Number(config?.dynamicBribePercent ?? config?.minerTipPct));
  const minerTipUsd = Math.max(0, grossUsd) * (minerTipPct / 100);
  const netUsd = grossUsd - swapFeeUsd - premiumUsd - gasUsd - minerTipUsd;
  const engineNetUsd = tokenWeiToUsd(opp.netProfitWei || "0", decimals, quoteUsd);
  const adaptiveFloor = resolveAdaptiveMinProfitUsd({
    loanAmountUsd: loanUsd,
    gasCostUsd: gasUsd,
    bribePct: minerTipPct,
    spreadBps,
  });
  const floorUsd = adaptiveFloor.minProfitUsd;
  const decisionNetUsd = engineNetUsd;
  const deficitUsd = Math.max(0, floorUsd - decisionNetUsd);

  return {
    pair: opp.tokenPair || "—",
    buyDex: opp.dexAName || opp.buyExchange || String(opp.buyDex || "DEX beli"),
    sellDex: opp.dexBName || opp.sellExchange || String(opp.sellDex || "DEX jual"),
    spreadBps,
    spreadPct,
    loanUsd,
    loanToken: opp.tokenIn || "quote",
    grossUsd,
    buyFeePct,
    sellFeePct,
    buyFeeUsd,
    sellFeeUsd,
    swapFeeUsd,
    flashProvider: flash.label,
    flashFeePct: flash.feePct,
    premiumUsd,
    gasNative,
    gasUsd,
    nativeSymbol,
    minerTipUsd,
    netUsd,
    engineNetUsd,
    floorUsd,
    deficitUsd,
    decisionNetUsd,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function skipProfitTelegramDedupeKey(input: SkipProfitBreakdownInput): string {
  const math = computeSkipProfitBreakdown(input);
  const chain = input.chainId || input.config?.chainId || "—";
  const phase =
    input.phase === "fail" ? "fail" : input.phase === "exec" ? "exec" : "skip";
  return `${phase}:${chain}:${math.pair}:${math.buyDex}->${math.sellDex}`;
}

/** Pesan HTML Telegram: jaringan/rute, spread+loan, biaya, net vs lantai max(loan×0.60%,costFloor). */
export function formatSkipProfitTelegramHtml(input: SkipProfitBreakdownInput): string {
  const math = computeSkipProfitBreakdown(input);
  const network = networkScanTag(input.chainId || input.config?.chainId, false);
  const phase = input.phase === "fail" ? "fail" : "skip";
  const title = phase === "fail" ? "❌ <b>Gagal eksekusi</b>" : "⏭ <b>SKIP — peluang dilewati</b>";
  const vsFloor =
    math.deficitUsd > 1e-9
      ? `Defisit: <b>${escapeHtml(formatUsd(math.deficitUsd))}</b>`
      : `Surplus vs lantai: ${escapeHtml(formatUsd(math.decisionNetUsd - math.floorUsd))}`;
  const headline = (input.headline || "").replace(/\s+/g, " ").trim().slice(0, 280);
  return [
    `${title}`,
    `<i>MEV Flash Loan · ${escapeHtml(network)}</i>`,
    "",
    "<b>1. Jaringan &amp; rute</b>",
    escapeHtml(`${network} — ${math.buyDex} → ${math.sellDex}`),
    `Pair: ${escapeHtml(math.pair)}`,
    "",
    "<b>2. Spread &amp; loan</b>",
    `Spread: <b>${escapeHtml(formatPct(math.spreadPct))}</b>`,
    `Loan: <b>${escapeHtml(formatUsd(math.loanUsd, 2))} ${escapeHtml(math.loanToken)}</b>`,
    `Gross (loan × spread): ${escapeHtml(formatUsd(math.grossUsd))}`,
    "",
    "<b>3. Breakdown biaya</b>",
    `Fee DEX: <b>${escapeHtml(formatUsd(math.swapFeeUsd))}</b>`,
    `  beli ${escapeHtml(math.buyDex)} ${escapeHtml(formatPct(math.buyFeePct))} ${escapeHtml(formatUsd(math.buyFeeUsd))}`,
    `  jual ${escapeHtml(math.sellDex)} ${escapeHtml(formatPct(math.sellFeePct))} ${escapeHtml(formatUsd(math.sellFeeUsd))}`,
    `Premi flash: <b>${escapeHtml(formatUsd(math.premiumUsd))}</b> (${escapeHtml(math.flashProvider)} ${escapeHtml(formatPct(math.flashFeePct, 2))})`,
    `Gas estimasi: <b>${escapeHtml(`${finite(math.gasNative).toFixed(6)} ${math.nativeSymbol}`)}</b> (~${escapeHtml(formatUsd(math.gasUsd))})`,
    "",
    "<b>4. Net vs lantai (max loan×0.60% / costFloor)</b>",
    `Net model: ${escapeHtml(formatUsd(math.netUsd))}`,
    `Net engine: ${escapeHtml(formatUsd(math.engineNetUsd))}`,
    `Lantai minimum: <b>${escapeHtml(formatUsd(math.floorUsd))}</b>`,
    vsFloor,
    headline ? `\n<b>Alasan</b>\n${escapeHtml(headline)}` : "",
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n");
}

function inferDecisionStatus(input: SkipProfitBreakdownInput): FinancialDecisionStatus {
  if (input.decisionStatus) return input.decisionStatus;
  const text = `${input.headline || ""} ${input.detailReason || ""}`;
  if (input.phase === "exec") return "DISEKUSI";
  if (/pre-?flight|PREFLIGHT|belum di-broadcast/i.test(text)) return "REVERT_PREFLIGHT";
  if (/execution reverted|Tx Hash|REVERT/i.test(text) && input.phase === "fail") {
    return "REVERT_ONCHAIN";
  }
  if (/Net profit di bawah lantai|Profit terlalu kecil|SKIP.*lantai|loan×0\.60%|minProfitUsd/i.test(text)) {
    return "SKIP_PROFIT_RENDAH";
  }
  if (input.phase === "skip") return "SKIP_LAIN";
  if (input.phase === "fail") return "REVERT_ONCHAIN";
  return "SKIP_LAIN";
}

function formatSignedUsd(value: number, digits = 3): string {
  const n = finite(value);
  const abs = Math.abs(n).toFixed(digits);
  if (n < 0) return `-$${abs}`;
  return `$${abs}`;
}

function formatDeductionUsd(value: number, digits = 3): string {
  const n = Math.abs(finite(value));
  return `-$${n.toFixed(digits)}`;
}

/**
 * Rincian finansial rute: loan, gross, potongan, net vs lantai, status keputusan.
 * Dipakai untuk skip profit rendah, preflight revert, dan eksekusi sukses.
 */
export function formatFinancialBreakdownLines(input: SkipProfitBreakdownInput): string[] {
  const math = computeSkipProfitBreakdown(input);
  const status = inferDecisionStatus(input);
  const spreadSign = math.spreadPct >= 0 ? "+" : "";
  const netForDecision =
    Math.abs(math.engineNetUsd) > 1e-12 ? math.engineNetUsd : math.netUsd;
  const vsFloor =
    netForDecision + 1e-12 >= math.floorUsd
      ? `surplus ${formatUsd(netForDecision - math.floorUsd)}`
      : `defisit ${formatUsd(math.floorUsd - netForDecision)}`;
  const detail =
    (input.detailReason || input.headline || "")
      .replace(/\s+/g, " ")
      .trim() ||
    (status === "DISEKUSI"
      ? `Net estimasi ${formatUsd(netForDecision)} memenuhi lantai ${formatUsd(math.floorUsd)} (${vsFloor}).`
      : status === "SKIP_PROFIT_RENDAH"
        ? `Net ${formatUsd(netForDecision)} < lantai minProfitUsd ${formatUsd(math.floorUsd)} (${vsFloor}).`
        : "—");

  const lines = [
    "[FINANCIAL BREAKDOWN]",
    `- Pair / Rute: ${math.pair} (${math.buyDex} → ${math.sellDex})`,
    `- Modal Pinjaman (Loan): ${formatUsd(math.loanUsd, 2)}`,
    `- Spread Kotor (Gross Spread): ${spreadSign}${formatPct(math.spreadPct)} (Estimasi Pendapatan Kotor: ${formatUsd(math.grossUsd)})`,
    `- Komponen Potongan:`,
    `  * Fee Swap (Beli & Jual): ${formatDeductionUsd(math.swapFeeUsd)} (beli ${math.buyDex} ${formatPct(math.buyFeePct)} ${formatUsd(math.buyFeeUsd)} + jual ${math.sellDex} ${formatPct(math.sellFeePct)} ${formatUsd(math.sellFeeUsd)})`,
    `  * Premi Flashloan: ${formatDeductionUsd(math.premiumUsd)} (${math.flashProvider} ${formatPct(math.flashFeePct, 2)})`,
    `  * Estimasi Gas Fee: ${formatDeductionUsd(math.gasUsd)} (${finite(math.gasNative).toFixed(6)} ${math.nativeSymbol})`,
  ];
  if (math.minerTipUsd > 1e-9) {
    lines.push(`  * Tip/Bribe estimasi: ${formatDeductionUsd(math.minerTipUsd)}`);
  }
  lines.push(
    `- Net Profit Aktual (Estimasi): ${formatSignedUsd(netForDecision)} (model ${formatUsd(math.netUsd)}) vs Lantai Minimum (${formatUsd(math.floorUsd)}) · ${vsFloor}`,
    `- Status Keputusan: ${status}`,
    `- Alasan Detail Revert / Skip: ${detail}`
  );
  return lines;
}

type SkipMathFlag = { skipMathLogged?: boolean; financialBreakdownLogged?: boolean };

export function logFinancialBreakdown(input: SkipProfitBreakdownInput, error?: unknown): void {
  const flagged = error as SkipMathFlag | undefined;
  if (flagged?.financialBreakdownLogged) return;
  for (const line of formatFinancialBreakdownLines(input)) {
    console.log(line);
  }
  if (flagged && typeof flagged === "object") {
    flagged.financialBreakdownLogged = true;
  }
}

export function formatSkipProfitBreakdownLines(input: SkipProfitBreakdownInput): string[] {
  return formatFinancialBreakdownLines(input);
}

export function logSkipProfitBreakdown(input: SkipProfitBreakdownInput, error?: unknown): void {
  const flagged = error as SkipMathFlag | undefined;
  if (flagged?.skipMathLogged) return;
  logFinancialBreakdown(input, error);
  if (flagged && typeof flagged === "object") {
    flagged.skipMathLogged = true;
    flagged.financialBreakdownLogged = true;
  }
  void import("@/lib/bot/telegram")
    .then((mod) => {
      mod.notifySkipOrFailProfitHtml({
        text: formatSkipProfitTelegramHtml(input),
        dedupeKey: skipProfitTelegramDedupeKey(input),
        force: input.phase === "fail",
      });
    })
    .catch((notifyError) => {
      console.warn(
        "[telegram] skip/fail notify",
        notifyError instanceof Error ? notifyError.message : notifyError
      );
    });
}
