import { apiUrl } from "@/lib/apiBase";
import type { OwnerUser } from "@/lib/owner/types";

const authFetch: RequestInit = { credentials: "include", cache: "no-store" };

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.slice(0, 90).replace(/\s+/g, " ").trim();
    throw new Error(
      preview.startsWith("MEV Core Engine")
        ? "Proxy Core Engine menolak endpoint login. Pastikan server :4100 mem-proxy /api/auth."
        : `Server tidak mengirim JSON (HTTP ${res.status}): ${preview || "(kosong)"}`
    );
  }
}

export async function fetchOwnerUsers(): Promise<OwnerUser[]> {
  const res = await fetch(apiUrl("/api/users"), authFetch);
  const json = await readJson<{ users?: OwnerUser[]; error?: string }>(res);
  if (!res.ok) {
    throw new Error(json.error || "Gagal memuat daftar user.");
  }
  return json.users ?? [];
}

export async function fetchOwnerUser(identifier: string): Promise<OwnerUser | null> {
  const res = await fetch(apiUrl(`/api/users?identifier=${encodeURIComponent(identifier)}`), authFetch);
  if (res.status === 404) return null;
  const json = await readJson<{ user?: OwnerUser; error?: string }>(res);
  if (!res.ok) {
    throw new Error(json.error || "Gagal memuat user.");
  }
  return json.user ?? null;
}

export async function loginOwnerUser(input: {
  identifier: string;
  password: string;
  wallet?: string;
}): Promise<OwnerUser> {
  const res = await fetch(apiUrl("/api/auth/login"), {
    ...authFetch,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await readJson<{ user?: OwnerUser; error?: string }>(res);
  if (!res.ok || !json.user) {
    throw new Error(json.error || "Login gagal.");
  }
  return json.user;
}

export async function logoutOwnerSession(): Promise<void> {
  await fetch(apiUrl("/api/auth/logout"), { ...authFetch, method: "POST" }).catch(() => undefined);
}

export async function fetchAuthSession(): Promise<OwnerUser | null> {
  const res = await fetch(apiUrl("/api/auth/session"), authFetch);
  if (res.status === 401 || res.status === 403) {
    const json = await readJson<{ error?: string }>(res);
    const error = new Error(json.error || "Sesi tidak terdaftar di User List Register.");
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  const json = await readJson<{ user?: OwnerUser; error?: string }>(res);
  if (!res.ok || !json.user) {
    throw new Error(json.error || "Gagal memeriksa sesi.");
  }
  return json.user;
}

export async function registerOwnerUser(input: {
  username: string;
  email: string;
  password: string;
  wallet?: string;
  telegramId?: string;
}): Promise<OwnerUser> {
  const res = await fetch(apiUrl("/api/users"), {
    ...authFetch,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await readJson<{ user?: OwnerUser; error?: string }>(res);
  if (!res.ok || !json.user) {
    throw new Error(json.error || "Registrasi gagal.");
  }
  return json.user;
}

export async function patchOwnerUser(
  identifier: string,
  patch: {
    wallet?: string;
    telegramId?: string;
    telegramUsername?: string;
    affiliateBalance?: number;
    stakedBalance?: number;
    stakingStatus?: "active" | "inactive";
    tier?: import("@/lib/owner/types").OwnerUserTier;
    suspended?: boolean;
  }
): Promise<OwnerUser | null> {
  const res = await fetch(apiUrl("/api/users"), {
    ...authFetch,
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, ...patch }),
  });
  if (res.status === 404) return null;
  const json = await readJson<{ user?: OwnerUser; error?: string }>(res);
  if (!res.ok) {
    throw new Error(json.error || "Pembaruan user gagal.");
  }
  return json.user ?? null;
}
