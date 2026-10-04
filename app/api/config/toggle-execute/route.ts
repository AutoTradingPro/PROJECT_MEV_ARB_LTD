import { parseTogglePayload, setRuntimeBotMode } from "@/lib/bot/botModeRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown = null;
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text.trim();
    }
  }
  const mode = parseTogglePayload(body);
  if (!mode) {
    return Response.json(
      { error: "Payload tidak dikenali. Kirim true/false atau EXECUTE/SCAN_ONLY." },
      { status: 400 }
    );
  }
  const botMode = setRuntimeBotMode(mode);
  console.log(`[config] BOT_MODE runtime = ${botMode}`);
  return Response.json({ ok: true, botMode }, { headers: { "Cache-Control": "no-store" } });
}
