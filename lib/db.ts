import { MOCK_OWNER_USERS } from "@/lib/owner/mockUsers";
import type { OwnerUser, OwnerUserTier } from "@/lib/owner/types";

export type StakingStatus = "active" | "inactive";

/** Rekaman user di penyimpanan terpusat (shared dengan Owner User List). */
export interface StoredUser {
  id: string;
  username: string;
  email: string;
  wallet: string;
  telegramId: string;
  telegramUsername?: string;
  mainBalance: number;
  affiliateBalance: number;
  tier: OwnerUserTier;
  stakedBalance: number;
  stakingStatus: StakingStatus;
  registeredAt: string;
  suspended: boolean;
}

export interface RegisterUserInput {
  username: string;
  email: string;
  wallet?: string;
  telegramId?: string;
  telegramUsername?: string;
}

export interface PatchUserInput {
  username?: string;
  email?: string;
  wallet?: string;
  telegramId?: string;
  telegramUsername?: string;
  mainBalance?: number;
  affiliateBalance?: number;
  tier?: OwnerUserTier;
  stakedBalance?: number;
  stakingStatus?: StakingStatus;
  suspended?: boolean;
}

type UsersGlobal = typeof globalThis & {
  __mevArbUsers?: StoredUser[];
};

function fromOwnerUser(user: OwnerUser): StoredUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    wallet: user.wallet,
    telegramId: user.telegramId,
    telegramUsername: user.telegramUsername,
    mainBalance: user.mainBalanceUsd,
    affiliateBalance: user.affiliateBalanceUsd,
    tier: user.tier,
    stakedBalance: user.stakedUsd,
    stakingStatus: user.stakingActive ? "active" : "inactive",
    registeredAt: user.registeredAt,
    suspended: Boolean(user.suspended),
  };
}

export function toOwnerUser(user: StoredUser): OwnerUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    wallet: user.wallet,
    telegramId: user.telegramId,
    telegramUsername: user.telegramUsername,
    mainBalanceUsd: user.mainBalance,
    affiliateBalanceUsd: user.affiliateBalance,
    stakingActive: user.stakingStatus === "active",
    stakedUsd: user.stakedBalance,
    tier: user.tier,
    registeredAt: user.registeredAt,
    suspended: Boolean(user.suspended),
  };
}

function seedUsers(): StoredUser[] {
  return MOCK_OWNER_USERS.map(fromOwnerUser);
}

function store(): StoredUser[] {
  const g = globalThis as UsersGlobal;
  if (!g.__mevArbUsers) {
    g.__mevArbUsers = seedUsers();
  }
  return g.__mevArbUsers;
}

export function listUsers(): StoredUser[] {
  return [...store()].sort((a, b) => (a.registeredAt < b.registeredAt ? 1 : -1));
}

export function findUser(identifier: string): StoredUser | undefined {
  const query = identifier.trim().toLowerCase();
  if (!query) return undefined;
  return store().find(
    (user) => user.username.toLowerCase() === query || user.email.toLowerCase() === query
  );
}

export function findUserByTelegramId(telegramId: string): StoredUser | undefined {
  const query = telegramId.trim();
  if (!query) return undefined;
  return store().find((user) => user.telegramId.trim() === query);
}

export function findUserByWallet(wallet: string): StoredUser | undefined {
  const query = wallet.trim().toLowerCase();
  if (!query) return undefined;
  return store().find((user) => user.wallet.trim().toLowerCase() === query);
}

/** Cari user terpusat dari identitas sesi (username, email, wallet, atau Telegram ID). */
export function lookupStoredUser(input: {
  username?: string;
  email?: string;
  wallet?: string;
  telegramId?: string;
}): StoredUser | undefined {
  const username = input.username?.trim();
  const email = input.email?.trim();
  const wallet = input.wallet?.trim();
  const telegramId = input.telegramId?.trim();
  return (
    (username ? findUser(username) : undefined) ||
    (email ? findUser(email) : undefined) ||
    (wallet ? findUserByWallet(wallet) : undefined) ||
    (telegramId ? findUserByTelegramId(telegramId) : undefined)
  );
}

export function telegramIdForUser(user: StoredUser | undefined): string {
  return user?.telegramId?.trim() || "";
}

function newUserId(): string {
  return `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function registerUser(input: RegisterUserInput): StoredUser {
  const username = input.username.trim();
  const email = input.email.trim();
  if (!username) {
    throw new Error("Username wajib diisi.");
  }
  if (!email) {
    throw new Error("Email wajib diisi.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Format email tidak valid.");
  }

  const existing = store().find(
    (user) =>
      user.username.toLowerCase() === username.toLowerCase() ||
      user.email.toLowerCase() === email.toLowerCase()
  );
  if (existing) {
    throw new Error("Username atau email sudah terdaftar.");
  }

  const created: StoredUser = {
    id: newUserId(),
    username,
    email,
    wallet: input.wallet?.trim() ?? "",
    telegramId: input.telegramId?.trim() ?? "",
    telegramUsername: input.telegramUsername?.trim() || undefined,
    mainBalance: 0,
    affiliateBalance: 0,
    tier: "free",
    stakedBalance: 0,
    stakingStatus: "inactive",
    registeredAt: new Date().toISOString(),
    suspended: false,
  };
  store().push(created);
  return created;
}

export function patchUser(identifier: string, patch: PatchUserInput): StoredUser {
  const current = findUser(identifier);
  if (!current) {
    throw new Error("User tidak ditemukan.");
  }
  if (patch.username !== undefined) current.username = patch.username.trim();
  if (patch.email !== undefined) current.email = patch.email.trim();
  if (patch.wallet !== undefined) current.wallet = patch.wallet.trim();
  if (patch.telegramId !== undefined) current.telegramId = patch.telegramId.trim();
  if (patch.telegramUsername !== undefined) {
    current.telegramUsername = patch.telegramUsername.trim() || undefined;
  }
  if (typeof patch.mainBalance === "number" && Number.isFinite(patch.mainBalance)) {
    current.mainBalance = patch.mainBalance;
  }
  if (typeof patch.affiliateBalance === "number" && Number.isFinite(patch.affiliateBalance)) {
    current.affiliateBalance = patch.affiliateBalance;
  }
  if (patch.tier) current.tier = patch.tier;
  if (typeof patch.stakedBalance === "number" && Number.isFinite(patch.stakedBalance)) {
    current.stakedBalance = patch.stakedBalance;
    current.stakingStatus = patch.stakedBalance > 0 ? "active" : "inactive";
  }
  if (patch.stakingStatus) current.stakingStatus = patch.stakingStatus;
  if (typeof patch.suspended === "boolean") current.suspended = patch.suspended;
  return current;
}

export function isUserSuspended(ref: {
  username?: string;
  email?: string;
  wallet?: string;
  telegramId?: string;
}): boolean {
  const user = lookupStoredUser(ref);
  return Boolean(user?.suspended);
}
