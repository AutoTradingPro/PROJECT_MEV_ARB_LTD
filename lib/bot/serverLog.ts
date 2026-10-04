export type ServerLogLevel = "info" | "scan" | "exec" | "profit" | "warn" | "error";

export interface ServerLogEntry {
  id: string;
  at: string;
  level: ServerLogLevel;
  source: string;
  message: string;
  chainId?: string;
}

type LogGlobal = typeof globalThis & {
  __mevArbServerLogs?: ServerLogEntry[];
};

const MAX_LOGS = 400;
const listeners = new Set<(entry: ServerLogEntry) => void>();

/** Server proses mendaftarkan pengirim dashboard. Modul ini tidak mengimpor socket. */
export function subscribeServerLogs(listener: (entry: ServerLogEntry) => void): void {
  listeners.add(listener);
}

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
  chainId?: string;
}): ServerLogEntry {
  const entry: ServerLogEntry = {
    id: `slog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    level: input.level,
    source: input.source,
    message: input.message.slice(0, 2000),
    chainId: input.chainId,
  };
  (globalThis as LogGlobal).__mevArbServerLogs = [...store(), entry].slice(-MAX_LOGS);
  for (const listener of listeners) listener(entry);
  return entry;
}

export function clearServerLogs(): void {
  (globalThis as LogGlobal).__mevArbServerLogs = [];
}
