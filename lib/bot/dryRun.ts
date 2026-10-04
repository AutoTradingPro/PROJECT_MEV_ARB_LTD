import { formatEther, parseUnits } from "ethers";
import type { ChainId } from "@/lib/chain/networks";
import { formatNetProfitSkip, minProfitUsdFromLoan } from "@/lib/bot/adaptiveMinProfit";
import { tokenWeiToUsd } from "@/lib/bot/configUnits";
import { DEFAULT_BOT_CONFIG } from "@/lib/bot/constants";
import { applyGasLimitBuffer, estimateGasWithFailover, simulateEncodedCall } from "@/lib/bot/simulate";
import { appendServerLog } from "@/lib/bot/serverLog";
import type { Opportunity } from "@/lib/bot/types";

export type DryRunOutcome =
  | "validated"
  | "reverted"
  | "below_threshold"
  | "rpc_error"
  | "skipped";

export interface OnChainDryRunResult {
  ok: boolean;
  outcome: DryRunOutcome;
  opportunity: Opportunity;
  netProfitWei: string;
  gasCostWei: string;
  estimatedGas?: string;
  minProfitWei: string;
  reason?: string;
}

function isEthLikeQuote(opp: Opportunity): boolean {
  const symbol = (opp.tokenIn || "").toUpperCase();
  return (opp.quoteDecimals ?? 18) === 18 && (symbol === "WETH" || symbol === "ETH");
}

function resolveEthUsd(opp: Opportunity): number {
  const fromEnv = Number(process.env.ETH_USD || process.env.NATIVE_USD || "");
  if (Number.isFinite(fromEnv) && fromEnv > 50) return fromEnv;
  if (isEthLikeQuote(opp) && Number(opp.quoteUsd) > 50) return Number(opp.quoteUsd);
  const base = (opp.tokenOut || "").toUpperCase();
  if (base === "WETH" || base === "ETH") {
    const px = Number(opp.priceDexAUsd || opp.priceDexBUsd || 0);
    if (px > 50) return px;
  }
  return 0;
}

function usdToEthWei(usd: number, ethUsd: number): bigint {
  if (!(ethUsd > 0) || !Number.isFinite(usd) || usd <= 0) return 0n;
  try {
    return parseUnits((usd / ethUsd).toFixed(18), 18);
  } catch {
    return 0n;
  }
}

/** Potensi spread (gross) dalam wei ETH, agar bisa dikurangi biaya gas native. */
function grossSpreadEthWei(opp: Opportunity): bigint {
  let gross = 0n;
  try {
    gross = BigInt(opp.estimatedProfitWei || "0");
    if (gross <= 0n) gross = BigInt(opp.netProfitWei || "0");
  } catch {
    return 0n;
  }
  if (isEthLikeQuote(opp)) return gross;
  const usd = tokenWeiToUsd(gross, opp.quoteDecimals ?? 18, opp.quoteUsd ?? 1);
  return usdToEthWei(usd, resolveEthUsd(opp));
}

/**
 * Dry run on-chain untuk peluang berstatus Ready.
 * eth_call (static) dulu; jika tidak revert, gas = eth_estimateGas × gas price,
 * lalu Net Profit = spread − gas dibanding MIN_PROFIT_THRESHOLD.
 * Kegagalan RPC ditangkap dan tidak melempar.
 */
export async function runOnChainDryRun(input: {
  opportunity: Opportunity;
  from: string;
  to: string;
  data: string;
  chainId: ChainId;
  gasPriceWei: bigint;
  rpcUrl?: string;
  fallbackGasLimit?: number;
}): Promise<OnChainDryRunResult> {
  const opp = input.opportunity;
  const loanUsd = tokenWeiToUsd(opp.amountInWei || "0", opp.quoteDecimals ?? 18, opp.quoteUsd ?? 1);
  const minProfitUsd = minProfitUsdFromLoan(loanUsd);
  const minProfitWei = usdToEthWei(minProfitUsd, resolveEthUsd(opp));
  const unchanged: OnChainDryRunResult = {
    ok: opp.status === "validated",
    outcome: opp.status === "validated" ? "validated" : "skipped",
    opportunity: opp,
    netProfitWei: opp.netProfitWei || "0",
    gasCostWei: opp.gasCostWei || "0",
    minProfitWei: minProfitWei.toString(),
    reason:
      opp.status === "ready" || opp.status === "validated"
        ? undefined
        : `Status ${opp.status} bukan Ready — dry run tidak dijalankan.`,
  };

  if (opp.status !== "ready") {
    return unchanged;
  }

  try {
    appendServerLog({
      level: "info",
      source: "eth_call",
      chainId: opp.chainId,
      message: `Simulating ${opp.tokenPair} · ${opp.buyExchange} → ${opp.sellExchange} · block #${opp.detectedBlock || "—"}`,
    });
    const sim = await simulateEncodedCall({
      from: input.from,
      to: input.to,
      data: input.data,
      chainId: input.chainId,
      rpcUrl: input.rpcUrl,
      label: {
        pair: opp.tokenPair,
        route: `${opp.buyExchange || opp.buyDex} → ${opp.sellExchange || opp.sellDex}`,
      },
    });
    if (!sim.ok) {
      const detail = sim.reason || "eth_call reverted";
      const reason = `[DRY RUN] simulasi revert — ${detail}`;
      console.warn(reason);
      appendServerLog({ level: "error", source: "REVERTED", chainId: opp.chainId, message: reason });
      return {
        ok: false,
        outcome: "reverted",
        reason,
        netProfitWei: opp.netProfitWei || "0",
        gasCostWei: opp.gasCostWei || "0",
        minProfitWei: minProfitWei.toString(),
        opportunity: { ...opp, status: "rejected", reason },
      };
    }

    let estimated = 0n;
    try {
      estimated = await estimateGasWithFailover({
        from: input.from,
        to: input.to,
        data: input.data,
        chainId: input.chainId,
        endpoint: sim.endpoint || input.rpcUrl,
        alreadyFailedOver: (sim.connectionRetries ?? 0) > 0,
      });
    } catch (estimateError) {
      const fallback = BigInt(
        Math.max(21_000, Math.floor(input.fallbackGasLimit || DEFAULT_BOT_CONFIG.gasLimit))
      );
      estimated = applyGasLimitBuffer(fallback);
      const detail =
        estimateError instanceof Error ? estimateError.message : String(estimateError);
      console.warn(`[DRY RUN] eth_estimateGas gagal, pakai fallback ${estimated} · ${detail}`);
    }

    const price = input.gasPriceWei > 0n ? input.gasPriceWei : 0n;
    const gasCostWei = estimated * price;
    const grossWei = grossSpreadEthWei(opp);
    const netWei = grossWei - gasCostWei;
    const grossUsd = tokenWeiToUsd(
      opp.estimatedProfitWei || opp.netProfitWei || "0",
      opp.quoteDecimals ?? 18,
      opp.quoteUsd ?? 1
    );
    const nativeUsd = resolveEthUsd(opp);
    const gasUsd = nativeUsd > 0 ? Number(formatEther(gasCostWei)) * nativeUsd : 0;
    const bribeUsd = Number(opp.bribeUsd) > 0 ? Number(opp.bribeUsd) : 0;
    const netUsd = grossUsd - gasUsd - bribeUsd;

    console.log(
      `[DRY RUN] ${opp.tokenPair} · eth_call ok · gasUnits ${estimated}` +
        ` · gas $${gasUsd.toFixed(3)} · bribe $${bribeUsd.toFixed(3)} · net $${netUsd.toFixed(3)}` +
        ` · target $${minProfitUsd.toFixed(3)} (loan×0.10%)`
    );

    if (netUsd + 1e-9 < minProfitUsd) {
      const reason = formatNetProfitSkip(netUsd, minProfitUsd);
      console.warn(reason);
      appendServerLog({ level: "warn", source: "SKIPPED", chainId: opp.chainId, message: reason });
      return {
        ok: false,
        outcome: "below_threshold",
        reason,
        estimatedGas: estimated.toString(),
        gasCostWei: gasCostWei.toString(),
        netProfitWei: netWei.toString(),
        minProfitWei: minProfitWei.toString(),
        opportunity: {
          ...opp,
          status: "rejected",
          gasCostWei: gasCostWei.toString(),
          netProfitWei: netWei.toString(),
          reason,
        },
      };
    }

    const validated: Opportunity = {
      ...opp,
      status: "validated",
      gasCostWei: gasCostWei.toString(),
      netProfitWei: netWei.toString(),
      reason: undefined,
    };
    console.log(
      `[DRY RUN] Validated ${opp.tokenPair} · net $${netUsd.toFixed(3)} ≥ target $${minProfitUsd.toFixed(3)}`
    );
    appendServerLog({
      level: "exec",
      source: "VALIDATED",
      chainId: opp.chainId,
      message: `${opp.tokenPair} · net $${netUsd.toFixed(3)} ≥ target $${minProfitUsd.toFixed(3)} (loan×0.10%) · eth_call lolos`,
    });
    return {
      ok: true,
      outcome: "validated",
      opportunity: validated,
      estimatedGas: estimated.toString(),
      gasCostWei: gasCostWei.toString(),
      netProfitWei: netWei.toString(),
      minProfitWei: minProfitWei.toString(),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const reason = `[DRY RUN] RPC gagal — ${detail}`;
    console.warn(`${reason} · engine tetap berjalan`);
    return {
      ok: false,
      outcome: "rpc_error",
      reason,
      opportunity: opp,
      netProfitWei: opp.netProfitWei || "0",
      gasCostWei: opp.gasCostWei || "0",
      minProfitWei: minProfitWei.toString(),
    };
  }
}
