import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/lib/auth/password";
import { MOCK_OWNER_USERS } from "@/lib/owner/mockUsers";
import type { OwnerUser, OwnerUserTier } from "@/lib/owner/types";

const REGISTER_FILE = path.join(process.cwd(), "data", "user-register.json");

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
  /** Hash scrypt. Tidak pernah dikirim ke klien. */
  passwordHash?: string;
}

export interface RegisterUserInput {
  username: string;
  email: string;
  password: string;
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

function writeUsers(users: StoredUser[]): void {
  mkdirSync(path.dirname(REGISTER_FILE), { recursive: true });
  const tmp = `${REGISTER_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify({ users }, null, 2), "utf8");
  renameSync(tmp, REGISTER_FILE);
}

/** Satu berkas untuk register, login, dan User List. */
function readUsers(): StoredUser[] {
  try {
    const parsed = JSON.parse(readFileSync(REGISTER_FILE, "utf8")) as { users?: StoredUser[] };
    if (!Array.isArray(parsed.users)) {
      throw new Error("Format User List Register tidak valid.");
    }
    return parsed.users;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
    const seeded = seedUsers();
    writeUsers(seeded);
    return seeded;
  }
}

export function listUsers(): StoredUser[] {
  return [...readUsers()].sort((a, b) => (a.registeredAt < b.registeredAt ? 1 : -1));
}

export function findUserById(id: string): StoredUser | undefined {
  const query = id.trim();
  if (!query) return undefined;
  return readUsers().find((user) => user.id === query);
}

export function findUser(identifier: string): StoredUser | undefined {
  const query = identifier.trim().toLowerCase();
  if (!query) return undefined;
  return readUsers().find(
    (user) => user.username.toLowerCase() === query || user.email.toLowerCase() === query
  );
}

export function findUserByTelegramId(telegramId: string): StoredUser | undefined {
  const query = telegramId.trim();
  if (!query) return undefined;
  return readUsers().find((user) => user.telegramId.trim() === query);
}

export function findUserByWallet(wallet: string): StoredUser | undefined {
  const query = wallet.trim().toLowerCase();
  if (!query) return undefined;
  return readUsers().find((user) => user.wallet.trim().toLowerCase() === query);
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

  const passwordError = passwordPolicyError(input.password);
  if (passwordError) throw new Error(passwordError);

  const wallet = input.wallet?.trim() ?? "";
  const users = readUsers();
  const existing = users.find(
    (user) =>
      user.username.toLowerCase() === username.toLowerCase() ||
      user.email.toLowerCase() === email.toLowerCase() ||
      (wallet && user.wallet.trim().toLowerCase() === wallet.toLowerCase())
  );
  if (existing) {
    throw new Error("Username, email, atau wallet sudah terdaftar.");
  }

  const created: StoredUser = {
    id: newUserId(),
    username,
    email,
    wallet,
    telegramId: input.telegramId?.trim() ?? "",
    telegramUsername: input.telegramUsername?.trim() || undefined,
    mainBalance: 0,
    affiliateBalance: 0,
    tier: "free",
    stakedBalance: 0,
    stakingStatus: "inactive",
    registeredAt: new Date().toISOString(),
    suspended: false,
    passwordHash: hashPassword(input.password),
  };
  users.push(created);
  writeUsers(users);
  return created;
}

export type LoginFailure = { ok: false; status: number; message: string };
export type LoginSuccess = { ok: true; user: StoredUser };

/** Login hanya lolos bila identitas ada di User List Register dan password cocok. */
export function authenticateRegisteredUser(input: {
  identifier: string;
  password: string;
  wallet?: string;
}): LoginFailure | LoginSuccess {
  const identifier = input.identifier.trim();
  const password = input.password;
  if (!identifier || !password) {
    return { ok: false, status: 400, message: "Username/email/wallet dan password wajib diisi." };
  }
  const user = lookupStoredUser({
    username: identifier,
    email: identifier,
    wallet: identifier,
  });
  if (!user) {
    return {
      ok: false,
      status: 401,
      message:
        "Akun tidak terdaftar di User List Register. Daftar terlebih dahulu sebelum masuk ke MEV Core Engine.",
    };
  }
  if (user.suspended) {
    return {
      ok: false,
      status: 403,
      message: "Akun ditangguhkan dan tidak dapat masuk ke MEV Core Engine.",
    };
  }
  const wallet = input.wallet?.trim().toLowerCase();
  if (wallet && user.wallet.trim().toLowerCase() !== wallet) {
    return {
      ok: false,
      status: 401,
      message: "Wallet tidak cocok dengan akun di User List Register.",
    };
  }
  if (!user.passwordHash) {
    return {
      ok: false,
      status: 403,
      message:
        "Akun ada di User List Register tetapi belum memiliki password. Buat akun lewat Register.",
    };
  }
  if (!verifyPassword(password, user.passwordHash)) {
    return {
      ok: false,
      status: 401,
      message: "Password tidak cocok dengan akun di User List Register.",
    };
  }
  return { ok: true, user };
}

export function patchUser(identifier: string, patch: PatchUserInput): StoredUser {
  const users = readUsers();
  const current = users.find((user) => {
    const query = identifier.trim().toLowerCase();
    return user.username.toLowerCase() === query || user.email.toLowerCase() === query;
  });
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
  writeUsers(users);
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
