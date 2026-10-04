import { isBlockmachineHost } from "@/config/blockmachine";
import {
  ETHEREUM_PUBLIC_RPC_URL_FALLBACK,
  envArbitrumRpcUrl,
  envArbitrumRpcUrlFallback,
  envArbitrumWsUrl,
  envArbitrumWsUrlFallback,
  envAvalancheRpcUrl,
  envAvalancheRpcUrlFallback,
  envBaseRpcUrl,
  envBaseWsUrl,
  envFantomRpcUrl,
  envFantomWsUrl,
  envLineaRpcUrl,
  envLineaWsUrl,
  envAvalancheWsUrl,
  envAvalancheWsUrlFallback,
  envBscRpcUrl,
  envBscRpcUrlFallback,
  envBscWsUrl,
  envBscWsUrlFallback,
  envEthereumRpcUrl,
  envEthereumRpcUrlFallback,
  envEthereumWsUrl,
  envEthereumWsUrlFallback,
  envOptimismRpcUrl,
  envOptimismRpcUrlFallback,
  envOptimismWsUrl,
  envOptimismWsUrlFallback,
  envPolygonRpcUrl,
  envPolygonRpcUrlFallback,
  envPolygonWsUrl,
  envPolygonWsUrlFallback,
  envSolanaRpcUrl,
  envSolanaRpcUrlFallback,
  envSolanaWsUrl,
  envSolanaWsUrlFallback,
  isRetiredAnkrUrl,
} from "@/config/networks";
import type { ChainId } from "@/lib/chain/networks";
import { CHAINS, getChain } from "@/lib/chain/networks";
import { isBackupRpcEnabled, isPrimaryRpcEnabled } from "@/lib/owner/chainQuota";
import { keepIfRedacted, redactSensitiveUrl } from "@/lib/security/redactUrl";

export interface ChainNodeConfig {
  chainId: ChainId;
  primaryRpc: string;
  backupRpc: string;
  primaryWss: string;
  backupWss: string;
  lastHealthyRpc: string;
  lastHealthyWss: string;
}

export type NodeConfigMap = Record<ChainId, ChainNodeConfig>;

type NodeGlobal = typeof globalThis & {
  __mevOwnerNodeConfig?: NodeConfigMap;
  __mevBotRpcProviderEpoch?: number;
};

function envTrim(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function publicBackup(chainId: ChainId): { rpc: string; wss: string } {
  if (chainId === "optimism") {
    return { rpc: "https://optimism.publicnode.com", wss: "wss://optimism.publicnode.com" };
  }
  if (chainId === "avalanche") {
    return { rpc: "https://avalanche-c-chain.publicnode.com", wss: "wss://avalanche-c-chain.publicnode.com" };
  }
  if (chainId === "base") {
    return { rpc: "https://base.publicnode.com", wss: "wss://base.publicnode.com" };
  }
  if (chainId === "fantom") {
    return { rpc: "https://rpcapi.fantom.network", wss: "wss://fantom.publicnode.com" };
  }
  if (chainId === "solana") {
    return {
      rpc: envSolanaRpcUrlFallback() || "https://api.mainnet-beta.solana.com",
      wss: envSolanaWsUrlFallback() || "wss://api.mainnet-beta.solana.com",
    };
  }
  if (chainId === "cosmos") {
    return { rpc: "https://rpc.cosmos.network:443", wss: "wss://rpc.cosmos.network:443/websocket" };
  }
  if (chainId === "bsc") {
    return { rpc: "https://bsc-dataseed.binance.org", wss: "" };
  }
  return { rpc: "", wss: "" };
}

function seedOne(chainId: ChainId): ChainNodeConfig {
  const chain = getChain(chainId);
  const primaryRpc =
    chainId === "bsc"
      ? envBscRpcUrl()
      : chainId === "arbitrum"
        ? envArbitrumRpcUrl()
        : chainId === "polygon"
          ? envPolygonRpcUrl()
          : chainId === "ethereum"
            ? envEthereumRpcUrl() || chain.rpcUrl
          : chainId === "optimism"
            ? envOptimismRpcUrl() || chain.rpcUrl
          : chainId === "avalanche"
            ? envAvalancheRpcUrl() || chain.rpcUrl
          : chainId === "solana"
            ? envSolanaRpcUrl() || chain.rpcUrl
          : chainId === "base"
            ? envBaseRpcUrl() || chain.rpcUrl
          : chainId === "fantom"
            ? envFantomRpcUrl() || chain.rpcUrl
          : chainId === "linea"
            ? envLineaRpcUrl() || chain.rpcUrl
          : chain.rpcUrl;
  const primaryWss =
    chainId === "bsc"
      ? envBscWsUrl()
      : chainId === "arbitrum"
        ? envArbitrumWsUrl()
        : chainId === "polygon"
          ? envPolygonWsUrl()
          : chainId === "ethereum"
            ? envEthereumWsUrl() || chain.wsUrl
          : chainId === "optimism"
            ? envOptimismWsUrl() || chain.wsUrl
          : chainId === "avalanche"
            ? envAvalancheWsUrl() || chain.wsUrl
          : chainId === "solana"
            ? envSolanaWsUrl() || chain.wsUrl
          : chainId === "base"
            ? envBaseWsUrl() || chain.wsUrl
          : chainId === "fantom"
            ? envFantomWsUrl() || chain.wsUrl
          : chainId === "linea"
            ? envLineaWsUrl() || chain.wsUrl
          : chain.wsUrl;
  const envBackupRpc =
    chainId === "bsc"
      ? envBscRpcUrlFallback()
      : chainId === "arbitrum"
        ? envArbitrumRpcUrlFallback()
        : chainId === "polygon"
          ? envPolygonRpcUrlFallback()
          : chainId === "ethereum"
            ? envEthereumRpcUrlFallback()
          : chainId === "optimism"
            ? envOptimismRpcUrlFallback()
          : chainId === "avalanche"
            ? envAvalancheRpcUrlFallback()
          : chainId === "solana"
            ? envSolanaRpcUrlFallback()
          : "";
  const envBackupWss =
    chainId === "bsc"
      ? envBscWsUrlFallback()
      : chainId === "arbitrum"
        ? envArbitrumWsUrlFallback()
        : chainId === "polygon"
          ? envPolygonWsUrlFallback()
          : chainId === "ethereum"
            ? envEthereumWsUrlFallback()
          : chainId === "optimism"
            ? envOptimismWsUrlFallback()
          : chainId === "avalanche"
            ? envAvalancheWsUrlFallback()
          : chainId === "solana"
            ? envSolanaWsUrlFallback()
          : "";
  let backupRpc =
    envBackupRpc ||
    (chainId !== "polygon" && primaryRpc && chain.rpcUrl && primaryRpc !== chain.rpcUrl
      ? chain.rpcUrl
      : "");
  if (
    chainId === "ethereum" &&
    !backupRpc &&
    primaryRpc &&
    primaryRpc.replace(/\/$/, "") !== ETHEREUM_PUBLIC_RPC_URL_FALLBACK.replace(/\/$/, "")
  ) {
    backupRpc = ETHEREUM_PUBLIC_RPC_URL_FALLBACK;
  }
  const extra = publicBackup(chainId);
  if (!backupRpc && extra.rpc && extra.rpc.replace(/\/$/, "") !== primaryRpc.replace(/\/$/, "")) {
    backupRpc = extra.rpc;
  }
  const backupWss =
    envBackupWss ||
    (chainId !== "polygon" && primaryWss && chain.wsUrl && primaryWss !== chain.wsUrl
      ? chain.wsUrl
      : "");
  const resolvedBackupWss =
    backupWss ||
    (extra.wss && extra.wss.replace(/\/$/, "") !== primaryWss.replace(/\/$/, "") ? extra.wss : "");
  return {
    chainId,
    primaryRpc,
    backupRpc,
    primaryWss,
    backupWss: resolvedBackupWss,
    lastHealthyRpc: "",
    lastHealthyWss: "",
  };
}

function seedMap(): NodeConfigMap {
  return Object.fromEntries(CHAINS.map((chain) => [chain.id, seedOne(chain.id)])) as NodeConfigMap;
}

function fillEmptyFromSeed(row: ChainNodeConfig, seeded: ChainNodeConfig): void {
  if (!row.primaryRpc && seeded.primaryRpc) row.primaryRpc = seeded.primaryRpc;
  if (!row.backupRpc && seeded.backupRpc) row.backupRpc = seeded.backupRpc;
  if (!row.primaryWss && seeded.primaryWss) row.primaryWss = seeded.primaryWss;
  if (!row.backupWss && seeded.backupWss) row.backupWss = seeded.backupWss;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function shouldAdoptEnvEndpoint(current: string, seeded: string): boolean {
  if (!seeded) return false;
  if (!current) return true;
  if (current.replace(/\/$/, "").toLowerCase() === seeded.replace(/\/$/, "").toLowerCase()) return true;
  const nextHost = hostOf(seeded);
  const curHost = hostOf(current);
  if (nextHost.includes("onfinality.io")) {
    return (
      !current ||
      curHost.includes("onfinality.io") ||
      curHost.includes("ankr.com") ||
      curHost.includes("blockpi.network") ||
      curHost.includes("rpcfast.com") ||
      curHost.includes("quiknode.pro") ||
      curHost.includes("alchemy.com") ||
      curHost.includes("publicnode.com") ||
      curHost.includes("binance.org") ||
      curHost.includes("base.org") ||
      isBlockmachineHost(curHost) ||
      isDefaultPublicFallbackHost(curHost)
    );
  }
  if (nextHost.includes("blockpi.network")) {
    return (
      !current ||
      curHost.includes("ankr.com") ||
      curHost.includes("quiknode.pro") ||
      curHost.includes("alchemy.com") ||
      curHost.includes("publicnode.com") ||
      curHost.includes("binance.org") ||
      curHost.includes("base.org") ||
      curHost.includes("linea.build") ||
      isBlockmachineHost(curHost) ||
      isDefaultPublicFallbackHost(curHost)
    );
  }
  if (nextHost.includes("ankr.com")) {
    return (
      isBlockmachineHost(curHost) ||
      curHost.includes("ankr.com") ||
      curHost.includes("alchemy.com") ||
      curHost.includes("publicnode.com") ||
      curHost.includes("arb1.arbitrum.io") ||
      curHost.includes("polygon-rpc.com") ||
      curHost.includes("rpcfast.com") ||
      curHost.includes("api.mainnet-beta.solana.com")
    );
  }
  // Solana Primary: izinkan ganti Ankr / public / RPCFAST lama dari env.
  if (nextHost.includes("rpcfast.com")) {
    return (
      curHost.includes("ankr.com") ||
      curHost.includes("rpcfast.com") ||
      curHost.includes("api.mainnet-beta.solana.com") ||
      curHost.includes("alchemy.com") ||
      curHost.includes("publicnode.com")
    );
  }
  if (!isBlockmachineHost(nextHost)) return false;
  return (
    isBlockmachineHost(curHost) ||
    curHost.includes("ankr.com") ||
    curHost.includes("publicnode.com") ||
    curHost.includes("binance.org") ||
    curHost.includes("bsc-dataseed")
  );
}

function isDefaultPublicFallbackHost(host: string): boolean {
  return (
    host.includes("publicnode.com") ||
    host.includes("polygon-rpc.com") ||
    host.includes("arb1.arbitrum.io") ||
    host.includes("alchemy.com") ||
    host.includes("optimism.io") ||
    host.includes("api.avax.network") ||
    host.includes("api.mainnet-beta.solana.com") ||
    host === "solana-mainnet.g.alchemy.com"
  );
}

function isSolanaManagedBackupHost(host: string): boolean {
  return (
    host.includes("rpcfast.com") ||
    host.includes("onfinality.io") ||
    host.includes("api.mainnet-beta.solana.com") ||
    host.includes("ankr.com")
  );
}

/** Env cadangan (Blockmachine / RPCFAST) menggantikan public fallback, bukan endpoint custom Owner. */
function shouldAdoptEnvBackup(current: string, seeded: string): boolean {
  if (!seeded) return false;
  if (!current) return true;
  if (current.replace(/\/$/, "").toLowerCase() === seeded.replace(/\/$/, "").toLowerCase()) return true;
  const curHost = hostOf(current);
  const nextHost = hostOf(seeded);
  if (isBlockmachineHost(nextHost)) {
    return isDefaultPublicFallbackHost(curHost) || isBlockmachineHost(curHost);
  }
  // Solana Backup: izinkan rotasi antar Ankr / RPCFAST / public dari env (_2).
  if (isSolanaManagedBackupHost(nextHost) && isSolanaManagedBackupHost(curHost)) {
    return true;
  }
  return isDefaultPublicFallbackHost(curHost);
}

function syncScannerEndpoints(row: ChainNodeConfig, seeded: ChainNodeConfig): void {
  const before = `${row.primaryRpc}|${row.primaryWss}|${row.backupRpc}|${row.backupWss}`;
  fillEmptyFromSeed(row, seeded);
  if (shouldAdoptEnvEndpoint(row.primaryRpc, seeded.primaryRpc)) row.primaryRpc = seeded.primaryRpc;
  if (shouldAdoptEnvEndpoint(row.primaryWss, seeded.primaryWss)) row.primaryWss = seeded.primaryWss;
  if (shouldAdoptEnvBackup(row.backupRpc, seeded.backupRpc)) row.backupRpc = seeded.backupRpc;
  if (shouldAdoptEnvBackup(row.backupWss, seeded.backupWss)) row.backupWss = seeded.backupWss;
  if (`${row.primaryRpc}|${row.primaryWss}|${row.backupRpc}|${row.backupWss}` !== before) {
    bumpRpcProviderEpoch();
  }
}

export function getNodeConfigMap(): NodeConfigMap {
  const g = globalThis as NodeGlobal;
  if (!g.__mevOwnerNodeConfig) g.__mevOwnerNodeConfig = seedMap();
  const map = g.__mevOwnerNodeConfig;
  for (const chain of CHAINS) {
    if (!map[chain.id]) map[chain.id] = seedOne(chain.id);
    else syncScannerEndpoints(map[chain.id], seedOne(chain.id));
  }
  const row = map.bsc;
  if (row) {
    const backupRpc = envTrim("RPC_HTTP_URL_2", "NEXT_PUBLIC_BSC_RPC_URL_2");
    const backupWss = envTrim("RPC_WSS_URL_2", "NEXT_PUBLIC_BSC_WS_URL_2");
    if (backupRpc && !row.backupRpc) row.backupRpc = backupRpc;
    if (backupWss && !row.backupWss) row.backupWss = backupWss;
  }
  return map;
}

export function getChainNodeConfig(chainId: ChainId): ChainNodeConfig {
  return getNodeConfigMap()[chainId] ?? seedOne(chainId);
}

export function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw.trim();
    if (!url) continue;
    if (isRetiredAnkrUrl(url)) continue;
    const key = url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function isWsUrl(value: string): boolean {
  return /^wss?:\/\//i.test(value.trim());
}

function envPrimaryRpcFor(chainId: ChainId): string {
  if (chainId === "polygon") return envPolygonRpcUrl();
  if (chainId === "ethereum") return envEthereumRpcUrl();
  if (chainId === "arbitrum") return envArbitrumRpcUrl();
  if (chainId === "optimism") return envOptimismRpcUrl();
  if (chainId === "avalanche") return envAvalancheRpcUrl();
  if (chainId === "bsc") return envBscRpcUrl();
  if (chainId === "base") return envBaseRpcUrl();
  if (chainId === "fantom") return envFantomRpcUrl();
  if (chainId === "linea") return envLineaRpcUrl();
  return "";
}

function envBackupRpcFor(chainId: ChainId): string {
  if (chainId === "polygon") return envPolygonRpcUrlFallback();
  if (chainId === "ethereum") return envEthereumRpcUrlFallback();
  if (chainId === "arbitrum") return envArbitrumRpcUrlFallback();
  if (chainId === "optimism") return envOptimismRpcUrlFallback();
  if (chainId === "avalanche") return envAvalancheRpcUrlFallback();
  if (chainId === "bsc") return envBscRpcUrlFallback();
  return "";
}

function envPrimaryWssFor(chainId: ChainId): string {
  if (chainId === "polygon") return envPolygonWsUrl();
  if (chainId === "ethereum") return envEthereumWsUrl();
  if (chainId === "arbitrum") return envArbitrumWsUrl();
  if (chainId === "optimism") return envOptimismWsUrl();
  if (chainId === "avalanche") return envAvalancheWsUrl();
  if (chainId === "bsc") return envBscWsUrl();
  if (chainId === "solana") return envSolanaWsUrl();
  if (chainId === "base") return envBaseWsUrl();
  if (chainId === "fantom") return envFantomWsUrl();
  return "";
}

function envBackupWssFor(chainId: ChainId): string {
  if (chainId === "polygon") return envPolygonWsUrlFallback();
  if (chainId === "ethereum") return envEthereumWsUrlFallback();
  if (chainId === "arbitrum") return envArbitrumWsUrlFallback();
  if (chainId === "optimism") return envOptimismWsUrlFallback();
  if (chainId === "avalanche") return envAvalancheWsUrlFallback();
  if (chainId === "bsc") return envBscWsUrlFallback();
  return "";
}

export function rpcCandidates(chainId: ChainId): string[] {
  const row = getChainNodeConfig(chainId);
  const urls: string[] = [];
  if (isPrimaryRpcEnabled(chainId)) {
    urls.push(row.primaryRpc, envPrimaryRpcFor(chainId));
  }
  if (isBackupRpcEnabled(chainId)) {
    urls.push(row.backupRpc, envBackupRpcFor(chainId));
  }
  return uniqueUrls(urls);
}

export function wssCandidates(chainId: ChainId): string[] {
  const row = getChainNodeConfig(chainId);
  const urls: string[] = [];
  if (isPrimaryRpcEnabled(chainId)) {
    urls.push(row.primaryWss, envPrimaryWssFor(chainId));
  }
  if (isBackupRpcEnabled(chainId)) {
    urls.push(row.backupWss, envBackupWssFor(chainId));
  }
  return uniqueUrls(urls);
}

export function providerRole(chainId: ChainId, url: string): "primary" | "backup" | "unknown" {
  const row = getChainNodeConfig(chainId);
  const key = url.replace(/\/$/, "").toLowerCase();
  if (row.primaryRpc && key === row.primaryRpc.replace(/\/$/, "").toLowerCase()) return "primary";
  if (row.primaryWss && key === row.primaryWss.replace(/\/$/, "").toLowerCase()) return "primary";
  if (row.backupRpc && key === row.backupRpc.replace(/\/$/, "").toLowerCase()) return "backup";
  if (row.backupWss && key === row.backupWss.replace(/\/$/, "").toLowerCase()) return "backup";
  return "unknown";
}

export function roleLabel(role: "primary" | "backup" | "unknown"): string {
  if (role === "primary") return "Primary";
  if (role === "backup") return "Cadangan";
  return "Provider";
}

export function bumpRpcProviderEpoch(): void {
  const g = globalThis as NodeGlobal;
  g.__mevBotRpcProviderEpoch = (g.__mevBotRpcProviderEpoch ?? 0) + 1;
}

export function rpcProviderEpoch(): number {
  return (globalThis as NodeGlobal).__mevBotRpcProviderEpoch ?? 0;
}

export function markHealthyRpc(chainId: ChainId, url: string): void {
  const map = getNodeConfigMap();
  const row = map[chainId];
  if (!row) return;
  if (row.lastHealthyRpc !== url) {
    row.lastHealthyRpc = url;
    bumpRpcProviderEpoch();
  }
}

export function markHealthyWss(chainId: ChainId, url: string): void {
  const map = getNodeConfigMap();
  const row = map[chainId];
  if (!row) return;
  row.lastHealthyWss = url;
}

function normalizeRpcField(label: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!isHttpUrl(trimmed)) {
    throw new Error(`${label} harus URL HTTP/HTTPS.`);
  }
  return trimmed;
}

function normalizeWssField(label: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!isWsUrl(trimmed)) {
    throw new Error(`${label} harus URL WS/WSS.`);
  }
  return trimmed;
}

export function patchNodeConfigMap(input: Partial<Record<ChainId, Partial<ChainNodeConfig>>>): NodeConfigMap {
  const current = getNodeConfigMap();
  const next = { ...current };
  for (const chain of CHAINS) {
    const patch = input[chain.id];
    if (!patch) continue;
    const prev = current[chain.id] ?? seedOne(chain.id);
    next[chain.id] = {
      ...prev,
      primaryRpc: normalizeRpcField(
        `${chain.shortLabel} Primary RPC`,
        keepIfRedacted(patch.primaryRpc, prev.primaryRpc)
      ),
      backupRpc: normalizeRpcField(
        `${chain.shortLabel} Backup RPC`,
        keepIfRedacted(patch.backupRpc, prev.backupRpc)
      ),
      primaryWss: normalizeWssField(
        `${chain.shortLabel} Primary WSS`,
        keepIfRedacted(patch.primaryWss, prev.primaryWss)
      ),
      backupWss: normalizeWssField(
        `${chain.shortLabel} Backup WSS`,
        keepIfRedacted(patch.backupWss, prev.backupWss)
      ),
      lastHealthyRpc: "",
      lastHealthyWss: "",
    };
  }
  (globalThis as NodeGlobal).__mevOwnerNodeConfig = next;
  bumpRpcProviderEpoch();
  return next;
}

export function redactNodeConfig(row: ChainNodeConfig): ChainNodeConfig {
  return {
    ...row,
    primaryRpc: redactSensitiveUrl(row.primaryRpc),
    backupRpc: redactSensitiveUrl(row.backupRpc),
    primaryWss: redactSensitiveUrl(row.primaryWss),
    backupWss: redactSensitiveUrl(row.backupWss),
    lastHealthyRpc: redactSensitiveUrl(row.lastHealthyRpc),
    lastHealthyWss: redactSensitiveUrl(row.lastHealthyWss),
  };
}

export function redactNodeConfigMap(map: NodeConfigMap): NodeConfigMap {
  return Object.fromEntries(
    CHAINS.map((chain) => [chain.id, redactNodeConfig(map[chain.id] ?? seedOne(chain.id))])
  ) as NodeConfigMap;
}
