import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const VAULT_SESSION_HEADER = "x-vault-session";
export const VAULT_TTL_MS = 10 * 60 * 1000;
const MAX_UNLOCK_FAILS = 8;
const FAIL_WINDOW_MS = 5 * 60 * 1000;

export interface VaultSession {
  token: string;
  expiresAt: number;
}

type VaultAuthGlobal = typeof globalThis & {
  __mevVaultSessions?: Map<string, number>;
  __mevVaultUnlockFails?: { count: number; windowStart: number };
};

function sessions(): Map<string, number> {
  const g = globalThis as VaultAuthGlobal;
  if (!g.__mevVaultSessions) g.__mevVaultSessions = new Map();
  return g.__mevVaultSessions;
}

function failState(): { count: number; windowStart: number } {
  const g = globalThis as VaultAuthGlobal;
  if (!g.__mevVaultUnlockFails) {
    g.__mevVaultUnlockFails = { count: 0, windowStart: Date.now() };
  }
  return g.__mevVaultUnlockFails;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function vaultPasswordConfigured(): boolean {
  return Boolean(resolveVaultPassword());
}

function resolveVaultPassword(): string | null {
  const fromEnv =
    process.env.OWNER_BRANKAS_PASSWORD?.trim() ||
    process.env.OWNER_VAULT_PASSWORD?.trim() ||
    "";
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return null;
  return "mev-brankas-owner";
}

export function verifyVaultPassword(input: string): boolean {
  const expected = resolveVaultPassword();
  if (!expected) return false;
  const a = sha256(input);
  const b = sha256(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertUnlockAllowed(): void {
  const state = failState();
  const now = Date.now();
  if (now - state.windowStart > FAIL_WINDOW_MS) {
    state.count = 0;
    state.windowStart = now;
  }
  if (state.count >= MAX_UNLOCK_FAILS) {
    throw new Error("Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.");
  }
}

export function recordUnlockFailure(): void {
  const state = failState();
  const now = Date.now();
  if (now - state.windowStart > FAIL_WINDOW_MS) {
    state.count = 1;
    state.windowStart = now;
    return;
  }
  state.count += 1;
}

export function resetUnlockFailures(): void {
  const state = failState();
  state.count = 0;
  state.windowStart = Date.now();
}

export function createVaultSession(): VaultSession {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + VAULT_TTL_MS;
  sessions().set(token, expiresAt);
  return { token, expiresAt };
}

export function readVaultToken(request: Request): string {
  return request.headers.get(VAULT_SESSION_HEADER)?.trim() || "";
}

export function getVaultSession(token: string): VaultSession | null {
  if (!token) return null;
  const expiresAt = sessions().get(token);
  if (!expiresAt) return null;
  if (Date.now() >= expiresAt) {
    sessions().delete(token);
    return null;
  }
  return { token, expiresAt };
}

export function touchVaultSession(token: string): VaultSession | null {
  const current = getVaultSession(token);
  if (!current) return null;
  const expiresAt = Date.now() + VAULT_TTL_MS;
  sessions().set(token, expiresAt);
  return { token, expiresAt };
}

export function destroyVaultSession(token: string): void {
  if (token) sessions().delete(token);
}

export function requireVaultSession(request: Request): VaultSession {
  const session = touchVaultSession(readVaultToken(request));
  if (!session) {
    const error = new Error("Sesi brankas terkunci.");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  return session;
}
