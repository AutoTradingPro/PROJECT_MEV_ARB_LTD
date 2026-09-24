import { appendServerLog } from "@/lib/bot/serverLog";
import {
  createVaultSession,
  recordUnlockFailure,
  resetUnlockFailures,
  assertUnlockAllowed,
  vaultPasswordConfigured,
  verifyVaultPassword,
} from "@/lib/owner/vaultAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertUnlockAllowed();
    if (!vaultPasswordConfigured()) {
      return Response.json(
        { error: "Password brankas belum dikonfigurasi (OWNER_BRANKAS_PASSWORD)." },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => null)) as { password?: string } | null;
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password) {
      return Response.json({ error: "Masukkan kata sandi brankas." }, { status: 400 });
    }

    if (!verifyVaultPassword(password)) {
      recordUnlockFailure();
      appendServerLog({
        level: "warn",
        source: "brankas",
        message: "Percobaan unlock brankas ditolak.",
      });
      return Response.json({ error: "Kata sandi brankas salah." }, { status: 401 });
    }

    resetUnlockFailures();
    const session = createVaultSession();
    appendServerLog({
      level: "info",
      source: "brankas",
      message: "Brankas Owner dibuka. Sesi aktif 10 menit.",
    });
    return Response.json({
      unlocked: true,
      token: session.token,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuka brankas.";
    return Response.json({ error: message }, { status: 429 });
  }
}
