import { Interface } from "ethers";
import { AUTO_EXECUTE, DEFAULT_BOT_CONFIG } from "./constants";
import { ethCall, ethEstimateGas, rpcUrl } from "./rpc";
import type { ChainId } from "@/lib/chain/networks";
import { normalizeTradingChainId } from "@/config/networks";
import {
  extractRevertPayload,
  isEmptySelectorRevert,
  toExecRevertLog,
  type RevertPayload,
} from "./revertReason";
import type { Opportunity } from "./types";

export function formatPreflightFailure(reason: string): string {
  const detail = (reason || "eth_call / amountOutMin gagal").replace(/\s+/g, " ").trim();
  return `[PREFLIGHT] simulation failure (belum di-broadcast ke mempool, tidak ada tx hash) — ${detail}`;
}

export function isPreflightFailure(message: unknown): boolean {
  const text = typeof message === "string" ? message : message instanceof Error ? message.message : String(message ?? "");
  return /\[PREFLIGHT\]|pre-flight simulation failure|staticCall reverted/i.test(text);
}

export type PreflightDiag = {
  pair?: string;
  buyDex?: string;
  sellDex?: string;
  tokenIn?: string;
  tokenOut?: string;
  loanWei?: string;
  loanUsd?: number;
  gasLimit?: number;
  chainId?: string;
};

export function preflightDiagFromOpportunity(
  opp: Pick<
    Opportunity,
    | "tokenPair"
    | "buyExchange"
    | "sellExchange"
    | "buyDex"
    | "sellDex"
    | "tokenIn"
    | "tokenOut"
    | "amountInWei"
    | "chainId"
  >,
  gasLimit?: number,
  loanUsd?: number
): PreflightDiag {
  return {
    pair: opp.tokenPair,
    buyDex: opp.buyExchange || opp.buyDex,
    sellDex: opp.sellExchange || opp.sellDex,
    tokenIn: opp.tokenIn,
    tokenOut: opp.tokenOut,
    loanWei: opp.amountInWei,
    loanUsd,
    gasLimit,
    chainId: opp.chainId,
  };
}

function compactLoanUsd(value?: number): string {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return "—";
  const n = value as number;
  const digits = Math.abs(n) >= 100 ? 0 : 2;
  return `$${n.toFixed(digits)}`;
}

export function logPreflightSimulationFailure(reason: string, diag?: PreflightDiag, payload?: RevertPayload): void {
  console.warn(
    "[PREFLIGHT] simulation failure — transaksi belum di-broadcast ke mempool (tidak ada tx hash)"
  );
  if (reason) console.warn(`[PREFLIGHT] Alasan: ${reason.replace(/\s+/g, " ").trim()}`);
  if (payload?.empty || isEmptySelectorRevert(reason)) {
    console.warn(
      `[PREFLIGHT] selector kosong · raw=${payload?.hex || "0x"}` +
        (payload?.selector ? ` · selector=${payload.selector}` : "")
    );
  } else if (payload?.hex) {
    console.warn(`[PREFLIGHT] revert data hex=${payload.hex}` + (payload.selector ? ` · selector=${payload.selector}` : ""));
  }
  if (diag) {
    const route = `${diag.pair || "?"} ${diag.buyDex || "?"}→${diag.sellDex || "?"}`;
    const tokens = `${diag.tokenIn || "?"}/${diag.tokenOut || "?"}`;
    console.warn(
      `[PREFLIGHT] input · rute=${route} · token=${tokens} · loanWei=${diag.loanWei || "0"} (${compactLoanUsd(diag.loanUsd)}) · gasLimit≈${diag.gasLimit ?? "?"} · chain=${diag.chainId || "?"}`
    );
  }
}

const ARB_IFACE = new Interface([
  "function executeFlashArb(address pair,uint256 amount0Out,uint256 amount1Out,bytes data)",
]);

export interface SimulateInput {
  contract: string;
  owner: string;
  pair: string;
  amount0Out: bigint;
  amount1Out: bigint;
  callbackData: string;
  chainId?: ChainId;
}

export function applyGasLimitBuffer(
  estimated: bigint,
  bufferPct = AUTO_EXECUTE.gasLimitBufferPct
): bigint {
  if (estimated <= 0n) return 21_000n;
  const pct = BigInt(Math.max(0, Math.floor(bufferPct)));
  const buffered = (estimated * (100n + pct)) / 100n;
  return buffered < 21_000n ? 21_000n : buffered;
}

export type SimulateResult = {
  ok: boolean;
  reason?: string;
  emptySelector?: boolean;
  revertHex?: string | null;
  selector?: string | null;
};

export async function simulateEncodedCall(input: {
  from: string;
  to: string;
  data: string;
  chainId?: ChainId;
  /** RPC [EXEC] (BlockPi). Jika diisi, tidak memakai Ankr failover. */
  rpcUrl?: string;
}): Promise<SimulateResult> {
  const chainId = normalizeTradingChainId(input.chainId);
  if (!input.rpcUrl && !rpcUrl(chainId)) {
    return { ok: false, reason: "RPC_HTTP_URL belum diisi" };
  }
  if (!input.to || !input.from || !input.data) {
    return { ok: false, reason: "Alamat kontrak atau owner kosong" };
  }
  try {
    await ethCall(
      { from: input.from, to: input.to, data: input.data },
      input.rpcUrl,
      chainId
    );
    return { ok: true };
  } catch (error) {
    const payload = extractRevertPayload(error);
    const reason = toExecRevertLog(error);
    return {
      ok: false,
      reason,
      emptySelector: payload.empty || isEmptySelectorRevert(reason),
      revertHex: payload.hex,
      selector: payload.selector,
    };
  }
}

/** eth_call (staticCall) lalu eth_estimateGas + buffer 25% sebelum broadcast. */
export async function preflightExecuteCall(input: {
  from: string;
  to: string;
  data: string;
  chainId?: ChainId;
  fallbackGasLimit?: number;
  rpcUrl?: string;
  diag?: PreflightDiag;
}): Promise<{
  ok: boolean;
  reason?: string;
  gasLimit?: number;
  estimatedGas?: number;
  emptySelector?: boolean;
  revertHex?: string | null;
  selector?: string | null;
}> {
  const chainId = normalizeTradingChainId(input.chainId);
  const sim = await simulateEncodedCall(input);
  if (!sim.ok) {
    const reason = formatPreflightFailure(sim.reason || "eth_call reverted");
    const payload: RevertPayload = {
      hex: sim.revertHex ?? null,
      empty: Boolean(sim.emptySelector),
      selector: sim.selector ?? null,
    };
    logPreflightSimulationFailure(sim.reason || "eth_call reverted", input.diag, payload);
    return {
      ok: false,
      reason,
      emptySelector: sim.emptySelector,
      revertHex: sim.revertHex,
      selector: sim.selector,
    };
  }

  const fallback = Math.max(
    21_000,
    Math.floor(input.fallbackGasLimit || DEFAULT_BOT_CONFIG.gasLimit)
  );
  try {
    const estimated = await ethEstimateGas(
      { from: input.from, to: input.to, data: input.data },
      input.rpcUrl,
      chainId
    );
    const gasLimit = Number(applyGasLimitBuffer(estimated));
    return { ok: true, estimatedGas: Number(estimated), gasLimit };
  } catch (error) {
    const bufferedFallback = Number(applyGasLimitBuffer(BigInt(fallback)));
    console.warn(
      `[PREFLIGHT] eth_estimateGas gagal, pakai fallback ${bufferedFallback} (+${AUTO_EXECUTE.gasLimitBufferPct}%) · ${toExecRevertLog(error)}`
    );
    return { ok: true, gasLimit: bufferedFallback };
  }
}

export async function simulateFlashArb(input: SimulateInput): Promise<SimulateResult> {
  const chainId = normalizeTradingChainId(input.chainId);
  if (!input.contract || !input.owner) {
    return { ok: false, reason: "Alamat kontrak atau owner kosong" };
  }

  const data = ARB_IFACE.encodeFunctionData("executeFlashArb", [
    input.pair,
    input.amount0Out,
    input.amount1Out,
    input.callbackData,
  ]);

  return simulateEncodedCall({
    from: input.owner,
    to: input.contract,
    data,
    chainId,
  });
}
