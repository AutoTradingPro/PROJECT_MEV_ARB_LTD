import type { ChainId } from "@/lib/chain/networks";
import { pinnedExecChainId, strictScanChainId } from "@/lib/bot/scanRuntime";
import {
  emptyOwnerChainFlags,
  isOwnerNodeChainId,
  OWNER_NODE_CHAIN_IDS,
  type OwnerNodeChainId,
} from "@/lib/owner/ownerNodeChains";
import { isScannerChainId, type ScannerChainId } from "@/config/networks";

export type { OwnerNodeChainId };

export interface ChainQuotaState {
  /** Master WSS: true = Mode Publik (semua jaringan ON), false = Mode Hemat (hanya rantai terpilih). */
  wssEnabled: boolean;
  /** Master RPC: true = Mode Publik, false = Mode Hemat. */
  rpcFallbackEnabled: boolean;
  /** Toggle per jaringan. false = mati total (tidak ada RPC/WSS). */
  chains: Record<OwnerNodeChainId, boolean>;
  /** Primary HTTP/WSS per jaringan. false = scan/monitor tidak memakai Primary. */
  rpcPrimary: Record<OwnerNodeChainId, boolean>;
  /** Backup HTTP/WSS per jaringan. true + Primary off = cadangan saja. */
  rpcBackup: Record<OwnerNodeChainId, boolean>;
}

type QuotaGlobal = typeof globalThis & {
  __mevChainQuota?: ChainQuotaState;
};

function quotaGlobal(): QuotaGlobal {
  return globalThis as QuotaGlobal;
}

export function defaultChainQuota(): ChainQuotaState {
  return {
    wssEnabled: false,
    rpcFallbackEnabled: false,
    chains: emptyOwnerChainFlags(false),
    rpcPrimary: emptyOwnerChainFlags(false),
    rpcBackup: emptyOwnerChainFlags(false),
  };
}

export function normalizeChainQuota(raw: Partial<ChainQuotaState> | null | undefined): ChainQuotaState {
  const base = defaultChainQuota();
  if (!raw) return base;
  const chains = { ...base.chains };
  const rpcPrimary = { ...base.rpcPrimary };
  const rpcBackup = { ...base.rpcBackup };
  // Migrate slot lama Cosmos → Solana (kartu Overview).
  const legacy = raw as {
    chains?: Record<string, boolean>;
    rpcPrimary?: Record<string, boolean>;
    rpcBackup?: Record<string, boolean>;
  };
  if (typeof legacy.chains?.cosmos === "boolean" && typeof legacy.chains?.solana !== "boolean") {
    chains.solana = legacy.chains.cosmos;
  }
  if (typeof legacy.rpcPrimary?.cosmos === "boolean" && typeof legacy.rpcPrimary?.solana !== "boolean") {
    rpcPrimary.solana = legacy.rpcPrimary.cosmos;
  }
  if (typeof legacy.rpcBackup?.cosmos === "boolean" && typeof legacy.rpcBackup?.solana !== "boolean") {
    rpcBackup.solana = legacy.rpcBackup.cosmos;
  }
  for (const id of OWNER_NODE_CHAIN_IDS) {
    if (typeof raw.chains?.[id] === "boolean") chains[id] = raw.chains[id];
    if (typeof raw.rpcPrimary?.[id] === "boolean") rpcPrimary[id] = raw.rpcPrimary[id];
    if (typeof raw.rpcBackup?.[id] === "boolean") rpcBackup[id] = raw.rpcBackup[id];
  }
  return {
    wssEnabled: raw.wssEnabled === true,
    rpcFallbackEnabled: raw.rpcFallbackEnabled === true,
    chains,
    rpcPrimary,
    rpcBackup,
  };
}

function loadQuota(): ChainQuotaState {
  const g = quotaGlobal();
  g.__mevChainQuota = normalizeChainQuota(g.__mevChainQuota);
  return g.__mevChainQuota;
}

export function replaceChainQuota(next: ChainQuotaState): ChainQuotaState {
  quotaGlobal().__mevChainQuota = normalizeChainQuota(next);
  return getChainQuota();
}

export function getChainQuota(): ChainQuotaState {
  const current = loadQuota();
  return {
    ...current,
    chains: { ...current.chains },
    rpcPrimary: { ...current.rpcPrimary },
    rpcBackup: { ...current.rpcBackup },
  };
}

export function patchChainQuota(partial: {
  wssEnabled?: boolean;
  rpcFallbackEnabled?: boolean;
  chains?: Partial<Record<OwnerNodeChainId, boolean>>;
  rpcPrimary?: Partial<Record<OwnerNodeChainId, boolean>>;
  rpcBackup?: Partial<Record<OwnerNodeChainId, boolean>>;
}): ChainQuotaState {
  const current = loadQuota();
  return replaceChainQuota(
    normalizeChainQuota({
      wssEnabled: partial.wssEnabled ?? current.wssEnabled,
      rpcFallbackEnabled: partial.rpcFallbackEnabled ?? current.rpcFallbackEnabled,
      chains: { ...current.chains, ...partial.chains },
      rpcPrimary: { ...current.rpcPrimary, ...partial.rpcPrimary },
      rpcBackup: { ...current.rpcBackup, ...partial.rpcBackup },
    })
  );
}

export function isScannerFeedChain(chainId: ChainId): chainId is ScannerChainId {
  return isScannerChainId(chainId);
}

/** Jaringan dimatikan owner — tidak boleh ada fetch provider. Default OFF. */
export function isChainFeedEnabled(chainId: ChainId): boolean {
  if (!isOwnerNodeChainId(chainId)) return true;
  return loadQuota().chains[chainId] === true;
}

function isSelectedChain(chainId: ChainId): boolean {
  if (pinnedExecChainId() === chainId) return true;
  const strict = strictScanChainId();
  return !strict || strict === chainId;
}

/** Primary HTTP/WSS diizinkan untuk rantai ini. Default OFF. */
export function isPrimaryRpcEnabled(chainId: ChainId): boolean {
  if (!isOwnerNodeChainId(chainId)) return true;
  return loadQuota().rpcPrimary[chainId] === true;
}

/** Backup HTTP/WSS diizinkan untuk rantai ini. Default OFF. */
export function isBackupRpcEnabled(chainId: ChainId): boolean {
  if (!isOwnerNodeChainId(chainId)) return true;
  return loadQuota().rpcBackup[chainId] === true;
}

/** HTTP JSON-RPC (head / gas) diizinkan untuk rantai ini. */
export function isHttpRpcAllowed(chainId: ChainId): boolean {
  if (!isChainFeedEnabled(chainId)) return false;
  if (!isPrimaryRpcEnabled(chainId) && !isBackupRpcEnabled(chainId)) return false;
  if (loadQuota().rpcFallbackEnabled) return true;
  if (isSelectedChain(chainId)) return true;
  /** Mode Hemat: rantai scan OFF → izinkan head monitor di rantai ON (hindari sinyal header merah palsu). */
  const selected = pinnedExecChainId() ?? strictScanChainId();
  return Boolean(selected && !isChainFeedEnabled(selected));
}

/** WSS newHeads diizinkan untuk rantai ini. */
export function isWssAllowed(chainId: ChainId): boolean {
  if (!isChainFeedEnabled(chainId)) return false;
  if (!isPrimaryRpcEnabled(chainId) && !isBackupRpcEnabled(chainId)) return false;
  if (loadQuota().wssEnabled) return true;
  if (isSelectedChain(chainId)) return true;
  const selected = pinnedExecChainId() ?? strictScanChainId();
  return Boolean(selected && !isChainFeedEnabled(selected));
}

/** Scan pair / eth_call bot: rantai harus ON dan sama dengan rantai terpilih. */
export function isScanRpcAllowed(chainId: ChainId): boolean {
  if (!isChainFeedEnabled(chainId)) return false;
  if (!isPrimaryRpcEnabled(chainId) && !isBackupRpcEnabled(chainId)) return false;
  return isSelectedChain(chainId);
}

export function describeFeedMode(): { wss: "publik" | "hemat"; rpc: "publik" | "hemat" } {
  const quota = loadQuota();
  return {
    wss: quota.wssEnabled ? "publik" : "hemat",
    rpc: quota.rpcFallbackEnabled ? "publik" : "hemat",
  };
}
