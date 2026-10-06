import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/sessionToken";

const DENIED = {
  error: "Akses MEV Core Engine ditolak. Login dengan akun yang ada di User List Register.",
};

export async function proxy(request: NextRequest) {
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json(DENIED, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      source: "/api/bot",
      has: [{ type: "header", key: "x-mev-core-app", value: "4100" }],
    },
    {
      source: "/api/bot/:path*",
      has: [{ type: "header", key: "x-mev-core-app", value: "4100" }],
    },
  ],
};
