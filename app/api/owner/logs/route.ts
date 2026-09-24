import { appendServerLog, clearServerLogs, listServerLogs } from "@/lib/bot/serverLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { logs: listServerLogs() },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function DELETE() {
  clearServerLogs();
  appendServerLog({
    level: "warn",
    source: "owner",
    message: "Terminal log server dibersihkan dari Dashboard Owner.",
  });
  return Response.json({ logs: listServerLogs() });
}
