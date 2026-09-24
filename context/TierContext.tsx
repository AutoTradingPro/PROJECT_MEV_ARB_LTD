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

export type TierMode = "free" | "pro";
export type ProScanMode = "single" | "full";

const STORAGE_KEY = "mev-arb-tier-mode";
const SCAN_MODE_KEY = "mev-arb-pro-scan-mode";

interface TierContextValue {
  mode: TierMode;
  isFree: boolean;
  isPro: boolean;
  setMode: (mode: TierMode) => void;
  scannerEnabled: boolean;
  setScannerEnabled: (enabled: boolean) => void;
  proScanMode: ProScanMode;
  setProScanMode: (mode: ProScanMode) => void;
}

const TierContext = createContext<TierContextValue | null>(null);

export function TierProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<TierMode>("free");
  const [scannerEnabled, setScannerEnabled] = useState(false);
  /** Default Full pair Scan — Single aktif tetap eksklusif via toggle radio. */
  const [proScanMode, setProScanModeState] = useState<ProScanMode>("full");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as TierMode | null;
      if (saved === "free" || saved === "pro") setModeState(saved);
      const savedScan = localStorage.getItem(SCAN_MODE_KEY) as ProScanMode | null;
      if (savedScan === "single" || savedScan === "full") setProScanModeState(savedScan);
      else {
        setProScanModeState("full");
        localStorage.setItem(SCAN_MODE_KEY, "full");
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const setMode = useCallback((next: TierMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    if (next === "free") setScannerEnabled(false);
  }, []);

  const setProScanMode = useCallback((next: ProScanMode) => {
    setProScanModeState(next);
    try {
      localStorage.setItem(SCAN_MODE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      mode: hydrated ? mode : "free",
      isFree: (hydrated ? mode : "free") === "free",
      isPro: hydrated ? mode === "pro" : false,
      setMode,
      scannerEnabled,
      setScannerEnabled,
      proScanMode: hydrated ? proScanMode : "full",
      setProScanMode,
    }),
    [mode, hydrated, setMode, scannerEnabled, proScanMode, setProScanMode]
  );

  return <TierContext.Provider value={value}>{children}</TierContext.Provider>;
}

export function useTier() {
  const ctx = useContext(TierContext);
  if (!ctx) throw new Error("useTier must be used within TierProvider");
  return ctx;
}
