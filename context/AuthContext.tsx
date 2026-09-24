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
import { fetchOwnerUser, patchOwnerUser, registerOwnerUser } from "@/lib/users/client";
import type { OwnerUser } from "@/lib/owner/types";

export type AuthTab = "login" | "register";

export interface AuthUser {
  username: string;
  email: string;
  telegramId: string;
  telegramUsername?: string;
  affiliateBalanceUsd: number;
  stakingActive: boolean;
  stakedUsd: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  isModalOpen: boolean;
  isDashboardOpen: boolean;
  authTab: AuthTab;
  openModal: (tab?: AuthTab) => void;
  closeModal: () => void;
  openDashboard: () => void;
  closeDashboard: () => void;
  setAuthTab: (tab: AuthTab) => void;
  login: (input: { identifier: string; password: string }) => Promise<void>;
  register: (input: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<void>;
  patchUser: (partial: Partial<AuthUser>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "mev-arb-auth-user";

function normalizeUser(raw: Partial<AuthUser> & Pick<AuthUser, "username" | "email">): AuthUser {
  return {
    username: raw.username,
    email: raw.email,
    telegramId: raw.telegramId ?? "",
    telegramUsername: raw.telegramUsername,
    affiliateBalanceUsd:
      typeof raw.affiliateBalanceUsd === "number" && Number.isFinite(raw.affiliateBalanceUsd)
        ? raw.affiliateBalanceUsd
        : 0,
    stakingActive: Boolean(raw.stakingActive),
    stakedUsd: typeof raw.stakedUsd === "number" && Number.isFinite(raw.stakedUsd) ? raw.stakedUsd : 0,
  };
}

function sessionFromOwnerUser(row: OwnerUser): AuthUser {
  return normalizeUser({
    username: row.username,
    email: row.email,
    telegramId: row.telegramId,
    telegramUsername: row.telegramUsername,
    affiliateBalanceUsd: row.affiliateBalanceUsd,
    stakingActive: row.stakingActive,
    stakedUsd: row.stakedUsd,
  });
}

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed.username || !parsed.email) return null;
    return normalizeUser({
      username: parsed.username,
      email: parsed.email,
      telegramId: parsed.telegramId,
      telegramUsername: parsed.telegramUsername,
      affiliateBalanceUsd: parsed.affiliateBalanceUsd,
      stakingActive: parsed.stakingActive,
      stakedUsd: parsed.stakedUsd,
    });
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>("login");

  useEffect(() => {
    setUser(readStoredUser());
    setHydrated(true);
  }, []);

  const persistUser = useCallback((next: AuthUser | null) => {
    const normalized = next ? normalizeUser(next) : null;
    setUser(normalized);
    try {
      if (normalized) localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const openModal = useCallback((tab: AuthTab = "login") => {
    setAuthTab(tab);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const openDashboard = useCallback(() => {
    setIsDashboardOpen(true);
  }, []);

  const closeDashboard = useCallback(() => {
    setIsDashboardOpen(false);
  }, []);

  const patchUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((current) => {
      if (!current) return current;
      const next = normalizeUser({ ...current, ...partial });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      void patchOwnerUser(next.username, {
        telegramId: next.telegramId,
        telegramUsername: next.telegramUsername,
        affiliateBalance: next.affiliateBalanceUsd,
        stakedBalance: next.stakedUsd,
        stakingStatus: next.stakingActive ? "active" : "inactive",
      }).catch(() => {
        /* daftar owner tetap bisa tertinggal jika API down */
      });
      return next;
    });
  }, []);

  const login = useCallback(
    async ({ identifier, password }: { identifier: string; password: string }) => {
      if (!identifier.trim() || !password) {
        throw new Error("Username/email dan password wajib diisi.");
      }
      await new Promise((r) => setTimeout(r, 400));
      const isEmail = identifier.includes("@");
      const username = isEmail ? identifier.split("@")[0] : identifier.trim();
      const email = isEmail ? identifier.trim() : `${identifier.trim()}@mevarb.local`;
      const fromDb = await fetchOwnerUser(identifier.trim()).catch(() => null);
      persistUser(fromDb ? sessionFromOwnerUser(fromDb) : normalizeUser({ username, email }));
      closeModal();
    },
    [closeModal, persistUser]
  );

  const register = useCallback(
    async (input: {
      username: string;
      email: string;
      password: string;
      confirmPassword: string;
    }) => {
      const { username, email, password, confirmPassword } = input;
      if (!username.trim() || !email.trim() || !password) {
        throw new Error("Semua field wajib diisi.");
      }
      if (password !== confirmPassword) {
        throw new Error("Konfirmasi password tidak cocok.");
      }
      const strong =
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password) &&
        password.length >= 8;
      if (!strong) {
        throw new Error(
          "Password harus ≥8 karakter dengan huruf besar, kecil, angka, dan simbol."
        );
      }
      await registerOwnerUser({ username: username.trim(), email: email.trim() });
      persistUser(normalizeUser({ username: username.trim(), email: email.trim() }));
      closeModal();
    },
    [closeModal, persistUser]
  );

  const logout = useCallback(() => {
    setIsDashboardOpen(false);
    persistUser(null);
  }, [persistUser]);

  const value = useMemo(
    () => ({
      user: hydrated ? user : null,
      isModalOpen,
      isDashboardOpen,
      authTab,
      openModal,
      closeModal,
      openDashboard,
      closeDashboard,
      setAuthTab,
      login,
      register,
      patchUser,
      logout,
    }),
    [
      user,
      hydrated,
      isModalOpen,
      isDashboardOpen,
      authTab,
      openModal,
      closeModal,
      openDashboard,
      closeDashboard,
      login,
      register,
      patchUser,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
