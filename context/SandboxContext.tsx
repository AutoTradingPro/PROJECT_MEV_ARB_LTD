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
import { SANDBOX_INITIAL_VAULT_USD, SANDBOX_LEGACY_VAULT_USD } from "@/lib/sandbox/engine";
import { stableWeiToUsd, usdToStableWei } from "@/lib/bot/configUnits";
import type { TradeRecord } from "@/lib/bot/types";

export type MevNetworkMode = "mainnet" | "sandbox";

const STORAGE_KEY = "mev-arb-network-mode";
const STATE_KEY = "mev-arb-sandbox-state";

interface SandboxPersist {
  vaultUsd: number;
  realizedProfitWei: string;
  trades: TradeRecord[];
}

interface SandboxContextValue {
  mode: MevNetworkMode;
  isSandbox: boolean;
  hydrated: boolean;
  setMode: (mode: MevNetworkMode) => void;
  toggleMode: () => void;
  vaultUsd: number;
  realizedProfitWei: string;
  trades: TradeRecord[];
  applyProfit: (netProfitWei: string, trade?: TradeRecord) => void;
  withdrawVault: (pct: number) => { withdrawnUsd: number };
  resetSandbox: () => void;
}

const SandboxContext = createContext<SandboxContextValue | null>(null);

const initialPersist = (): SandboxPersist => ({
  vaultUsd: SANDBOX_INITIAL_VAULT_USD,
  realizedProfitWei: "0",
  trades: [],
});

function readMode(): MevNetworkMode {
  if (typeof window === "undefined") return "mainnet";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "sandbox" ? "sandbox" : "mainnet";
  } catch {
    return "mainnet";
  }
}

function readPersist(): SandboxPersist {
  if (typeof window === "undefined") return initialPersist();
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return initialPersist();
    const parsed = JSON.parse(raw) as Partial<SandboxPersist>;
    const storedVault =
      typeof parsed.vaultUsd === "number" && Number.isFinite(parsed.vaultUsd)
        ? parsed.vaultUsd
        : SANDBOX_INITIAL_VAULT_USD;
    const profitWei = parsed.realizedProfitWei || "0";
    const profitUsd = stableWeiToUsd(profitWei);
    let vaultUsd = storedVault;
    if (storedVault < SANDBOX_INITIAL_VAULT_USD) {
      const leftover =
        storedVault > SANDBOX_LEGACY_VAULT_USD
          ? storedVault - SANDBOX_LEGACY_VAULT_USD
          : Math.max(0, profitUsd);
      vaultUsd = SANDBOX_INITIAL_VAULT_USD + leftover;
    }
    return {
      vaultUsd,
      realizedProfitWei: profitWei,
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
    };
  } catch {
    return initialPersist();
  }
}

export function SandboxProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<MevNetworkMode>("mainnet");
  const [vaultUsd, setVaultUsd] = useState(SANDBOX_INITIAL_VAULT_USD);
  const [realizedProfitWei, setRealizedProfitWei] = useState("0");
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setModeState(readMode());
    const persist = readPersist();
    setVaultUsd(persist.vaultUsd);
    setRealizedProfitWei(persist.realizedProfitWei);
    setTrades(persist.trades);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
      localStorage.setItem(
        STATE_KEY,
        JSON.stringify({ vaultUsd, realizedProfitWei, trades } satisfies SandboxPersist)
      );
    } catch {
      /* ignore */
    }
  }, [mode, vaultUsd, realizedProfitWei, trades, hydrated]);

  const setMode = useCallback((next: MevNetworkMode) => {
    setModeState(next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => (current === "sandbox" ? "mainnet" : "sandbox"));
  }, []);

  const applyProfit = useCallback((netProfitWei: string, trade?: TradeRecord) => {
    const addUsd = stableWeiToUsd(netProfitWei);
    setVaultUsd((current) => current + Math.max(0, addUsd));
    setRealizedProfitWei((current) =>
      (BigInt(current || "0") + BigInt(netProfitWei || "0")).toString()
    );
    if (trade) {
      setTrades((current) => [trade, ...current].slice(0, 80));
    }
  }, []);

  const withdrawVault = useCallback((pct: number) => {
    const safePct = Math.min(100, Math.max(0, pct));
    let withdrawnUsd = 0;
    setRealizedProfitWei((current) => {
      const remain = BigInt(current || "0");
      const take = (remain * BigInt(Math.round(safePct))) / 100n;
      withdrawnUsd = stableWeiToUsd(take.toString());
      return (remain - take).toString();
    });
    setVaultUsd((current) => Math.max(0, current - withdrawnUsd));
    return { withdrawnUsd };
  }, []);

  const resetSandbox = useCallback(() => {
    const fresh = initialPersist();
    setVaultUsd(fresh.vaultUsd);
    setRealizedProfitWei(fresh.realizedProfitWei);
    setTrades(fresh.trades);
  }, []);

  const value = useMemo(
    () => ({
      mode: hydrated ? mode : "mainnet",
      isSandbox: hydrated && mode === "sandbox",
      hydrated,
      setMode,
      toggleMode,
      vaultUsd,
      realizedProfitWei,
      trades,
      applyProfit,
      withdrawVault,
      resetSandbox,
    }),
    [
      hydrated,
      mode,
      vaultUsd,
      realizedProfitWei,
      trades,
      setMode,
      toggleMode,
      applyProfit,
      withdrawVault,
      resetSandbox,
    ]
  );

  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>;
}

export function useSandbox() {
  const ctx = useContext(SandboxContext);
  if (!ctx) throw new Error("useSandbox must be used within SandboxProvider");
  return ctx;
}

export function sandboxVaultWei(vaultUsd: number): string {
  return usdToStableWei(vaultUsd);
}
