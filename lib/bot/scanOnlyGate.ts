import { AUTO_EXECUTE } from "@/lib/bot/constants";
import { getRuntimeBotMode } from "@/lib/bot/botModeRuntime";
import { appendServerLog } from "@/lib/bot/serverLog";

export const SCAN_ONLY_HOLD_MESSAGE = "[SKIP] Eksekusi ditahan: Bot dalam mode SCAN_ONLY.";

let lastScanOnlyHoldLogAt = 0;

/** Gerbang pertama eksekusi live, sebelum cek profit dan gas. Hanya proses server. */
export function blockLiveExecutionForScanOnly(): boolean {
  if (getRuntimeBotMode() !== "SCAN_ONLY") return false;
  const now = Date.now();
  if (now - lastScanOnlyHoldLogAt >= AUTO_EXECUTE.signalSkipLogMs) {
    lastScanOnlyHoldLogAt = now;
    console.log(`\x1b[33m${SCAN_ONLY_HOLD_MESSAGE}\x1b[0m`);
    appendServerLog({
      level: "info",
      source: "SKIP",
      message: SCAN_ONLY_HOLD_MESSAGE,
    });
  }
  return true;
}
