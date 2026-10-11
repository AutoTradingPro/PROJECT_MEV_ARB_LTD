export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { applySessionCookie } from "@/lib/auth/sessionCookie";
import { authenticateRegisteredUser, toOwnerUser } from "@/lib/db";

export async function POST(request: Request) {
  try {
    let body: { identifier?: string; password?: string; wallet?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
    }

    const result = authenticateRegisteredUser({
      identifier: body.identifier ?? "",
      password: body.password ?? "",
      wallet: body.wallet,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    const response = NextResponse.json({ user: toOwnerUser(result.user) });
    await applySessionCookie(response, result.user);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login gagal di server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
