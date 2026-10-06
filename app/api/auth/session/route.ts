export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/sessionCookie";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/sessionToken";
import { findUserById, toOwnerUser } from "@/lib/db";

const UNREGISTERED =
  "Akun tidak terdaftar di User List Register. Login ditolak untuk MEV Core Engine.";

export async function GET() {
  const jar = await cookies();
  const session = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json(
      { error: "Sesi tidak aktif. Login dengan akun yang ada di User List Register." },
      { status: 401 }
    );
  }
  const user = findUserById(session.id);
  if (!user || user.username !== session.username) {
    const response = NextResponse.json({ error: UNREGISTERED }, { status: 401 });
    clearSessionCookie(response);
    return response;
  }
  if (user.suspended) {
    const response = NextResponse.json(
      { error: "Akun ditangguhkan dan tidak dapat masuk ke MEV Core Engine." },
      { status: 403 }
    );
    clearSessionCookie(response);
    return response;
  }
  return NextResponse.json({ user: toOwnerUser(user) });
}
