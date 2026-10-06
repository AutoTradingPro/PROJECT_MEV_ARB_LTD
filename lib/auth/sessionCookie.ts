import { NextResponse } from "next/server";
import { SESSION_COOKIE, signSessionToken } from "@/lib/auth/sessionToken";

const WEEK_SECONDS = 60 * 60 * 24 * 7;

export async function applySessionCookie(
  response: NextResponse,
  user: { id: string; username: string }
): Promise<void> {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: await signSessionToken(user),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WEEK_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
