"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { NodeFeedChannel } from "@/lib/owner/nodeFeedLog";
import {
  emptyOwnerChainFlags,
  OWNER_NODE_CHAIN_IDS,
  type OwnerNodeChainId,
} from "@/lib/owner/ownerNodeChains";

const STORAGE_KEY = "mev-arb-node-feed-control";
const LEGACY_WSS_KEY = "mev-arb-wss-live-feed";

export type ChainFeedMap = Record<OwnerNodeChainId, boolean>;

interface PersistedFeed {
  wssEnabled: boolean;
  rpcFallbackEnabled: boolean;
  chains?: Partial<ChainFeedMap>;
  rpcPrimary?: Partial<ChainFeedMap>;
  rpcBackup?: Partial<ChainFeedMap>;
}

interface RpcLiveFeedContextValue {
  wssEnabled: boolean;
  rpcFallbackEnabled: boolean;
  chains: ChainFeedMap;
  rpcPrimary: ChainFeedMap;
  rpcBackup: ChainFeedMap;
  setWssEnabled: (enabled: boolean) => void;
  setRpcFallbackEnabled: (enabled: boolean) => void;
  toggleWssEnabled: () => void;
  toggleRpcFallbackEnabled: () => void;
  setChainEnabled: (chainId: OwnerNodeChainId, enabled: boolean) => void;
  setPrimaryRpcEnabled: (chainId: OwnerNodeChainId, enabled: boolean) => void;
  setBackupRpcEnabled: (chainId: OwnerNodeChainId, enabled: boolean) => void;
  liveFeedActive: boolean;
  publicMode: boolean;
}

/** Default hemat: semua jaringan OFF sampai di-toggle manual di Overview. */
const DEFAULT_CHAINS: ChainFeedMap = emptyOwnerChainFlags(false);

const RpcLiveFeedContext = createContext<RpcLiveFeedContextValue | null>(null);

function readPersisted(): PersistedFeed | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedFeed>;
      return {
        wssEnabled: parsed.wssEnabled === true,
        rpcFallbackEnabled: parsed.rpcFallbackEnabled === true,
        chains: parsed.chains,
        rpcPrimary: parsed.rpcPrimary,
        rpcBackup: parsed.rpcBackup,
      };
    }
    const legacy = localStorage.getItem(LEGACY_WSS_KEY);
    if (legacy === "on") return { wssEnabled: true, rpcFallbackEnabled: true };
    if (legacy === "off") return { wssEnabled: false, rpcFallbackEnabled: false };
    return null;
  } catch {
    return null;
  }
}

function writePersisted(next: PersistedFeed): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(LEGACY_WSS_KEY, next.wssEnabled ? "on" : "off");
  } catch {
    /* ignore */
  }
}

function mergeChains(raw?: Partial<ChainFeedMap>, fallback = false): ChainFeedMap {
  const next = emptyOwnerChainFlags(fallback);
  for (const id of OWNER_NODE_CHAIN_IDS) {
    if (typeof raw?.[id] === "boolean") next[id] = raw[id];
  }
  return next;
}

function sameChainMap(a: ChainFeedMap, b: ChainFeedMap): boolean {
  for (const id of OWNER_NODE_CHAIN_IDS) {
    if (a[id] !== b[id]) return false;
  }
  return true;
}

function samePersisted(
  next: PersistedFeed,
  wss: boolean,
  rpc: boolean,
  chains: ChainFeedMap,
  primary: ChainFeedMap,
  backup: ChainFeedMap
): boolean {
  if (next.wssEnabled !== wss || next.rpcFallbackEnabled !== rpc) return false;
  if (!sameChainMap(mergeChains(next.chains ?? chains, false), chains)) return false;
  if (!sameChainMap(mergeChains(next.rpcPrimary ?? primary, false), primary)) return false;
  if (!sameChainMap(mergeChains(next.rpcBackup ?? backup, false), backup)) return false;
  return true;
}

export function RpcLiveFeedProvider({ children }: { children: ReactNode }) {
  const [wssEnabled, setWssState] = useState(false);
  const [rpcFallbackEnabled, setRpcState] = useState(false);
  const [chains, setChains] = useState<ChainFeedMap>(DEFAULT_CHAINS);
  const [rpcPrimary, setRpcPrimary] = useState<ChainFeedMap>(DEFAULT_CHAINS);
  const [rpcBackup, setRpcBackup] = useState<ChainFeedMap>(DEFAULT_CHAINS);
  const wssRef = useRef(false);
  const rpcRef = useRef(false);
  const chainsRef = useRef<ChainFeedMap>(DEFAULT_CHAINS);
  const rpcPrimaryRef = useRef<ChainFeedMap>(DEFAULT_CHAINS);
  const rpcBackupRef = useRef<ChainFeedMap>(DEFAULT_CHAINS);

  const applyLocal = useCallback((next: PersistedFeed) => {
    if (
      samePersisted(
        next,
        wssRef.current,
        rpcRef.current,
        chainsRef.current,
        rpcPrimaryRef.current,
        rpcBackupRef.current
      )
    ) {
      return;
    }
    const nextChains = mergeChains(next.chains ?? chainsRef.current, false);
    const nextPrimary = mergeChains(next.rpcPrimary ?? rpcPrimaryRef.current, false);
    const nextBackup = mergeChains(next.rpcBackup ?? rpcBackupRef.current, false);
    wssRef.current = next.wssEnabled;
    rpcRef.current = next.rpcFallbackEnabled;
    chainsRef.current = nextChains;
    rpcPrimaryRef.current = nextPrimary;
    rpcBackupRef.current = nextBackup;
    setWssState(next.wssEnabled);
    setRpcState(next.rpcFallbackEnabled);
    setChains(nextChains);
    setRpcPrimary(nextPrimary);
    setRpcBackup(nextBackup);
    writePersisted({
      ...next,
      chains: nextChains,
      rpcPrimary: nextPrimary,
      rpcBackup: nextBackup,
    });
  }, []);

  const hydrateFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/system-control", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { quota?: PersistedFeed };
      if (!data.quota) return;
      applyLocal({
        wssEnabled: data.quota.wssEnabled === true,
        rpcFallbackEnabled: data.quota.rpcFallbackEnabled === true,
        chains: data.quota.chains,
        rpcPrimary: data.quota.rpcPrimary,
        rpcBackup: data.quota.rpcBackup,
      });
    } catch {
      /* ignore */
    }
  }, [applyLocal]);

  useEffect(() => {
    const stored = readPersisted();
    if (stored) {
      applyLocal({
        wssEnabled: stored.wssEnabled === true,
        rpcFallbackEnabled: stored.rpcFallbackEnabled === true,
        chains: stored.chains,
        rpcPrimary: stored.rpcPrimary,
        rpcBackup: stored.rpcBackup,
      });
    }
    void hydrateFromApi();
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Partial<PersistedFeed>;
        applyLocal({
          wssEnabled: parsed.wssEnabled === true,
          rpcFallbackEnabled: parsed.rpcFallbackEnabled === true,
          chains: parsed.chains,
          rpcPrimary: parsed.rpcPrimary,
          rpcBackup: parsed.rpcBackup,
        });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    const id = window.setInterval(() => void hydrateFromApi(), 5000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
    };
  }, [applyLocal, hydrateFromApi]);

  const postChannel = useCallback((channel: NodeFeedChannel, enabled: boolean) => {
    void fetch("/api/owner/system-control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel, enabled }),
    }).catch(() => undefined);
  }, []);

  const setWssEnabled = useCallback(
    (enabled: boolean) => {
      if (wssRef.current === enabled) return;
      applyLocal({
        wssEnabled: enabled,
        rpcFallbackEnabled: rpcRef.current,
        chains: chainsRef.current,
        rpcPrimary: rpcPrimaryRef.current,
        rpcBackup: rpcBackupRef.current,
      });
      postChannel("wss", enabled);
    },
    [applyLocal, postChannel]
  );

  const setRpcFallbackEnabled = useCallback(
    (enabled: boolean) => {
      if (rpcRef.current === enabled) return;
      applyLocal({
        wssEnabled: wssRef.current,
        rpcFallbackEnabled: enabled,
        chains: chainsRef.current,
        rpcPrimary: rpcPrimaryRef.current,
        rpcBackup: rpcBackupRef.current,
      });
      postChannel("rpc", enabled);
    },
    [applyLocal, postChannel]
  );

  const toggleWssEnabled = useCallback(() => {
    setWssEnabled(!wssRef.current);
  }, [setWssEnabled]);

  const toggleRpcFallbackEnabled = useCallback(() => {
    setRpcFallbackEnabled(!rpcRef.current);
  }, [setRpcFallbackEnabled]);

  const setChainEnabled = useCallback(
    (chainId: OwnerNodeChainId, enabled: boolean) => {
      if (chainsRef.current[chainId] === enabled) return;
      const nextChains = { ...chainsRef.current, [chainId]: enabled };
      applyLocal({
        wssEnabled: wssRef.current,
        rpcFallbackEnabled: rpcRef.current,
        chains: nextChains,
        rpcPrimary: rpcPrimaryRef.current,
        rpcBackup: rpcBackupRef.current,
      });
      void fetch("/api/owner/system-control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: "chain", chainId, enabled }),
      }).catch(() => undefined);
    },
    [applyLocal]
  );

  const setPrimaryRpcEnabled = useCallback(
    (chainId: OwnerNodeChainId, enabled: boolean) => {
      if (rpcPrimaryRef.current[chainId] === enabled) return;
      const nextPrimary = { ...rpcPrimaryRef.current, [chainId]: enabled };
      applyLocal({
        wssEnabled: wssRef.current,
        rpcFallbackEnabled: rpcRef.current,
        chains: chainsRef.current,
        rpcPrimary: nextPrimary,
        rpcBackup: rpcBackupRef.current,
      });
      void fetch("/api/owner/system-control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: "rpc-primary", chainId, enabled }),
      }).catch(() => undefined);
    },
    [applyLocal]
  );

  const setBackupRpcEnabled = useCallback(
    (chainId: OwnerNodeChainId, enabled: boolean) => {
      if (rpcBackupRef.current[chainId] === enabled) return;
      const nextBackup = { ...rpcBackupRef.current, [chainId]: enabled };
      applyLocal({
        wssEnabled: wssRef.current,
        rpcFallbackEnabled: rpcRef.current,
        chains: chainsRef.current,
        rpcPrimary: rpcPrimaryRef.current,
        rpcBackup: nextBackup,
      });
      void fetch("/api/owner/system-control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: "rpc-backup", chainId, enabled }),
      }).catch(() => undefined);
    },
    [applyLocal]
  );

  const value = useMemo(
    () => ({
      wssEnabled,
      rpcFallbackEnabled,
      chains,
      rpcPrimary,
      rpcBackup,
      setWssEnabled,
      setRpcFallbackEnabled,
      toggleWssEnabled,
      toggleRpcFallbackEnabled,
      setChainEnabled,
      setPrimaryRpcEnabled,
      setBackupRpcEnabled,
      liveFeedActive: Object.values(chains).some(Boolean),
      publicMode: wssEnabled || rpcFallbackEnabled,
    }),
    [
      wssEnabled,
      rpcFallbackEnabled,
      chains,
      rpcPrimary,
      rpcBackup,
      setWssEnabled,
      setRpcFallbackEnabled,
      toggleWssEnabled,
      toggleRpcFallbackEnabled,
      setChainEnabled,
      setPrimaryRpcEnabled,
      setBackupRpcEnabled,
    ]
  );

  return <RpcLiveFeedContext.Provider value={value}>{children}</RpcLiveFeedContext.Provider>;
}

export function useRpcLiveFeed(): RpcLiveFeedContextValue {
  const ctx = useContext(RpcLiveFeedContext);
  if (!ctx) throw new Error("useRpcLiveFeed harus dipakai di dalam RpcLiveFeedProvider");
  return ctx;
}
