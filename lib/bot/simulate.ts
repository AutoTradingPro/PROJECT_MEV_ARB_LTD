import { Interface } from "ethers";
import { AUTO_EXECUTE, DEFAULT_BOT_CONFIG } from "./constants";
import { appendServerLog } from "./serverLog";
import { ethCall, ethEstimateGas, rpcUrl } from "./rpc";
import type { ChainId } from "@/lib/chain/networks";
import { normalizeTradingChainId } from "@/config/networks";
import { isBackupRpcEnabled } from "@/lib/owner/chainQuota";
import { getChainNodeConfig } from "@/lib/owner/nodeEndpoints";
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
  /** 1 jika eth_call pindah ke BlockPi setelah node cadangan putus. */
  connectionRetries?: number;
  /** RPC yang menyelesaikan eth_call. */
  endpoint?: string;
};

const SIMULATION_FAILOVER_LOG =
  "⚠️ [FAILOVER] Node Utama mengalami fetch failed. Jalur simulasi berhasil dialihkan ke Premium BlockPi dalam < 1ms.";

const BLOCKPI_ENV: Partial<Record<ChainId, string>> = {
  arbitrum: "BLOCKPI_RPC_ARBITRUM",
  polygon: "BLOCKPI_RPC_POLYGON",
  ethereum: "BLOCKPI_RPC_ETHEREUM",
  bsc: "BLOCKPI_RPC_BSC",
  optimism: "BLOCKPI_RPC_OPTIMISM",
  avalanche: "BLOCKPI_RPC_AVALANCHE",
  base: "BLOCKPI_RPC_BASE",
  fantom: "BLOCKPI_RPC_FANTOM",
  linea: "BLOCKPI_RPC_LINEA",
};

function errorTextChain(error: unknown, depth = 0): string {
  if (!error || depth > 4) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    const cause = "cause" in error ? errorTextChain((error as { cause?: unknown }).cause, depth + 1) : "";
    return `${error.message} ${code} ${cause}`;
  }
  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error);
}

/** Putus koneksi / timeout fetch, bukan revert kontrak. `timeout` dicocokkan case-insensitive. */
export function isSimulationConnectionFailure(error: unknown): boolean {
  const blob = errorTextChain(error).toLowerCase();
  return /fetch failed|timeout|econnreset|etimedout|enotfound|eai_again|econnrefused|und_err_|socket hang up|other side closed|network error/.test(
    blob
  );
}

function sameRpc(left: string, right: string): boolean {
  return left.replace(/\/$/, "").toLowerCase() === right.replace(/\/$/, "").toLowerCase();
}

function isBlockPiUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith("blockpi.network");
  } catch {
    return false;
  }
}

/** Node Cadangan yang sedang aktif. */
function activeBackupRpc(chainId: ChainId): string {
  if (!isBackupRpcEnabled(chainId)) return "";
  return getChainNodeConfig(chainId).backupRpc?.trim() || "";
}

/** Premium BlockPi Anti-MEV. Env khusus diutamakan, lalu primary yang host-nya BlockPi. */
function premiumBlockPiRpc(chainId: ChainId): string {
  const envKey = BLOCKPI_ENV[chainId];
  const fromEnv = envKey ? process.env[envKey]?.trim() || "" : "";
  if (fromEnv) return fromEnv;
  const primary = getChainNodeConfig(chainId).primaryRpc?.trim() || "";
  return isBlockPiUrl(primary) ? primary : "";
}

function noteSimulationFailover(chainId: ChainId): void {
  console.warn(SIMULATION_FAILOVER_LOG);
  appendServerLog({
    level: "warn",
    source: "FAILOVER",
    chainId,
    message: SIMULATION_FAILOVER_LOG,
  });
  void import("@/lib/bot/telegram")
    .then((mod) => mod.notifySimulationBlockPiFailover())
    .catch((error) => {
      console.warn("[telegram] failover notify", error instanceof Error ? error.message : error);
    });
}

export async function simulateEncodedCall(input: {
  from: string;
  to: string;
  data: string;
  chainId?: ChainId;
  /** Dipakai hanya jika Node Cadangan kosong. */
  rpcUrl?: string;
  label?: { pair?: string; route?: string };
}): Promise<SimulateResult> {
  const chainId = normalizeTradingChainId(input.chainId);
  if (!input.to || !input.from || !input.data) {
    return { ok: false, reason: "Alamat kontrak atau owner kosong" };
  }
  const tx = { from: input.from, to: input.to, data: input.data };
  const primaryProvider = activeBackupRpc(chainId) || input.rpcUrl || rpcUrl(chainId);
  const blockPi = premiumBlockPiRpc(chainId);
  const premiumProvider = blockPi && !sameRpc(blockPi, primaryProvider) ? blockPi : "";
  const firstProvider = primaryProvider || premiumProvider;
  if (!firstProvider) {
    return { ok: false, reason: "RPC_HTTP_URL belum diisi" };
  }

  let lastError: unknown;
  let connectionRetries = 0;
  try {
    await ethCall(tx, firstProvider, chainId);
    return { ok: true, connectionRetries: 0, endpoint: firstProvider };
  } catch (error) {
    lastError = error;
    if (primaryProvider && premiumProvider && isSimulationConnectionFailure(error)) {
      try {
        await ethCall(tx, premiumProvider, chainId);
        connectionRetries = 1;
        noteSimulationFailover(chainId);
        return { ok: true, connectionRetries, endpoint: premiumProvider };
      } catch (premiumError) {
        lastError = premiumError;
        connectionRetries = 1;
      }
    }
  }
  const payload = extractRevertPayload(lastError);
  const reason = toExecRevertLog(lastError);
  return {
    ok: false,
    reason,
    emptySelector: payload.empty || isEmptySelectorRevert(reason),
    revertHex: payload.hex,
    selector: payload.selector,
    connectionRetries,
  };
}

/** eth_estimateGas pada node yang sama. Fetch/timeout/network pindah ke BlockPi tanpa jeda. */
export async function estimateGasWithFailover(input: {
  from: string;
  to: string;
  data: string;
  chainId: ChainId;
  endpoint?: string;
  alreadyFailedOver?: boolean;
}): Promise<bigint> {
  const tx = { from: input.from, to: input.to, data: input.data };
  const premiumProvider = premiumBlockPiRpc(input.chainId);
  const primaryProvider = input.endpoint || activeBackupRpc(input.chainId) || rpcUrl(input.chainId);
  try {
    return await ethEstimateGas(tx, primaryProvider || premiumProvider, input.chainId);
  } catch (error) {
    if (
      !primaryProvider ||
      !premiumProvider ||
      sameRpc(primaryProvider, premiumProvider) ||
      !isSimulationConnectionFailure(error)
    ) {
      throw error;
    }
    const estimated = await ethEstimateGas(tx, premiumProvider, input.chainId);
    if (!input.alreadyFailedOver) noteSimulationFailover(input.chainId);
    return estimated;
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
  const sim = await simulateEncodedCall({
    ...input,
    label: input.diag
      ? { pair: input.diag.pair, route: `${input.diag.buyDex || "DEX"} → ${input.diag.sellDex || "DEX"}` }
      : undefined,
  });
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
    const estimated = await estimateGasWithFailover({
      from: input.from,
      to: input.to,
      data: input.data,
      chainId,
      endpoint: sim.endpoint || input.rpcUrl,
      alreadyFailedOver: (sim.connectionRetries ?? 0) > 0,
    });
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
