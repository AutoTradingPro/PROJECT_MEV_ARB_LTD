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
import { DEFAULT_BOT_CONFIG } from "@/lib/bot/constants";
import { migrateBotConfig } from "@/lib/bot/configUnits";
import { disableAllFlashLoanPlatforms } from "@/lib/bot/flashLoanProviders";
import type { BotConfig, BotState } from "@/lib/bot/types";

const STORAGE_KEY = "mev-arb-bot-config";

interface BotConfigContextValue {
  config: BotConfig;
  hydrated: boolean;
  setConfig: (next: BotConfig) => void;
  patchConfig: (partial: Partial<BotConfig>) => void;
  setLoanAmountUsd: (loanAmountUsd: number) => void;
}

const BotConfigContext = createContext<BotConfigContextValue | null>(null);

/** Fresh load UI: semua FlashLoan OFF di memori (scanner siaga). */
function withFlashLoanStandby(config: BotConfig): BotConfig {
  return migrateBotConfig({
    ...config,
    flashLoanPlatforms: disableAllFlashLoanPlatforms(config.flashLoanPlatforms),
  });
}

function readStoredConfig(): BotConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrateBotConfig(JSON.parse(raw) as Partial<BotConfig>);
  } catch {
    return null;
  }
}

function writeStoredConfig(config: BotConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}

export function BotConfigProvider({
  children,
  /** Portal Mev Arb: fresh load semua FlashLoan OFF. Owner: false. */
  standbyOnBoot = false,
}: {
  children: ReactNode;
  standbyOnBoot?: boolean;
}) {
  const [config, setConfigState] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  const [hydrated, setHydrated] = useState(false);
  const configRef = useRef(config);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  configRef.current = config;

  const persist = useCallback((next: BotConfig) => {
    writeStoredConfig(next);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void fetch("/api/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "config", config: next }),
      }).catch(() => {
        /* persist config boleh gagal sementara saat dev server compile */
      });
    }, 350);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const stored = readStoredConfig();
      try {
        const res = await fetch(`/api/bot?t=${Date.now()}`, {
          cache: "no-store",
          headers: { pragma: "no-cache" },
        });
        const json = (await res.json()) as BotState;
        const server = res.ok && json.config ? migrateBotConfig(json.config) : null;
        const merged = migrateBotConfig({
          ...(server ?? {}),
          ...(stored ?? {}),
        });

        if (standbyOnBoot) {
          const standby = withFlashLoanStandby(merged);
          writeStoredConfig(standby);
          if (!cancelled) {
            setConfigState(standby);
            configRef.current = standby;
          }
        } else {
          const next = stored ?? server ?? DEFAULT_BOT_CONFIG;
          const migrated = migrateBotConfig(next);
          if (!cancelled) {
            setConfigState(migrated);
            configRef.current = migrated;
          }
        }
      } catch {
        if (standbyOnBoot) {
          const base = withFlashLoanStandby(stored ?? DEFAULT_BOT_CONFIG);
          writeStoredConfig(base);
          if (!cancelled) {
            setConfigState(base);
            configRef.current = base;
          }
        } else if (stored && !cancelled) {
          setConfigState(stored);
          configRef.current = stored;
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void boot();
    return () => {
      cancelled = true;
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [standbyOnBoot]);

  // Lintas tab: sync config bila tab lain menulis storage.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const next = migrateBotConfig(JSON.parse(event.newValue) as Partial<BotConfig>);
        setConfigState(next);
        configRef.current = next;
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setConfig = useCallback(
    (next: BotConfig) => {
      const migrated = migrateBotConfig(next);
      setConfigState(migrated);
      persist(migrated);
    },
    [persist]
  );

  const patchConfig = useCallback(
    (partial: Partial<BotConfig>) => {
      const migrated = migrateBotConfig({ ...configRef.current, ...partial });
      setConfigState(migrated);
      persist(migrated);
    },
    [persist]
  );

  const setLoanAmountUsd = useCallback(
    (loanAmountUsd: number) => {
      const value = Number.isFinite(loanAmountUsd) ? Math.max(0, loanAmountUsd) : 0;
      patchConfig({ loanAmountUsd: value });
    },
    [patchConfig]
  );

  const value = useMemo(
    () => ({
      config,
      hydrated,
      setConfig,
      patchConfig,
      setLoanAmountUsd,
    }),
    [config, hydrated, setConfig, patchConfig, setLoanAmountUsd]
  );

  return <BotConfigContext.Provider value={value}>{children}</BotConfigContext.Provider>;
}

export function useBotConfig(): BotConfigContextValue {
  const ctx = useContext(BotConfigContext);
  if (!ctx) throw new Error("useBotConfig harus dipakai di dalam BotConfigProvider");
  return ctx;
}
