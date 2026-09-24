import { appendServerLog } from "@/lib/bot/serverLog";
import { destroyVaultSession, readVaultToken } from "@/lib/owner/vaultAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  destroyVaultSession(readVaultToken(request));
  appendServerLog({
    level: "info",
    source: "brankas",
    message: "Brankas Owner dikunci.",
  });
  return Response.json({ unlocked: false });
}
