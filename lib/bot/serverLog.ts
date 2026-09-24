export type ServerLogLevel = "info" | "scan" | "exec" | "profit" | "warn" | "error";

export interface ServerLogEntry {
  id: string;
  at: string;
  level: ServerLogLevel;
  source: string;
  message: string;
}

type LogGlobal = typeof globalThis & {
  __mevArbServerLogs?: ServerLogEntry[];
};

const MAX_LOGS = 400;

function store(): ServerLogEntry[] {
  const g = globalThis as LogGlobal;
  if (!g.__mevArbServerLogs) g.__mevArbServerLogs = [];
  return g.__mevArbServerLogs;
}

export function listServerLogs(): ServerLogEntry[] {
  return [...store()];
}

export function appendServerLog(input: {
  level: ServerLogLevel;
  source: string;
  message: string;
}): ServerLogEntry {
  const entry: ServerLogEntry = {
    id: `slog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    level: input.level,
    source: input.source,
    message: input.message.slice(0, 2000),
  };
  (globalThis as LogGlobal).__mevArbServerLogs = [...store(), entry].slice(-MAX_LOGS);
  return entry;
}

export function clearServerLogs(): void {
  (globalThis as LogGlobal).__mevArbServerLogs = [];
}
