export type NodeFeedChannel = "wss" | "rpc";

export interface NodeFeedLogEntry {
  id: string;
  at: string;
  channel: NodeFeedChannel;
  enabled: boolean;
  message: string;
  source: "owner";
}

type LogGlobal = typeof globalThis & {
  __mevArbNodeFeedLogs?: NodeFeedLogEntry[];
};

const MAX_LOGS = 80;

function store(): NodeFeedLogEntry[] {
  const g = globalThis as LogGlobal;
  if (!g.__mevArbNodeFeedLogs) g.__mevArbNodeFeedLogs = [];
  return g.__mevArbNodeFeedLogs;
}

export function listNodeFeedLogs(): NodeFeedLogEntry[] {
  return [...store()];
}

export function appendNodeFeedLog(input: {
  channel: NodeFeedChannel;
  enabled: boolean;
  message?: string;
}): NodeFeedLogEntry {
  const channelLabel = input.channel === "wss" ? "WSS Node" : "RPC Fallback";
  const state = input.enabled ? "ON · Mode Publik" : "OFF · Mode Hemat";
  const entry: NodeFeedLogEntry = {
    id: `nfl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    channel: input.channel,
    enabled: input.enabled,
    message: input.message || `${channelLabel} ${state}`,
    source: "owner",
  };
  const next = [entry, ...store()].slice(0, MAX_LOGS);
  (globalThis as LogGlobal).__mevArbNodeFeedLogs = next;
  return entry;
}
