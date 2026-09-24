import { runScanOnlyAnalysis } from "@/lib/scanOnly/engine";
import { BOT_MODE } from "@/lib/scanOnly/config.js";
import { defaultTradingChainId, isTradingChainId, normalizeTradingChainId } from "@/config/networks";
import { readBotState } from "@/lib/bot/store";
import { strictScanChainId } from "@/lib/bot/scanRuntime";
import type { BotConfig } from "@/lib/bot/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { chainId?: string; config?: Partial<BotConfig> } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  try {
    const requested = body.chainId || body.config?.chainId;
    const fallback =
      (isTradingChainId(strictScanChainId()) ? strictScanChainId() : null) ||
      (await readBotState().catch(() => null))?.config.chainId ||
      defaultTradingChainId();
    const chainId = normalizeTradingChainId(isTradingChainId(requested) ? requested : fallback);
    const report = await runScanOnlyAnalysis({ chainId, config: body.config });
    return Response.json(
      { ...report, botMode: BOT_MODE },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan-only gagal.";
    return Response.json(
      { error: message, botMode: BOT_MODE, rows: [], matrix: "" },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
