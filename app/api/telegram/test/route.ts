import { sendTelegramMessageResult } from "@/lib/bot/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_MESSAGE =
  "🟢 Test Notification: Koneksi Telegram Bot MEV Arbitrase berhasil terhubung ke perangkat Android!";

export async function POST() {
  const result = await sendTelegramMessageResult(TEST_MESSAGE);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
