import "./loadEnv";
import { watchRuntimeBotMode } from "@/lib/bot/botModeRuntime";
import { ensureLiveHub } from "@/lib/bot/liveHub";
import { startReserveMonitor } from "./wsMonitor";

function isBenignWsShutdown(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason);
  return /provider destroyed|cancelled request|closed before the connection was established|WebSocket is not open|WebSocket was closed/i.test(
    message
  );
}

process.on("unhandledRejection", (reason) => {
  if (isBenignWsShutdown(reason)) return;
  console.error("[searcher] unhandledRejection:", reason instanceof Error ? reason.message : String(reason));
});

process.on("uncaughtException", (error) => {
  if (isBenignWsShutdown(error)) return;
  console.error("[searcher] uncaughtException:", error instanceof Error ? error.message : String(error));
});

ensureLiveHub();
watchRuntimeBotMode();
startReserveMonitor();
console.log("[searcher] monitor cadangan DEX dimulai");
