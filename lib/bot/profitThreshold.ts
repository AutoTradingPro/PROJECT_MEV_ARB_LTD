import { formatEther, parseEther, parseUnits } from "ethers";
import { proportionalMinProfitAnchorUsd, resolveAdaptiveMinProfitUsd } from "@/lib/bot/adaptiveMinProfit";
import { tokenWeiToUsd } from "@/lib/bot/configUnits";
import { logSkipProfitBreakdown } from "@/lib/bot/skipProfitBreakdown";
import type { Opportunity } from "@/lib/bot/types";

export const DEFAULT_MIN_PROFIT_THRESHOLD_ETH = "0.0005";

export const SKIP_PROFIT_TOO_SMALL =
  "[SKIP] Profit terlalu kecil / tidak menutup biaya gas.";

export interface ProfitCheckInput {
  opportunity: Pick<
    Opportunity,
    | "estimatedProfitWei"
    | "netProfitWei"
    | "quoteDecimals"
    | "quoteUsd"
    | "tokenIn"
    | "tokenOut"
    | "priceDexAUsd"
    | "priceDexBUsd"
    | "spreadBps"
    | "amountInWei"
  > &
    Partial<Opportunity>;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  minProfitUsd?: number;
  bribePct?: number;
  minSpreadBps?: number;
  extreme?: boolean;
  loanAmountUsd?: number;
  chainId?: string;
}

export interface ProfitCheckResult {
  ok: boolean;
  grossWei: bigint;
  gasCostWei: bigint;
  netWei: bigint;
  minProfitWei: bigint;
  adaptiveMinUsd?: number;
  reason?: string;
}

function envThresholdEth(): bigint {
  const raw = (
    process.env.MIN_PROFIT_THRESHOLD ||
    process.env.MIN_PROFIT_THRESHOLD_ETH ||
    DEFAULT_MIN_PROFIT_THRESHOLD_ETH
  ).trim();
  try {
    return parseEther(raw);
  } catch {
    return parseEther(DEFAULT_MIN_PROFIT_THRESHOLD_ETH);
  }
}

function isEthLikeQuote(
  opp: ProfitCheckInput["opportunity"]
): boolean {
  const symbol = (opp.tokenIn || "").toUpperCase();
  return (opp.quoteDecimals ?? 18) === 18 && (symbol === "WETH" || symbol === "ETH");
}

function resolveEthUsd(opp: ProfitCheckInput["opportunity"]): number {
  const fromEnv = Number(process.env.ETH_USD || process.env.NATIVE_USD || "");
  if (Number.isFinite(fromEnv) && fromEnv > 50) return fromEnv;
  if (isEthLikeQuote(opp) && Number(opp.quoteUsd) > 50) return Number(opp.quoteUsd);
  const base = (opp.tokenOut || "").toUpperCase();
  if (base === "WETH" || base === "ETH") {
    const px = Number(opp.priceDexAUsd || opp.priceDexBUsd || 0);
    if (px > 50) return px;
  }
  const quote = (opp.tokenIn || "").toUpperCase();
  if ((quote === "WETH" || quote === "ETH") && Number(opp.quoteUsd) > 50) {
    return Number(opp.quoteUsd);
  }
  return 0;
}

function usdToEthWei(usd: number, ethUsd: number): bigint {
  if (!(ethUsd > 0) || !Number.isFinite(usd) || usd <= 0) return 0n;
  const eth = usd / ethUsd;
  if (!Number.isFinite(eth) || eth <= 0) return 0n;
  try {
    return parseUnits(eth.toFixed(18), 18);
  } catch {
    return 0n;
  }
}

function grossProfitWei(opp: ProfitCheckInput["opportunity"]): bigint {
  try {
    const gross = BigInt(opp.estimatedProfitWei || "0");
    if (gross > 0n) return gross;
    return BigInt(opp.netProfitWei || "0");
  } catch {
    return 0n;
  }
}

/**
 * Validasi profit minimum sebelum tx dikirim ke writeProvider.
 * Gas = gasLimit × maxFeePerGas (wei native). Profit dikonversi ke ETH jika quote bukan WETH.
 */
export function validateAndExecuteArbitrage(input: ProfitCheckInput): ProfitCheckResult {
  const estimatedGasLimit = input.gasLimit > 0n ? input.gasLimit : 5_000_000n;
  const estimatedGasCost = estimatedGasLimit * input.maxFeePerGas;
  const quoteGross = grossProfitWei(input.opportunity);
  const ethUsd = resolveEthUsd(input.opportunity);
  const decimals = input.opportunity.quoteDecimals ?? 18;
  const quoteUsd = input.opportunity.quoteUsd ?? 1;

  let grossProfit = quoteGross;
  if (!isEthLikeQuote(input.opportunity)) {
    const grossUsd = tokenWeiToUsd(quoteGross, decimals, quoteUsd);
    if (ethUsd > 0) {
      grossProfit = usdToEthWei(grossUsd, ethUsd);
    } else {
      console.warn(
        "[PROFIT CHECK] Harga ETH tidak tersedia — profit quote tidak bisa dibanding gas ETH secara presisi."
      );
      grossProfit = 0n;
    }
  }

  const netProfit = grossProfit - estimatedGasCost;
  const gasCostEth = Number(formatEther(estimatedGasCost));
  const gasCostUsd = ethUsd > 0 ? gasCostEth * ethUsd : 0;
  const loanAmountUsd =
    Number.isFinite(Number(input.loanAmountUsd)) && Number(input.loanAmountUsd) > 0
      ? Number(input.loanAmountUsd)
      : tokenWeiToUsd(
          input.opportunity.amountInWei || "0",
          decimals,
          quoteUsd
        );
  const adaptive = resolveAdaptiveMinProfitUsd({
    configMinProfitUsd: proportionalMinProfitAnchorUsd(loanAmountUsd),
    gasCostUsd,
    bribePct: input.bribePct,
    spreadBps: input.opportunity.spreadBps,
    minSpreadBps: input.minSpreadBps,
    extreme: input.extreme,
    loanAmountUsd,
  });

  let minProfitThreshold = usdToEthWei(adaptive.minProfitUsd, ethUsd);
  if (minProfitThreshold <= 0n) {
    minProfitThreshold = envThresholdEth();
  }

  console.log(
    `[PROFIT CHECK] Gross: ${formatEther(grossProfit)} ETH | Gas Cost: ${formatEther(estimatedGasCost)} ETH | Net: ${formatEther(netProfit)} ETH | Min: ${formatEther(minProfitThreshold)} ETH ($${adaptive.minProfitUsd.toFixed(3)} = max(loan×0.60%,costFloor))`
  );
  console.log(`[PROFIT CHECK] ${adaptive.reason}`);

  if (netProfit < minProfitThreshold) {
    const skipReason = `${SKIP_PROFIT_TOO_SMALL} Profit bersih (${formatEther(netProfit)} ETH) di bawah ambang minProfitUsd $${adaptive.minProfitUsd.toFixed(3)} (max loan×0.60%/costFloor). Eksekusi dibatalkan untuk mencegah rugi/revert.`;
    logSkipProfitBreakdown({
      opp: input.opportunity,
      config: {
        loanAmountUsd,
        minProfitUsd: adaptive.minProfitUsd,
        minerTipPct: input.bribePct,
        dynamicBribePercent: input.bribePct,
        gasLimit: Number(estimatedGasLimit),
        chainId: input.chainId,
      },
      liveGasWei: input.maxFeePerGas,
      gasLimit: Number(estimatedGasLimit),
      chainId: input.chainId,
      headline: skipReason,
      detailReason: skipReason,
      decisionStatus: "SKIP_PROFIT_RENDAH",
      phase: "skip",
    });
    return {
      ok: false,
      grossWei: grossProfit,
      gasCostWei: estimatedGasCost,
      netWei: netProfit,
      minProfitWei: minProfitThreshold,
      adaptiveMinUsd: adaptive.minProfitUsd,
      reason: skipReason,
    };
  }

  console.log("[PASS] Profit memenuhi syarat adaptif. Melanjutkan eksekusi flash loan...");
  return {
    ok: true,
    grossWei: grossProfit,
    gasCostWei: estimatedGasCost,
    netWei: netProfit,
    minProfitWei: minProfitThreshold,
    adaptiveMinUsd: adaptive.minProfitUsd,
  };
}

export function maxFeeFromTxFees(input: {
  maxFeePerGas?: bigint;
  gasPrice?: bigint;
}): bigint {
  if (input.maxFeePerGas && input.maxFeePerGas > 0n) return input.maxFeePerGas;
  if (input.gasPrice && input.gasPrice > 0n) return input.gasPrice;
  return 0n;
}
