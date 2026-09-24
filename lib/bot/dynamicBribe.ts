import { tokenWeiToUsd } from "@/lib/bot/configUnits";
import type { BotConfig, Opportunity } from "@/lib/bot/types";

export const MAX_DYNAMIC_BRIBE_PCT = 50;

export function clampBribePercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(MAX_DYNAMIC_BRIBE_PCT, value);
}

export function resolveDynamicBribePercent(
  config: Pick<BotConfig, "minerTipPct"> & { dynamicBribePercent?: number }
): number {
  const raw =
    typeof config.dynamicBribePercent === "number" && Number.isFinite(config.dynamicBribePercent)
      ? config.dynamicBribePercent
      : config.minerTipPct;
  return clampBribePercent(raw);
}

/** Dynamic Tip Budget = Gross Profit × (bribe% / 100), in the same wei as gross. */
export function dynamicTipBudgetWei(grossProfitWei: bigint, bribePercent: number): bigint {
  const pct = clampBribePercent(bribePercent);
  if (grossProfitWei <= 0n || pct <= 0) return 0n;
  const scaled = BigInt(Math.round(pct * 100));
  return (grossProfitWei * scaled) / 10_000n;
}

export function opportunityGrossProfitWei(
  opp: Pick<Opportunity, "estimatedProfitWei" | "netProfitWei">
): bigint {
  try {
    const gross = BigInt(opp.estimatedProfitWei || "0");
    if (gross > 0n) return gross;
    return BigInt(opp.netProfitWei || "0");
  } catch {
    return 0n;
  }
}

function resolveEthUsd(
  opp: Pick<Opportunity, "tokenIn" | "tokenOut" | "quoteUsd" | "quoteDecimals" | "priceDexAUsd" | "priceDexBUsd">
): number {
  const fromEnv = Number(process.env.ETH_USD || process.env.NATIVE_USD || "");
  if (Number.isFinite(fromEnv) && fromEnv > 50) return fromEnv;
  const quote = (opp.tokenIn || "").toUpperCase();
  const base = (opp.tokenOut || "").toUpperCase();
  if ((quote === "WETH" || quote === "ETH") && Number(opp.quoteUsd) > 50) {
    return Number(opp.quoteUsd);
  }
  if (base === "WETH" || base === "ETH") {
    const px = Number(opp.priceDexAUsd || opp.priceDexBUsd || 0);
    if (px > 50) return px;
  }
  if (Number(opp.quoteUsd) > 50) return Number(opp.quoteUsd);
  return 0;
}

function usdToEthWei(usd: number, ethUsd: number): bigint {
  if (!(ethUsd > 0) || !Number.isFinite(usd) || usd <= 0) return 0n;
  const eth = usd / ethUsd;
  if (!Number.isFinite(eth) || eth <= 0) return 0n;
  try {
    return BigInt(Math.round(eth * 1e18));
  } catch {
    return 0n;
  }
}

/** Anggaran tip dalam wei ETH untuk maxPriorityFeePerGas. */
export function dynamicTipBudgetEthWei(
  opp: Pick<
    Opportunity,
    | "estimatedProfitWei"
    | "netProfitWei"
    | "quoteDecimals"
    | "quoteUsd"
    | "tokenIn"
    | "tokenOut"
    | "priceDexAUsd"
    | "priceDexBUsd"
  >,
  bribePercent: number
): bigint {
  const gross = opportunityGrossProfitWei(opp);
  const budgetQuote = dynamicTipBudgetWei(gross, bribePercent);
  if (budgetQuote <= 0n) return 0n;

  const quote = (opp.tokenIn || "").toUpperCase();
  const decimals = opp.quoteDecimals ?? 18;
  const ethLike = decimals === 18 && (quote === "WETH" || quote === "ETH");
  if (ethLike) return budgetQuote;

  const usd = tokenWeiToUsd(budgetQuote, decimals, opp.quoteUsd ?? 1);
  const ethUsd = resolveEthUsd(opp);
  if (ethUsd > 0) return usdToEthWei(usd, ethUsd);
  return 0n;
}

export function maxPriorityFeeFromTipBudget(tipBudgetEthWei: bigint, gasLimit: number): bigint {
  const limit = BigInt(Math.max(21_000, Math.floor(gasLimit || 0)));
  if (tipBudgetEthWei <= 0n || limit <= 0n) return 0n;
  return tipBudgetEthWei / limit;
}
