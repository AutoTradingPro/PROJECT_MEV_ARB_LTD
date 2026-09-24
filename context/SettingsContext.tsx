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
import { getCurrency } from "@/lib/settings/currencies";
import { getLanguage } from "@/lib/settings/languages";
import {
  persistDocumentTheme,
  THEME_STORAGE_KEY,
  type DocumentTheme,
} from "@/lib/theme/documentTheme";

export type AppTheme = DocumentTheme;
export type LocaleModalTab = "language" | "currency";

const STORAGE_KEYS = {
  theme: THEME_STORAGE_KEY,
  language: "mev-arb-language",
  currency: "mev-arb-currency",
} as const;

interface SettingsContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  language: string;
  setLanguage: (code: string) => void;
  currency: string;
  setCurrency: (code: string) => void;
  languageLabel: string;
  currencyLabel: string;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  toggleSettings: () => void;
  localeModalOpen: boolean;
  localeModalTab: LocaleModalTab;
  openLocaleModal: (tab: LocaleModalTab) => void;
  closeLocaleModal: () => void;
  setLocaleModalTab: (tab: LocaleModalTab) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function readStorage(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("dark");
  const [language, setLanguageState] = useState("en-US");
  const [currency, setCurrencyState] = useState("USD");
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localeModalOpen, setLocaleModalOpen] = useState(false);
  const [localeModalTab, setLocaleModalTab] = useState<LocaleModalTab>("language");

  useEffect(() => {
    const storedTheme = readStorage(STORAGE_KEYS.theme, "dark") as AppTheme;
    if (storedTheme === "light" || storedTheme === "dark") setThemeState(storedTheme);
    setLanguageState(readStorage(STORAGE_KEYS.language, "en-US"));
    setCurrencyState(readStorage(STORAGE_KEYS.currency, "USD"));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistDocumentTheme(theme);
  }, [theme, hydrated]);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
  }, []);

  const setLanguage = useCallback((code: string) => {
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEYS.language, code);
    } catch {
      /* ignore */
    }
  }, []);

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEYS.currency, code);
    } catch {
      /* ignore */
    }
  }, []);

  const openLocaleModal = useCallback((tab: LocaleModalTab) => {
    setLocaleModalTab(tab);
    setLocaleModalOpen(true);
    setSettingsOpen(false);
  }, []);

  const closeLocaleModal = useCallback(() => {
    setLocaleModalOpen(false);
  }, []);

  const toggleSettings = useCallback(() => {
    setSettingsOpen((v) => !v);
  }, []);

  const languageLabel = getLanguage(language)?.label ?? "English";
  const currencyLabel = getCurrency(currency)?.code ?? "USD";

  const value = useMemo(
    () => ({
      theme: hydrated ? theme : "dark",
      setTheme,
      language: hydrated ? language : "en-US",
      setLanguage,
      currency: hydrated ? currency : "USD",
      setCurrency,
      languageLabel,
      currencyLabel,
      settingsOpen,
      setSettingsOpen,
      toggleSettings,
      localeModalOpen,
      localeModalTab,
      openLocaleModal,
      closeLocaleModal,
      setLocaleModalTab,
    }),
    [
      theme,
      language,
      currency,
      hydrated,
      languageLabel,
      currencyLabel,
      settingsOpen,
      localeModalOpen,
      localeModalTab,
      setTheme,
      setLanguage,
      setCurrency,
      toggleSettings,
      openLocaleModal,
      closeLocaleModal,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
