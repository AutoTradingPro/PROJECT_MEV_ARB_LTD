import { bumpRpcProviderEpoch } from "@/lib/owner/nodeEndpoints";
import type { ChainId } from "@/lib/chain/networks";

export class ScanRuntimeAbortError extends Error {
  constructor(message = "scan runtime aborted") {
    super(message);
    this.name = "ScanRuntimeAbortError";
  }
}

export interface ScanRuntime {
  generation: number;
  chainId: ChainId;
  abort: AbortController;
}

type RuntimeGlobal = typeof globalThis & {
  __mevScanRuntime?: ScanRuntime;
  __mevStrictChainId?: ChainId;
  __mevExecChainId?: ChainId;
  __mevScanResets?: Array<() => void>;
};

function runtimeGlobal(): RuntimeGlobal {
  return globalThis as RuntimeGlobal;
}

export function onScanRuntimeReset(fn: () => void): void {
  const g = runtimeGlobal();
  if (!g.__mevScanResets) g.__mevScanResets = [];
  g.__mevScanResets.push(fn);
}

export function activeScanRuntime(): ScanRuntime | null {
  return runtimeGlobal().__mevScanRuntime ?? null;
}

export function activeScanChainId(): ChainId | null {
  return activeScanRuntime()?.chainId ?? null;
}

/** Chain yang diizinkan RPC/WSS/log — tetap diingat setelah abort sampai tab baru di-adopt. */
export function strictScanChainId(): ChainId | null {
  return runtimeGlobal().__mevStrictChainId ?? activeScanChainId();
}

export function isForeignScanChain(chainId: ChainId): boolean {
  const strict = strictScanChainId();
  return Boolean(strict && strict !== chainId);
}

/** Kunci rantai tanpa abort runner — dipakai saat hydrate dari bot-state. */
export function rememberStrictScanChain(chainId: ChainId): void {
  runtimeGlobal().__mevStrictChainId = chainId;
}

/** Pin rantai eksekusi agar HTTP/WSS exec tidak terorong ke default Polygon / rantai scan lain. */
export function pinnedExecChainId(): ChainId | null {
  return runtimeGlobal().__mevExecChainId ?? null;
}

export function pinExecChain(chainId: ChainId): () => void {
  const g = runtimeGlobal();
  const prev = g.__mevExecChainId;
  g.__mevExecChainId = chainId;
  return () => {
    if (g.__mevExecChainId === chainId) g.__mevExecChainId = prev;
  };
}

export function denyForeignProviderChain(chainId: ChainId, kind: "RPC" | "WSS" = "RPC"): void {
  if (!isForeignScanChain(chainId)) return;
  throw new ScanRuntimeAbortError(`strict single-chain: drop ${kind} ${chainId}`);
}

export function scanAbortSignal(): AbortSignal | undefined {
  return activeScanRuntime()?.abort.signal;
}

export function isScanLive(generation: number, chainId: ChainId): boolean {
  const current = activeScanRuntime();
  return Boolean(
    current &&
      current.generation === generation &&
      current.chainId === chainId &&
      !current.abort.signal.aborted
  );
}

export function assertScanLive(generation: number, chainId: ChainId): void {
  if (!isScanLive(generation, chainId)) {
    throw new ScanRuntimeAbortError(`[RUNNER] drop stale ${chainId} gen=${generation}`);
  }
}

function fireCacheResets(): void {
  bumpRpcProviderEpoch();
  for (const fn of runtimeGlobal().__mevScanResets ?? []) {
    try {
      fn();
    } catch {
      /* cache reset tidak boleh menggagalkan ganti rantai */
    }
  }
}

/** Hard-stop runner rantai lama, lalu kunci runtime ke rantai baru. */
export function hardAdoptScanChain(nextChain: ChainId, reason = "switch"): ScanRuntime {
  const g = runtimeGlobal();
  const prev = g.__mevScanRuntime;
  if (prev && prev.chainId === nextChain && !prev.abort.signal.aborted) {
    g.__mevStrictChainId = nextChain;
    return prev;
  }
  if (prev) {
    try {
      prev.abort.abort();
    } catch {
      /* ignore */
    }
    console.warn(
      `[RUNNER] SIGKILL ${prev.chainId} gen=${prev.generation} · ${reason} · adopt ${nextChain}`
    );
  }
  fireCacheResets();
  const next: ScanRuntime = {
    generation: (prev?.generation ?? 0) + 1,
    chainId: nextChain,
    abort: new AbortController(),
  };
  g.__mevScanRuntime = next;
  g.__mevStrictChainId = nextChain;
  console.log(`[RUNNER] start ${nextChain} gen=${next.generation} · Strict Single-Chain Mode`);
  return next;
}

/** Kunci runtime ke chain state tanpa abort jika sudah sama. */
export function ensureScanRuntime(chainId: ChainId, reason = "ensure"): ScanRuntime {
  const current = activeScanRuntime();
  if (current && current.chainId === chainId && !current.abort.signal.aborted) {
    runtimeGlobal().__mevStrictChainId = chainId;
    return current;
  }
  return hardAdoptScanChain(chainId, reason);
}

/** Mulai siklus scan. Ganti rantai = kill runner lama. Rantai sama = jangan abort RPC yang sedang jalan. */
export function beginScanCycle(chainId: ChainId): ScanRuntime {
  const g = runtimeGlobal();
  const prev = g.__mevScanRuntime;
  if (prev && prev.chainId !== chainId) {
    return hardAdoptScanChain(chainId, "scan");
  }
  const next: ScanRuntime = {
    generation: (prev?.generation ?? 0) + 1,
    chainId,
    abort: new AbortController(),
  };
  g.__mevScanRuntime = next;
  g.__mevStrictChainId = chainId;
  return next;
}

export function mergeScanAbortSignal(timeout: AbortSignal): AbortSignal {
  const scan = scanAbortSignal();
  if (!scan) return timeout;
  const merged = new AbortController();
  const abort = () => {
    try {
      merged.abort();
    } catch {
      /* ignore */
    }
  };
  if (timeout.aborted || scan.aborted) {
    abort();
    return merged.signal;
  }
  timeout.addEventListener("abort", abort, { once: true });
  scan.addEventListener("abort", abort, { once: true });
  return merged.signal;
}
