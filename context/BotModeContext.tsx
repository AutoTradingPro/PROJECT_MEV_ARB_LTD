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
import { BOT_MODE } from "@/lib/scanOnly/config.js";
import { normalizeBotMode } from "@/lib/scanOnly/mode";
import type { BotMode } from "@/lib/scanOnly/types";

const STORAGE_KEY = "mev-arb-bot-mode";

interface BotModeContextValue {
  botMode: BotMode;
  isScanOnly: boolean;
  setBotMode: (mode: BotMode) => void;
  hydrated: boolean;
}

const BotModeContext = createContext<BotModeContextValue | null>(null);

export function BotModeProvider({ children }: { children: ReactNode }) {
  const [botMode, setBotModeState] = useState<BotMode>(normalizeBotMode(BOT_MODE));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setBotModeState(normalizeBotMode(saved));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const setBotMode = useCallback((next: BotMode) => {
    const mode = normalizeBotMode(next);
    setBotModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      botMode,
      isScanOnly: botMode === "SCAN_ONLY",
      setBotMode,
      hydrated,
    }),
    [botMode, setBotMode, hydrated]
  );

  return <BotModeContext.Provider value={value}>{children}</BotModeContext.Provider>;
}

export function useBotMode() {
  const ctx = useContext(BotModeContext);
  if (!ctx) throw new Error("useBotMode must be used within BotModeProvider");
  return ctx;
}
