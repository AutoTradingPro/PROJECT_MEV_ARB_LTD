import { FetchRequest, JsonRpcProvider, type JsonRpcApiProviderOptions } from "ethers";
import {
  jsonRpcAuthHeaders,
  stripBlockmachineHttpQuery,
} from "@/config/blockmachine";
import { type ChainId } from "@/lib/chain/networks";
import { parseHexBlock } from "@/lib/chain/publicEnv";
import { appendServerLog } from "@/lib/bot/serverLog";
import {
  markHealthyRpc,
  providerRole,
  roleLabel,
  rpcCandidates,
} from "@/lib/owner/nodeEndpoints";
import { RpcCallError } from "@/lib/bot/revertReason";
import {
  isBackupRpcEnabled,
  isHttpRpcAllowed,
  isPrimaryRpcEnabled,
  isScanRpcAllowed,
} from "@/lib/owner/chainQuota";
import {
  isForeignScanChain,
  denyForeignProviderChain,
  mergeScanAbortSignal,
  onScanRuntimeReset,
  scanAbortSignal,
  ScanRuntimeAbortError,
} from "@/lib/bot/scanRuntime";

const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
] as const;

const RPC_TIMEOUT_MS = 4500;
const RATE_LIMIT_LOG_MS = 12_000;
const RATE_LIMIT_COOLDOWN_MIN_MS = 8_000;
const RATE_LIMIT_COOLDOWN_MAX_MS = 120_000;
/** 401/403 tidak pulih sendiri — jangan pukul Primary tiap tick scan. */
const AUTH_COOLDOWN_MS = 15 * 60_000;

type RpcCooldown = { until: number; remaining?: number; limit?: number; reason?: "rate" | "auth" };
const rpcCooldowns = new Map<string, RpcCooldown>();
const rateLimitLogAt = new Map<string, number>();

function rpcHostKey(url: string): string {
  try {
    return new URL(stripBlockmachineHttpQuery(url)).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/\/$/, "").toLowerCase();
  }
}

function isRateLimitMessage(message: string, httpStatus?: number, rpcCode?: number): boolean {
  if (httpStatus === 429) return true;
  if (rpcCode === -32029) return true;
  return /429|rate limit|-32029|cu_per_minute|too many requests/i.test(message);
}

function isRpcAuthFailure(message: string, httpStatus?: number, rpcCode?: number): boolean {
  if (httpStatus === 401 || httpStatus === 403) return true;
  if (rpcCode === 401 || rpcCode === 403) return true;
  return /RPC HTTP 401|RPC HTTP 403|unauthorized|forbidden|api key|disabled/i.test(message);
}

function parseRateLimitCooldownMs(text: string, httpStatus?: number): number {
  let retryAfterMs = RATE_LIMIT_COOLDOWN_MIN_MS;
  let remaining: number | undefined;
  let limit: number | undefined;
  let resetMs: number | undefined;
  try {
    const parsed = JSON.parse(text) as {
      error?: { code?: number; data?: { retry_after_ms?: number; remaining?: number; reset?: number; limit?: number } };
    };
    const data = parsed.error?.data;
    if (data) {
      remaining = Number(data.remaining);
      limit = Number(data.limit);
      if (Number.isFinite(data.retry_after_ms) && Number(data.retry_after_ms) > 0) {
        retryAfterMs = Number(data.retry_after_ms);
      }
      if (Number.isFinite(data.reset) && Number(data.reset) > 0) {
        const reset = Number(data.reset);
        resetMs = reset > 1e12 ? reset : reset * 1000;
      }
    }
  } catch {
    /* body bukan JSON penuh */
  }
  const untilReset = resetMs ? resetMs - Date.now() + 250 : 0;
  let cooldown = Math.max(RATE_LIMIT_COOLDOWN_MIN_MS, retryAfterMs, untilReset);
  if (httpStatus === 429 || remaining === 0) {
    cooldown = Math.max(cooldown, RATE_LIMIT_COOLDOWN_MIN_MS);
  }
  return Math.min(RATE_LIMIT_COOLDOWN_MAX_MS, cooldown);
}

function markRpcRateLimited(url: string, text: string, httpStatus?: number): void {
  const key = rpcHostKey(url);
  const ms = parseRateLimitCooldownMs(text, httpStatus);
  const prev = rpcCooldowns.get(key);
  const until = Math.max(prev?.until ?? 0, Date.now() + ms);
  let remaining: number | undefined;
  let limit: number | undefined;
  try {
    const parsed = JSON.parse(text) as {
      error?: { data?: { remaining?: number; limit?: number } };
    };
    remaining = Number(parsed.error?.data?.remaining);
    limit = Number(parsed.error?.data?.limit);
  } catch {
    /* ignore */
  }
  rpcCooldowns.set(key, {
    until,
    remaining: Number.isFinite(remaining) ? remaining : prev?.remaining,
    limit: Number.isFinite(limit) ? limit : prev?.limit,
    reason: "rate",
  });
}

function markRpcAuthFailed(url: string): void {
  const key = rpcHostKey(url);
  const prev = rpcCooldowns.get(key);
  const until = Math.max(prev?.until ?? 0, Date.now() + AUTH_COOLDOWN_MS);
  rpcCooldowns.set(key, { ...prev, until, reason: "auth" });
}

function isRpcCooling(url: string): boolean {
  const row = rpcCooldowns.get(rpcHostKey(url));
  if (!row) return false;
  if (Date.now() >= row.until) {
    rpcCooldowns.delete(rpcHostKey(url));
    return false;
  }
  return true;
}

function rpcCooldownRemainSec(url: string): number {
  const row = rpcCooldowns.get(rpcHostKey(url));
  if (!row) return 0;
  return Math.max(1, Math.ceil((row.until - Date.now()) / 1000));
}

function compactRpcError(message: string): string {
  if (/RPC HTTP 429:\s*\{|"cu_per_minute"/i.test(message)) {
    return message.replace(/RPC HTTP 429:[\s\S]*/i, "RPC HTTP 429: rate limit exceeded");
  }
  return message;
}

function shouldThrottleRpcLog(message: string): boolean {
  return (
    isRateLimitMessage(message) ||
    isRpcAuthFailure(message) ||
    /rate-limited|kunci ditolak|jeda \d+s · lanjut|beralih ke |Scanning tidak dihentikan/i.test(message)
  );
}

function failoverExhaustedMessage(chainId: ChainId): string {
  const primaryOn = isPrimaryRpcEnabled(chainId);
  const backupOn = isBackupRpcEnabled(chainId);
  if (!primaryOn && backupOn) {
    return `${chainId}: Primary Off · Cadangan gagal. Scanning tidak dihentikan.`;
  }
  if (primaryOn && !backupOn) {
    return `${chainId}: Cadangan Off · Primary gagal. Scanning tidak dihentikan.`;
  }
  if (!primaryOn && !backupOn) {
    return `${chainId}: Primary Off · Cadangan Off. Scanning tidak dihentikan.`;
  }
  return `${chainId}: Primary dan Cadangan RPC gagal. Scanning tidak dihentikan.`;
}

function continueHint(chainId: ChainId, remaining: string[]): string {
  if (remaining.length === 0) return "";
  return ` · lanjut ${roleLabel(providerRole(chainId, remaining[0]))}`;
}

export interface JsonRpcRequest {
  method: string;
  params?: unknown[];
}

export function redactEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    const path = parsed.pathname.replace(/\/[A-Za-z0-9_-]{16,}/g, "/***");
    return `${parsed.host}${path}`;
  } catch {
    return "rpc";
  }
}

export function rpcErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error) {
    const err = error as { shortMessage?: string; message?: string; code?: string | number };
    if (err.shortMessage) return err.shortMessage;
    if (err.message) return err.message;
    if (err.code !== undefined) return String(err.code);
  }
  return String(error);
}

export function isRpcTransportError(error: unknown): boolean {
  const message = rpcErrorMessage(error).toLowerCase();
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string | number }).code)
      : "";
  return (
    /401|403|429|502|503|504|unauthorized|forbidden|api key|disabled|timeout|econnreset|etimedout|enotfound|eai_again|network|socket|websocket|failed to detect|could not coalesce|unsupported server|missing response|bad response/.test(
      message
    ) || /SERVER_ERROR|TIMEOUT|NETWORK_ERROR|UNKNOWN_ERROR|ECONNRESET/.test(code)
  );
}

function logRpc(level: "info" | "warn" | "error", message: string, chainId?: ChainId): void {
  if (chainId && isForeignScanChain(chainId)) return;
  if (shouldThrottleRpcLog(message)) {
    const key = message.replace(/jeda \d+s/g, "jeda").replace(/\s+/g, " ").slice(0, 96);
    const last = rateLimitLogAt.get(key) ?? 0;
    if (Date.now() - last < RATE_LIMIT_LOG_MS) return;
    rateLimitLogAt.set(key, Date.now());
  }
  const display = compactRpcError(message);
  if (level === "error") console.error(`[rpc] ${display}`);
  else if (level === "warn") console.warn(`[rpc] ${display}`);
  else console.log(`[rpc] ${display}`);
  appendServerLog({
    level: level === "info" ? "info" : level,
    source: "rpc-failover",
    message: display,
  });
}

export function jsonRpcProviderSource(url: string): string | FetchRequest {
  const headers = jsonRpcAuthHeaders(url);
  const endpoint = stripBlockmachineHttpQuery(url);
  if (!headers.Authorization) return endpoint;
  const req = new FetchRequest(endpoint);
  req.setHeader("Authorization", headers.Authorization);
  return req;
}

export function createJsonRpcProvider(
  url: string,
  networkId: number,
  options?: JsonRpcApiProviderOptions
): JsonRpcProvider {
  return new JsonRpcProvider(jsonRpcProviderSource(url), networkId, {
    staticNetwork: true,
    cacheTimeout: -1,
    ...options,
  });
}

export async function jsonRpc<T>(url: string, body: JsonRpcRequest, timeoutMs = RPC_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = stripBlockmachineHttpQuery(url);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      headers: {
        ...jsonRpcAuthHeaders(url),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), ...body }),
      signal: mergeScanAbortSignal(controller.signal),
    });
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      markRpcAuthFailed(url);
      throw new Error(`RPC HTTP ${res.status} (API key disabled / unauthorized)`);
    }
    if (res.status === 429 || isRateLimitMessage(text, res.status)) {
      markRpcRateLimited(url, text, res.status);
      throw new Error(`RPC HTTP 429: rate limit exceeded`);
    }
    if (!res.ok) {
      throw new Error(`RPC HTTP ${res.status}: ${text.slice(0, 180) || res.statusText}`);
    }
    let json: { result?: T; error?: { message?: string; code?: number; data?: unknown } };
    try {
      json = JSON.parse(text) as { result?: T; error?: { message?: string; code?: number; data?: unknown } };
    } catch {
      throw new Error("RPC response bukan JSON.");
    }
    if (json.error) {
      const code = json.error.code;
      const detail = json.error.message || "RPC error";
      if (isRateLimitMessage(detail, res.status, code)) {
        markRpcRateLimited(url, text, res.status);
        throw new Error(`RPC ${code ?? 429}: rate limit exceeded`);
      }
      if (code === 401 || code === 403 || /unauthorized|disabled|api key/i.test(detail)) {
        markRpcAuthFailed(url);
        throw new Error(`RPC ${code ?? ""} ${detail}`.trim());
      }
      throw new RpcCallError(detail, json.error.data ?? json.error);
    }
    return json.result as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (scanAbortSignal()?.aborted) {
        throw new ScanRuntimeAbortError();
      }
      throw new Error("RPC timeout.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function rpcQueue(chainId: ChainId): string[] {
  return rpcCandidates(chainId);
}

export function rpcUrl(chainId: ChainId = "bsc"): string {
  return rpcQueue(chainId)[0] || "";
}

export async function withRpcFailover<T>(
  chainId: ChainId,
  run: (url: string) => Promise<T>,
  opts?: { purpose?: "scan" | "head" }
): Promise<T> {
  const purpose = opts?.purpose ?? "scan";
  const allowed = purpose === "head" ? isHttpRpcAllowed(chainId) : isScanRpcAllowed(chainId);
  if (!allowed) {
    throw new ScanRuntimeAbortError(
      purpose === "head"
        ? `quota: drop HTTP ${chainId}`
        : `quota/strict: drop RPC ${chainId}`
    );
  }
  /** Head/gas monitor boleh lintas strict-scan; scan tetap dikunci ke rantai aktif. */
  if (purpose !== "head") {
    denyForeignProviderChain(chainId);
  }
  const queue = rpcQueue(chainId);
  if (queue.length === 0) {
    throw new Error(
      chainId === "polygon"
        ? "RPC polygon belum dikonfigurasi. Isi Primary atau Backup RPC di Owner Dashboard, atau nyalakan sakelar yang sesuai."
        : "RPC belum dikonfigurasi. Nyalakan Primary atau Backup RPC untuk jaringan ini."
    );
  }

  const ready = queue.filter((url) => !isRpcCooling(url));
  const cooling = queue.filter((url) => isRpcCooling(url));
  const ordered = ready.length > 0 ? ready : queue;

  let lastError: unknown;
  let switched = false;
  if (cooling.length > 0 && ready.length > 0) {
    const first = cooling[0];
    const cu = rpcCooldowns.get(rpcHostKey(first));
    const cuBit =
      cu?.limit != null && Number.isFinite(cu.limit)
        ? ` · ${cu.remaining ?? 0}/${cu.limit} CU`
        : "";
    const coolWhy = cu?.reason === "auth" ? "kunci ditolak" : "rate-limited";
    logRpc(
      "warn",
      `${chainId}: ${roleLabel(providerRole(chainId, first))} ${coolWhy} (${redactEndpoint(first)}${cuBit}) · jeda ${rpcCooldownRemainSec(first)}s · lanjut ${roleLabel(providerRole(chainId, ordered[0] || first))}`,
      chainId
    );
  }

  for (const url of ordered) {
    if (
      (purpose === "head" ? !isHttpRpcAllowed(chainId) : !isScanRpcAllowed(chainId)) ||
      scanAbortSignal()?.aborted
    ) {
      throw new ScanRuntimeAbortError();
    }
    if (isRpcCooling(url) && ready.length > 0) continue;
    const role = roleLabel(providerRole(chainId, url));
    const remaining = ordered
      .slice(ordered.indexOf(url) + 1)
      .filter((item) => ready.length === 0 || !isRpcCooling(item));
    try {
      const result = await run(url);
      markHealthyRpc(chainId, url);
      if (switched) {
        logRpc(
          "warn",
          `${chainId}: beralih ke ${role} (${redactEndpoint(url)}). Scanning tetap berjalan.`,
          chainId
        );
      }
      return result;
    } catch (error) {
      if (error instanceof ScanRuntimeAbortError) throw error;
      lastError = error;
      switched = true;
      const msg = rpcErrorMessage(error);
      const hint = continueHint(chainId, remaining);
      if (isRpcAuthFailure(msg)) {
        markRpcAuthFailed(url);
        logRpc(
          "warn",
          `${chainId}: ${role} gagal (${redactEndpoint(url)}): RPC HTTP 401 (API key disabled / unauthorized) · jeda ${rpcCooldownRemainSec(url)}s${hint}`,
          chainId
        );
      } else if (isRateLimitMessage(msg)) {
        logRpc(
          "warn",
          `${chainId}: ${role} gagal (${redactEndpoint(url)}): rate limit exceeded · kuota RU Blockmachine / terlalu banyak request paralel · jeda ${rpcCooldownRemainSec(url)}s${hint}`,
          chainId
        );
      } else {
        logRpc("warn", `${chainId}: ${role} gagal (${redactEndpoint(url)}): ${msg}${hint}`, chainId);
      }
    }
  }
  logRpc("error", failoverExhaustedMessage(chainId), chainId);
  throw lastError instanceof Error ? lastError : new Error("Semua node RPC gagal.");
}

const blockMemo = new Map<ChainId, { block: number; at: number }>();
/** Jangan poll eth_blockNumber tiap tick scan 150–2000ms; samakan dengan waktu blok rantai. */
const BLOCK_POLL_MS: Partial<Record<ChainId, number>> = {
  ethereum: 4_000,
  bsc: 2_000,
  polygon: 2_000,
  arbitrum: 2_000,
  optimism: 2_000,
  base: 2_000,
};
const DEFAULT_BLOCK_POLL_MS = 2_000;
const blockInflight = new Map<ChainId, Promise<number>>();
const lastLoggedBlock = new Map<ChainId, number>();

export type GetBlockNumberOptions = {
  /** Lewati memo lokal; selalu query tag `latest`. */
  fresh?: boolean;
};

function blockPollMs(chainId: ChainId): number {
  return BLOCK_POLL_MS[chainId] ?? DEFAULT_BLOCK_POLL_MS;
}

function logBlockAdvance(chainId: ChainId, block: number): void {
  if (block <= 0) return;
  const prev = lastLoggedBlock.get(chainId);
  if (prev === block) return;
  lastLoggedBlock.set(chainId, block);
  const delta = prev && prev > 0 ? ` · Δ${block - prev}` : "";
  console.log(`[BLOCK] #${block} · ${chainId} · latest${delta}`);
}

type RpcBlockHeader = {
  number?: string;
  hash?: string;
  timestamp?: string;
};

/** Satu panggilan ringan; fallback ke header hanya jika perlu. */
async function readLatestBlockNumber(endpoint: string): Promise<number> {
  const hex = await jsonRpc<string>(endpoint, { method: "eth_blockNumber", params: [] });
  const fromHex = parseHexBlock(hex);
  if (fromHex > 0) return fromHex;
  const header = await jsonRpc<RpcBlockHeader | null>(endpoint, {
    method: "eth_getBlockByNumber",
    params: ["latest", false],
  });
  return header?.number ? parseHexBlock(header.number) : 0;
}

export async function getBlockNumber(
  url?: string,
  chainId: ChainId = "bsc",
  options?: GetBlockNumberOptions
): Promise<number> {
  if (!isHttpRpcAllowed(chainId)) {
    throw new ScanRuntimeAbortError(`quota: drop HTTP ${chainId}`);
  }
  const fresh = options?.fresh === true;
  const ttl = blockPollMs(chainId);
  if (url) {
    const block = await readLatestBlockNumber(url);
    logBlockAdvance(chainId, block);
    return block;
  }
  const cached = blockMemo.get(chainId);
  if (!fresh && cached && cached.block > 0 && Date.now() - cached.at < ttl) {
    return cached.block;
  }
  const pending = blockInflight.get(chainId);
  if (pending && !fresh) return pending;
  const work = (async () => {
    try {
      const block = await withRpcFailover(chainId, readLatestBlockNumber, { purpose: "head" });
      if (block > 0) {
        blockMemo.set(chainId, { block, at: Date.now() });
        logBlockAdvance(chainId, block);
      }
      return block;
    } catch (error) {
      if (error instanceof ScanRuntimeAbortError) throw error;
      const age = cached ? Date.now() - cached.at : Number.POSITIVE_INFINITY;
      /** Rate-limit / failover: pakai head terakhir lebih lama supaya UI tidak drop ke 0. */
      if (cached && cached.block > 0 && age < Math.max(ttl * 8, 30_000)) {
        return cached.block;
      }
      return 0;
    } finally {
      blockInflight.delete(chainId);
    }
  })();
  blockInflight.set(chainId, work);
  return work;
}

const gasMemo = new Map<ChainId, { wei: bigint; at: number }>();
const GAS_MEMO_MS = 1_000;
const gasInflight = new Map<ChainId, Promise<bigint>>();

export function peekMemoizedGasWei(chainId: ChainId = "bsc"): bigint {
  return gasMemo.get(chainId)?.wei ?? 0n;
}

export async function getGasPriceWei(
  url?: string,
  chainId: ChainId = "bsc"
): Promise<bigint> {
  // Solana: eth_gasPrice tidak ada — prioritization fee (µLamports) + fallback.
  // Jangan ikat ke quota HTTP Overview agar auto-exec tidak batal saat toggle OFF.
  if (chainId === "solana") {
    const cached = gasMemo.get(chainId);
    if (cached && cached.wei > 0n && Date.now() - cached.at < GAS_MEMO_MS) {
      return cached.wei;
    }
    const pending = gasInflight.get(chainId);
    if (pending) return pending;
    const work = (async () => {
      try {
        const { resolveSolanaPriorityFeeMicroLamports, SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS } =
          await import("@/lib/bot/solana/priorityFee");
        const fee = await resolveSolanaPriorityFeeMicroLamports();
        const wei =
          fee.microLamports > 0n
            ? fee.microLamports
            : SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS;
        gasMemo.set(chainId, { wei, at: Date.now() });
        return wei;
      } catch {
        const { SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS } = await import(
          "@/lib/bot/solana/priorityFee"
        );
        const wei = SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS;
        gasMemo.set(chainId, { wei, at: Date.now() });
        return wei;
      } finally {
        gasInflight.delete(chainId);
      }
    })();
    gasInflight.set(chainId, work);
    return work;
  }

  if (!isHttpRpcAllowed(chainId)) {
    throw new ScanRuntimeAbortError(`quota: drop HTTP ${chainId}`);
  }

  const read = async (endpoint: string) => {
    const hex = await jsonRpc<string>(endpoint, { method: "eth_gasPrice" });
    return BigInt(hex);
  };
  if (url) return read(url);
  const cached = gasMemo.get(chainId);
  if (cached && cached.wei > 0n && Date.now() - cached.at < GAS_MEMO_MS) {
    return cached.wei;
  }
  const pending = gasInflight.get(chainId);
  if (pending) return pending;
  const work = (async () => {
    try {
      const wei = await withRpcFailover(chainId, read, { purpose: "head" });
      if (wei > 0n) gasMemo.set(chainId, { wei, at: Date.now() });
      return wei;
    } catch (error) {
      if (error instanceof ScanRuntimeAbortError) throw error;
      return cached?.wei ?? 0n;
    } finally {
      gasInflight.delete(chainId);
    }
  })();
  gasInflight.set(chainId, work);
  return work;
}

export async function ethCall(
  tx: { from?: string; to: string; data: string },
  url?: string,
  chainId: ChainId = "bsc"
): Promise<string> {
  if (!isScanRpcAllowed(chainId)) {
    throw new ScanRuntimeAbortError(`quota/strict: drop RPC ${chainId}`);
  }
  const read = (endpoint: string) =>
    jsonRpc<string>(endpoint, { method: "eth_call", params: [tx, "latest"] }, url ? 12_000 : RPC_TIMEOUT_MS);
  if (url) return read(url);
  return withRpcFailover(chainId, read);
}

export async function ethEstimateGas(
  tx: { from?: string; to: string; data: string },
  url?: string,
  chainId: ChainId = "bsc"
): Promise<bigint> {
  if (!isScanRpcAllowed(chainId)) {
    throw new ScanRuntimeAbortError(`quota/strict: drop RPC ${chainId}`);
  }
  const read = async (endpoint: string) => {
    const hex = await jsonRpc<string>(endpoint, { method: "eth_estimateGas", params: [tx] }, url ? 12_000 : RPC_TIMEOUT_MS);
    return BigInt(hex);
  };
  if (url) return read(url);
  return withRpcFailover(chainId, read);
}

export { PAIR_ABI };

export function resetRpcMemos(): void {
  blockMemo.clear();
  gasMemo.clear();
  blockInflight.clear();
  gasInflight.clear();
  lastLoggedBlock.clear();
  rpcCooldowns.clear();
  rateLimitLogAt.clear();
}

onScanRuntimeReset(resetRpcMemos);
