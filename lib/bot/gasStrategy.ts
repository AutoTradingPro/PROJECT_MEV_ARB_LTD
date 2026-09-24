import { DEFAULT_GAS_STRATEGY } from "@/lib/bot/constants";
import { proportionalMinProfitAnchorUsd } from "@/lib/bot/adaptiveMinProfit";
import type { BotConfig } from "@/lib/bot/types";

export type GasStrategyMode = "slow" | "extreme";

export interface GasStrategyDecision {
  ok: boolean;
  needApproval: boolean;
  usePrivateSigner: boolean;
  bumpPct: number;
  maxGasGwei: number;
  mode: GasStrategyMode;
  reason: string;
}

export function normalizeGasStrategyMode(raw: unknown): GasStrategyMode {
  return raw === "extreme" ? "extreme" : "slow";
}

export function evaluateGasStrategy(input: {
  gwei: number;
  config: BotConfig;
  extremeArmed: boolean;
  /** Solana memakai prioritization fee (bukan gwei EVM). */
  chainId?: string | null;
}): GasStrategyDecision {
  const mode = normalizeGasStrategyMode(input.config.gasStrategyMode);
  const gwei = input.gwei;
  const bumpPct = mode === "extreme" ? DEFAULT_GAS_STRATEGY.extremeBumpPct : 0;
  const solana = input.chainId === "solana";

  if (gwei <= 0) {
    // Solana: jangan blokir sinyal valid — fallback fee ditangani di priorityFee / getGasPriceWei.
    if (solana) {
      return {
        ok: true,
        needApproval: false,
        usePrivateSigner: true,
        bumpPct,
        maxGasGwei: 0,
        mode,
        reason: "Solana priority fee fallback (RPC gas belum live) — eksekusi diizinkan",
      };
    }
    return {
      ok: false,
      needApproval: false,
      usePrivateSigner: false,
      bumpPct: 0,
      maxGasGwei: 0,
      mode,
      reason: "Gas price jaringan belum terbaca.",
    };
  }

  return {
    ok: true,
    needApproval: false,
    usePrivateSigner: true,
    bumpPct,
    maxGasGwei: 0,
    mode,
    reason: solana
      ? `solana-priority-fee ~${Math.round(gwei * 1e9)} µLamports/CU (fleksibel)`
      : `live-network-gas ${gwei.toFixed(4)} gwei (fleksibel, tanpa plafon)`,
  };
}

export function extremeFilterCaps(config: BotConfig): {
  minSpreadBps: number;
  minProfitUsd: number;
  maxGasCostUsd: number;
} {
  const extreme = normalizeGasStrategyMode(config.gasStrategyMode) === "extreme";
  const spreadMul = extreme ? DEFAULT_GAS_STRATEGY.extremeSpreadMultiplier : 1;
  const profitMul = extreme ? DEFAULT_GAS_STRATEGY.extremeProfitMultiplier : 1;
  return {
    minSpreadBps: Math.round(config.minSpreadPct * 100 * spreadMul),
    minProfitUsd: proportionalMinProfitAnchorUsd(config.loanAmountUsd) * profitMul,
    maxGasCostUsd: Number.POSITIVE_INFINITY,
  };
}
