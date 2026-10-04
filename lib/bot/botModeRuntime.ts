import fs from "node:fs";
import path from "node:path";
import { normalizeBotMode } from "@/lib/scanOnly/mode";
import type { BotMode } from "@/lib/scanOnly/types";

const MODE_PATH = path.join(process.cwd(), "data", "bot-mode.json");

type ModeCache = { mode: BotMode; mtimeMs: number };

type ModeGlobal = typeof globalThis & {
  __mevRuntimeBotMode?: ModeCache;
  __mevBotModeWatch?: boolean;
};

function cache(): ModeGlobal {
  return globalThis as ModeGlobal;
}

function modeFromUnknown(value: unknown): BotMode | null {
  if (value === true || value === "true") return "EXECUTE";
  if (value === false || value === "false") return "SCAN_ONLY";
  if (typeof value !== "string") return null;
  const raw = value.trim().toUpperCase();
  if (raw === "EXECUTE" || raw === "EXEC" || raw === "LIVE") return "EXECUTE";
  if (raw === "SCAN_ONLY" || raw === "SCAN") return "SCAN_ONLY";
  return null;
}

export function parseTogglePayload(body: unknown): BotMode | null {
  const direct = modeFromUnknown(body);
  if (direct) return direct;
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  return modeFromUnknown(record.botMode ?? record.mode ?? record.status ?? record.execute ?? record.enabled);
}

function readModeFile(): { mode: BotMode; mtimeMs: number } | null {
  try {
    const stat = fs.statSync(MODE_PATH);
    const raw = JSON.parse(fs.readFileSync(MODE_PATH, "utf8")) as { botMode?: unknown; mode?: unknown };
    const mode = modeFromUnknown(raw.botMode ?? raw.mode);
    if (!mode) return null;
    return { mode, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
}

/** Mode hidup di proses ini. Disk menyamakan searcher dan server web tanpa restart. */
export function getRuntimeBotMode(): BotMode {
  const disk = readModeFile();
  const g = cache();
  if (disk && (!g.__mevRuntimeBotMode || disk.mtimeMs !== g.__mevRuntimeBotMode.mtimeMs)) {
    g.__mevRuntimeBotMode = disk;
  }
  return g.__mevRuntimeBotMode?.mode ?? "SCAN_ONLY";
}

export function setRuntimeBotMode(next: BotMode): BotMode {
  const mode = normalizeBotMode(next);
  fs.mkdirSync(path.dirname(MODE_PATH), { recursive: true });
  fs.writeFileSync(MODE_PATH, JSON.stringify({ botMode: mode, at: new Date().toISOString() }));
  const stat = fs.statSync(MODE_PATH);
  cache().__mevRuntimeBotMode = { mode, mtimeMs: stat.mtimeMs };
  return mode;
}

/** Searcher memakai ini supaya perubahan dari POST langsung masuk memori proses. */
export function watchRuntimeBotMode(): void {
  const g = cache();
  if (g.__mevBotModeWatch) return;
  g.__mevBotModeWatch = true;
  let last = getRuntimeBotMode();
  fs.mkdirSync(path.dirname(MODE_PATH), { recursive: true });
  fs.watch(path.dirname(MODE_PATH), (_event, filename) => {
    if (filename && filename !== path.basename(MODE_PATH)) return;
    const next = getRuntimeBotMode();
    if (next === last) return;
    last = next;
    console.log(`[searcher] BOT_MODE runtime = ${next}`);
  });
}
