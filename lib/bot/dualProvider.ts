import { JsonRpcProvider, WebSocketProvider, type Provider } from "ethers";
import { appendBlockmachineWsAuth } from "@/config/blockmachine";
import {
  envArbitrumWsUrl,
  envBscWsUrl,
  envEthereumWsUrl,
  envPolygonWsUrl,
  envSolanaExecutorRpcUrl,
  envSolanaExecutorWsUrl,
  envSolanaWsUrl,
} from "@/config/networks";
import { createJsonRpcProvider, redactEndpoint, rpcUrl } from "@/lib/bot/rpc";
import type { ChainId } from "@/lib/chain/networks";
import { getChain } from "@/lib/chain/networks";
import { wssCandidates } from "@/lib/owner/nodeEndpoints";
import { onScanRuntimeReset, ScanRuntimeAbortError } from "@/lib/bot/scanRuntime";
import { isScanRpcAllowed, isWssAllowed } from "@/lib/owner/chainQuota";

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

type DualGlobal = typeof globalThis & {
  __mevReadWssByChain?: Partial<Record<ChainId, { url: string; provider: WebSocketProvider }>>;
};

function wssByChain(): NonNullable<DualGlobal["__mevReadWssByChain"]> {
  const g = globalThis as DualGlobal;
  if (!g.__mevReadWssByChain) g.__mevReadWssByChain = {};
  return g.__mevReadWssByChain;
}

function warnIfNotJsonRpcWriteUrl(url: string): void {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "flashbots.net" || host === "docs.flashbots.net") {
      console.warn(
        `[EXEC] ${redactEndpoint(url)} adalah situs web, bukan JSON-RPC. ` +
          "Isi NEXT_PUBLIC_ARBITRUM_FLASHBOTS_RPC_URL dengan endpoint RPC privat Arbitrum yang valid."
      );
    }
  } catch {
    /* ignore */
  }
}

/** WSS listener (Blockmachine). Tidak dipakai untuk broadcast tx. */
export function readWssUrl(chainId: ChainId = "arbitrum"): string {
  const owner = wssCandidates(chainId)[0];
  if (owner) return owner;
  if (chainId === "arbitrum") {
    return (
      envArbitrumWsUrl() ||
      firstEnv("ARBITRUM_WSS_URL", "RPC_WSS_URL_ARBITRUM")
    );
  }
  if (chainId === "polygon") {
    return envPolygonWsUrl();
  }
  if (chainId === "ethereum") {
    return envEthereumWsUrl();
  }
  if (chainId === "bsc") {
    return envBscWsUrl();
  }
  if (chainId === "solana") {
    // Executor QuickNode untuk pantau slot/block real-time; Ankr sebagai cadangan scan.
    return envSolanaExecutorWsUrl() || envSolanaWsUrl();
  }
  return firstEnv("RPC_WSS_URL", "NEXT_PUBLIC_BSC_WS_URL");
}

/**
 * RPC tulis: QuickNode MEV Protection saja (bukan Alchemy scanner).
 * Dipakai untuk broadcast flashloan / privateSubmit.
 */
export function isMevProtectionEnabled(): boolean {
  const flag = (process.env.MEV_PROTECTION_ENABLED || process.env.QUICKNODE_MEV_PROTECT || "true")
    .trim()
    .toLowerCase();
  return flag !== "0" && flag !== "false" && flag !== "off" && flag !== "no";
}

/** Header JSON-RPC broadcast saat MEV Protection QuickNode aktif. */
export function mevProtectFetchHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (isMevProtectionEnabled()) {
    headers["x-qn-mev-protect"] = "true";
  }
  return headers;
}

/** Pastikan URL executor adalah QuickNode (bukan Alchemy scanner). */
function isQuickNodeHost(url: string): boolean {
  try {
    return /quiknode\.pro|quicknode/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function privateExecutorRpcUrl(chainId: ChainId = "arbitrum"): string {
  if (chainId === "arbitrum") {
    const url = firstEnv(
      "ARBITRUM_EXEC_RPC_URL",
      "QUICKNODE_ARBITRUM_RPC_URL",
      "BLOCKPI_RPC_ARBITRUM",
      "ARBITRUM_FLASHBOTS_RPC_URL",
      "NEXT_PUBLIC_ARBITRUM_FLASHBOTS_RPC_URL"
    );
    return url;
  }
  if (chainId === "polygon") {
    return firstEnv(
      "POLYGON_EXEC_RPC_URL",
      "QUICKNODE_POLYGON_RPC_URL",
      "BLOCKPI_RPC_POLYGON",
      "PRIVATE_RPC_URL_POLYGON"
    );
  }
  if (chainId === "ethereum") {
    return firstEnv(
      "ETHEREUM_EXEC_RPC_URL",
      "QUICKNODE_ETHEREUM_RPC_URL",
      "BLOCKPI_RPC_ETHEREUM"
    );
  }
  if (chainId === "solana") {
    return (
      envSolanaExecutorRpcUrl() ||
      firstEnv(
        "SOLANA_EXECUTOR_RPC_URL",
        "SOLANA_EXEC_RPC_URL",
        "QUICKNODE_SOLANA_RPC_URL"
      )
    );
  }
  return firstEnv("PRIVATE_RPC_URL_BSC", "PRIVATE_RELAY_URL", "RPC_HTTP_URL");
}

export function publicReadRpcUrl(chainId: ChainId = "arbitrum"): string {
  return rpcUrl(chainId);
}

export function chainNetworkId(chainId: ChainId): number {
  const fromConfig = getChain(chainId).chainId;
  if (typeof fromConfig === "number" && fromConfig > 0) return fromConfig;
  if (chainId === "arbitrum") return 42161;
  if (chainId === "polygon") return 137;
  if (chainId === "ethereum") return 1;
  return 56;
}

export function makeReadHttpProvider(chainId: ChainId, endpoint?: string): JsonRpcProvider {
  if (!isScanRpcAllowed(chainId) && !isWssAllowed(chainId)) {
    throw new ScanRuntimeAbortError(`quota: drop HTTP ${chainId}`);
  }
  const url = endpoint || publicReadRpcUrl(chainId);
  return createJsonRpcProvider(url, chainNetworkId(chainId));
}

/** readProvider: Blockmachine WSS (fallback HTTP Blockmachine jika WSS kosong). */
export function makeReadProvider(chainId: ChainId, httpFallback?: string): Provider {
  if (!isWssAllowed(chainId)) {
    destroyReadWssProvider(chainId);
    if (!isScanRpcAllowed(chainId)) {
      throw new ScanRuntimeAbortError(`quota: drop WSS ${chainId}`);
    }
    return makeReadHttpProvider(chainId, httpFallback);
  }
  const wss = readWssUrl(chainId);
  if (!wss) return makeReadHttpProvider(chainId, httpFallback);

  const slots = wssByChain();
  const cached = slots[chainId];
  if (cached?.url === wss) return cached.provider;

  if (cached) {
    try {
      const result = cached.provider.destroy() as void | Promise<void>;
      if (result && typeof result.catch === "function") void result.catch(() => undefined);
    } catch {
      /* ignore */
    }
    delete slots[chainId];
  }

  const provider = new WebSocketProvider(appendBlockmachineWsAuth(wss), chainNetworkId(chainId));
  slots[chainId] = { url: wss, provider };
  console.log(`[EXEC] readProvider WSS ${redactEndpoint(wss)}`);
  return provider;
}

export function requireExecutorRpcUrl(chainId: ChainId = "arbitrum"): string {
  const url = privateExecutorRpcUrl(chainId);
  if (url) {
    if (!isQuickNodeHost(url)) {
      console.warn(
        `[EXEC] ${redactEndpoint(url)} bukan host QuickNode — pastikan *_EXEC_RPC_URL / QUICKNODE_* mengarah ke quiknode.pro (MEV-protect).`
      );
    }
    return url;
  }
  if (chainId === "arbitrum") {
    throw new Error(
      "[EXEC] QuickNode Arbitrum belum diisi. Set ARBITRUM_EXEC_RPC_URL / QUICKNODE_ARBITRUM_RPC_URL di .env.local."
    );
  }
  if (chainId === "polygon") {
    throw new Error(
      "[EXEC] QuickNode Polygon belum diisi. Set POLYGON_EXEC_RPC_URL / QUICKNODE_POLYGON_RPC_URL di .env.local."
    );
  }
  if (chainId === "ethereum") {
    throw new Error(
      "[EXEC] QuickNode Ethereum belum diisi. Set ETHEREUM_EXEC_RPC_URL / QUICKNODE_ETHEREUM_RPC_URL di .env.local."
    );
  }
  if (chainId === "solana") {
    throw new Error(
      "[EXEC] QuickNode Solana belum diisi. Set SOLANA_EXECUTOR_RPC_URL / QUICKNODE_SOLANA_RPC_URL di .env.local."
    );
  }
  const fallback = publicReadRpcUrl(chainId);
  if (!fallback) {
    throw new Error("[EXEC] RPC tulis belum dikonfigurasi.");
  }
  return fallback;
}

/** writeProvider: QuickNode MEV-protect untuk [EXEC] (terpisah dari Alchemy scanner). */
export function makeWriteProvider(chainId: ChainId, endpoint?: string): JsonRpcProvider {
  if (chainId === "solana") {
    throw new Error(
      "[EXEC] Solana memakai lib/bot/solana/executor (QuickNode sendTransaction), bukan ethers writeProvider."
    );
  }
  if (!isScanRpcAllowed(chainId)) {
    throw new ScanRuntimeAbortError(`quota/strict: drop RPC ${chainId}`);
  }
  const url = endpoint || requireExecutorRpcUrl(chainId);
  warnIfNotJsonRpcWriteUrl(url);
  const mev = isMevProtectionEnabled() ? " · MEV-protect ON" : "";
  const via = isQuickNodeHost(url) ? "QuickNode" : "RPC";
  console.log(`[EXEC] writeProvider ${via} ${redactEndpoint(url)}${mev}`);
  return createJsonRpcProvider(url, chainNetworkId(chainId), { staticNetwork: true, batchMaxCount: 1 });
}

export function makeWriteHttpProvider(chainId: ChainId, endpoint?: string): JsonRpcProvider {
  return makeWriteProvider(chainId, endpoint);
}

export function resolveWriteRpcUrl(
  chainId: ChainId,
  _useBundle: boolean,
  _publicFallback?: string
): string {
  if (
    chainId === "arbitrum" ||
    chainId === "polygon" ||
    chainId === "ethereum" ||
    chainId === "solana"
  ) {
    return requireExecutorRpcUrl(chainId);
  }
  const publicUrl = _publicFallback || publicReadRpcUrl(chainId);
  if (!publicUrl) {
    throw new Error("[EXEC] RPC tulis belum dikonfigurasi.");
  }
  return privateExecutorRpcUrl(chainId) || publicUrl;
}

export function describeExecutorPath(chainId: ChainId, useBundle = true): {
  writeUrl: string;
  readUrl: string;
  privateWrite: boolean;
} {
  const writeUrl =
    chainId === "arbitrum" ||
    chainId === "polygon" ||
    chainId === "ethereum" ||
    chainId === "solana"
      ? requireExecutorRpcUrl(chainId)
      : useBundle
        ? privateExecutorRpcUrl(chainId) || publicReadRpcUrl(chainId)
        : publicReadRpcUrl(chainId);
  const readUrl =
    chainId === "solana"
      ? envSolanaExecutorWsUrl() || readWssUrl(chainId) || publicReadRpcUrl(chainId)
      : readWssUrl(chainId) || publicReadRpcUrl(chainId);
  return {
    writeUrl,
    readUrl,
    privateWrite: Boolean(privateExecutorRpcUrl(chainId)),
  };
}

/** WSS QuickNode Solana executor (slot / block / mempool). */
export function privateExecutorWsUrl(chainId: ChainId): string {
  if (chainId === "solana") {
    return envSolanaExecutorWsUrl();
  }
  return "";
}

export function destroyReadWssProvider(chainId?: ChainId): void {
  const slots = wssByChain();
  const ids = chainId ? [chainId] : (Object.keys(slots) as ChainId[]);
  for (const id of ids) {
    const slot = slots[id];
    if (!slot) continue;
    try {
      const result = slot.provider.destroy() as void | Promise<void>;
      if (result && typeof result.catch === "function") void result.catch(() => undefined);
    } catch {
      /* ignore */
    }
    delete slots[id];
  }
}

onScanRuntimeReset(destroyReadWssProvider);

