import { telegramWebhookSecret } from "@/lib/bot/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretOk(request: Request): boolean {
  const expected = telegramWebhookSecret();
  if (!expected) return true;
  const header = request.headers.get("x-telegram-bot-api-secret-token") || "";
  const query = new URL(request.url).searchParams.get("secret") || "";
  return header === expected || query === expected;
}

/** Endpoint inbound Telegram (setWebhook). Tidak memproses perintah — hanya ACK. */
export async function POST(request: Request) {
  if (!secretOk(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  try {
    await request.json();
  } catch {
    /* body kosong / bukan JSON */
  }
  return Response.json({ ok: true });
}

export async function GET() {
  return Response.json({ ok: true, service: "telegram-webhook" });
}
