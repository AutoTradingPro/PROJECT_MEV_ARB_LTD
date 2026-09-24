import type { OwnerUser } from "@/lib/owner/types";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function fetchOwnerUsers(): Promise<OwnerUser[]> {
  const res = await fetch("/api/users", { cache: "no-store" });
  const json = await readJson<{ users?: OwnerUser[]; error?: string }>(res);
  if (!res.ok) {
    throw new Error(json.error || "Gagal memuat daftar user.");
  }
  return json.users ?? [];
}

export async function fetchOwnerUser(identifier: string): Promise<OwnerUser | null> {
  const res = await fetch(`/api/users?identifier=${encodeURIComponent(identifier)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  const json = await readJson<{ user?: OwnerUser; error?: string }>(res);
  if (!res.ok) {
    throw new Error(json.error || "Gagal memuat user.");
  }
  return json.user ?? null;
}

export async function registerOwnerUser(input: {
  username: string;
  email: string;
  wallet?: string;
  telegramId?: string;
}): Promise<OwnerUser> {
  const res = await fetch("/api/users", {
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
  const res = await fetch("/api/users", {
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
