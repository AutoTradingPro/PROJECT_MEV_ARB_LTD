export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { applySessionCookie } from "@/lib/auth/sessionCookie";
import { findUser, listUsers, patchUser, registerUser, toOwnerUser } from "@/lib/db";
import { appendServerLog } from "@/lib/bot/serverLog";
import type { OwnerUserTier } from "@/lib/owner/types";

const OWNER_TIERS: OwnerUserTier[] = ["free", "pro-1", "pro-2", "pro-3", "affiliate"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const identifier = searchParams.get("identifier")?.trim() ?? "";
  if (identifier) {
    const user = findUser(identifier);
    if (!user) {
      return Response.json({ error: "User tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ user: toOwnerUser(user) });
  }
  return Response.json({ users: listUsers().map(toOwnerUser) });
}

export async function POST(request: Request) {
  let body: { username?: string; email?: string; password?: string; wallet?: string; telegramId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  try {
    const user = registerUser({
      username: body.username ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      wallet: body.wallet,
      telegramId: body.telegramId,
    });
    const response = NextResponse.json({ user: toOwnerUser(user) }, { status: 201 });
    await applySessionCookie(response, user);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registrasi gagal.";
    const status = message.includes("sudah terdaftar") ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  let body: {
    identifier?: string;
    username?: string;
    email?: string;
    wallet?: string;
    telegramId?: string;
    telegramUsername?: string;
    affiliateBalance?: number;
    stakedBalance?: number;
    stakingStatus?: "active" | "inactive";
    tier?: OwnerUserTier;
    suspended?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const identifier = body.identifier?.trim() || body.username?.trim() || body.email?.trim() || "";
  if (!identifier) {
    return Response.json({ error: "Identifier user wajib diisi." }, { status: 400 });
  }
  if (body.tier && !OWNER_TIERS.includes(body.tier)) {
    return Response.json({ error: "Tier tidak valid." }, { status: 400 });
  }

  try {
    const user = patchUser(identifier, body);
    if (typeof body.suspended === "boolean") {
      appendServerLog({
        level: body.suspended ? "warn" : "info",
        source: "users",
        message: `${user.username} ${body.suspended ? "SUSPEND darurat" : "unsuspend"} · tier ${user.tier}`,
      });
    } else if (body.tier) {
      appendServerLog({
        level: "info",
        source: "users",
        message: `${user.username} tier diubah menjadi ${body.tier}`,
      });
    }
    return Response.json({ user: toOwnerUser(user) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pembaruan gagal.";
    const status = message.includes("tidak ditemukan") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
