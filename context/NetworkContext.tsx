"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { type ChainConfig, type ChainId, getChain } from "@/lib/chain/networks";
import {
  defaultTradingChainId,
  isScannerChainId,
  isTradingChainId,
  toActiveNetwork,
  type ActiveNetwork,
  type TradingChainId,
} from "@/config/networks";
import {
  defaultPairForChain,
  getPair,
  pairsForChain,
  type TokenPairConfig,
} from "@/lib/chain/tokenPairs";

const STORAGE_KEY = "mev-arb-network-v3";
const SSR_CHAIN: ChainId = "polygon";

function sessionLockedChain(): TradingChainId | null {
  const raw = (process.env.NEXT_PUBLIC_SCANNER_LOCK_CHAIN || "").trim().toLowerCase();
  return isTradingChainId(raw) ? raw : null;
}

interface NetworkContextValue {
  chain: ChainConfig;
  chainId: ChainId;
  hydrated: boolean;
  activeNetwork: ActiveNetwork;
  pair: TokenPairConfig;
  pairId: string;
  availablePairs: TokenPairConfig[];
  setChainId: (id: ChainId) => void;
  setPairId: (id: string) => void;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

function readStored(): { chainId: ChainId; pairId: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { chainId: ChainId; pairId: string };
  } catch {
    return null;
  }
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [chainId, setChainIdState] = useState<ChainId>(SSR_CHAIN);
  const [pairId, setPairIdState] = useState<string>(defaultPairForChain(SSR_CHAIN).id);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const locked = sessionLockedChain();
    const stored = readStored();
    if (locked) {
      setChainIdState(locked);
      setPairIdState(
        stored && stored.chainId === locked && getPair(locked, stored.pairId)
          ? stored.pairId
          : defaultPairForChain(locked).id
      );
    } else if (stored && (stored.chainId === "cosmos" || isTradingChainId(stored.chainId))) {
      const migrated = stored.chainId === "cosmos" ? "solana" : stored.chainId;
      if (!isTradingChainId(migrated)) {
        const fallback = defaultTradingChainId();
        setChainIdState(fallback);
        setPairIdState(defaultPairForChain(fallback).id);
      } else {
        setChainIdState(migrated);
        setPairIdState(
          getPair(migrated, stored.pairId)
            ? stored.pairId
            : defaultPairForChain(migrated).id
        );
      }
    } else {
      const fallback = defaultTradingChainId();
      setChainIdState(fallback);
      setPairIdState(defaultPairForChain(fallback).id);
    }
    setHydrated(true);
  }, []);

  const chain = getChain(chainId);
  const availablePairs = useMemo(() => pairsForChain(chainId), [chainId]);
  const pair = useMemo(() => {
    const found = getPair(chainId, pairId);
    if (found) return found;
    return defaultPairForChain(chainId);
  }, [pairId, chainId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!pairId || !getPair(chainId, pairId)) {
      setPairIdState(defaultPairForChain(chainId).id);
    }
  }, [chainId, pairId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ chainId, pairId: pair.id }));
  }, [chainId, pair.id, hydrated]);

  const setChainId = useCallback((id: ChainId) => {
    const locked = sessionLockedChain();
    const next: TradingChainId = locked
      ? locked
      : isScannerChainId(id)
        ? id
        : isTradingChainId(id)
          ? id
          : defaultTradingChainId();
    setChainIdState(next);
    setPairIdState(defaultPairForChain(next).id);
  }, []);

  const setPairId = useCallback((id: string) => {
    setPairIdState(id);
  }, []);

  const value = useMemo(
    () => ({
      chain,
      chainId,
      hydrated,
      activeNetwork: toActiveNetwork(chainId),
      pair,
      pairId: pair.id,
      availablePairs,
      setChainId,
      setPairId,
    }),
    [chain, chainId, hydrated, pair, availablePairs, setChainId, setPairId]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork harus dipakai di dalam NetworkProvider");
  return ctx;
}
