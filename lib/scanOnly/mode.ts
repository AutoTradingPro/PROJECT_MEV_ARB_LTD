import { BOT_MODE } from "@/lib/scanOnly/config.js";
import type { BotMode } from "@/lib/scanOnly/types";

export const SCAN_ONLY_BLOCK_MESSAGE =
  "BOT_MODE=SCAN_ONLY — eksekusi on-chain / flash loan ditahan. Aktifkan mode Execute untuk mengirim transaksi.";

export function normalizeBotMode(value: unknown): BotMode {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "EXECUTE" || raw === "EXEC" || raw === "LIVE") return "EXECUTE";
  return "SCAN_ONLY";
}

export function defaultBotMode(): BotMode {
  return normalizeBotMode(process.env.BOT_MODE || BOT_MODE);
}

export function isScanOnlyMode(value?: unknown): boolean {
  if (value === undefined || value === null || value === "") {
    return defaultBotMode() === "SCAN_ONLY";
  }
  return normalizeBotMode(value) === "SCAN_ONLY";
}

export function scanOnlyExecutionBlockedResponse(mode?: unknown) {
  if (!isScanOnlyMode(mode)) return null;
  return {
    error: SCAN_ONLY_BLOCK_MESSAGE,
    botMode: "SCAN_ONLY" as const,
  };
}
