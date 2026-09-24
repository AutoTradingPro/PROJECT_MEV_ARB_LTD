import { appendServerLog } from "@/lib/bot/serverLog";
import { readBotState } from "@/lib/bot/store";
import { notifyProHeartbeat } from "@/lib/bot/telegram";

export const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000;
const SESSION_TTL_MS = HEARTBEAT_INTERVAL_MS + 10 * 60 * 1000;

export interface HeartbeatSession {
  telegramId?: string;
  username?: string;
  email?: string;
  wallet?: string;
  sandbox?: boolean;
  wssEnabled?: boolean;
  rpcFallbackEnabled?: boolean;
  lastPingAt: number;
}

interface HeartbeatWindow {
  startedAt: number;
  scanCycles: number;
  routeCount: number;
  readyCount: number;
  blockHits: Record<string, true>;
  lastBlock: number;
  rpcOk: number;
  rpcFail: number;
}

type HeartbeatGlobal = typeof globalThis & {
  __mevHeartbeatTimer?: ReturnType<typeof setInterval>;
  __mevHeartbeatWindow?: HeartbeatWindow;
  __mevHeartbeatSessions?: Record<string, HeartbeatSession>;
};

function emptyWindow(now = Date.now()): HeartbeatWindow {
  return {
    startedAt: now,
    scanCycles: 0,
    routeCount: 0,
    readyCount: 0,
    blockHits: {},
    lastBlock: 0,
    rpcOk: 0,
    rpcFail: 0,
  };
}

function windowState(): HeartbeatWindow {
  const g = globalThis as HeartbeatGlobal;
  if (!g.__mevHeartbeatWindow) g.__mevHeartbeatWindow = emptyWindow();
  return g.__mevHeartbeatWindow;
}

function sessions(): Record<string, HeartbeatSession> {
  const g = globalThis as HeartbeatGlobal;
  if (!g.__mevHeartbeatSessions) g.__mevHeartbeatSessions = {};
  return g.__mevHeartbeatSessions;
}

export function ensureHeartbeatLoop(): void {
  const g = globalThis as HeartbeatGlobal;
  if (g.__mevHeartbeatTimer) return;
  g.__mevHeartbeatTimer = setInterval(() => {
    void tickHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
}

export function recordHeartbeatScan(input: {
  routes: number;
  ready: number;
  block?: number;
  ok?: boolean;
}): void {
  try {
    const stats = windowState();
    stats.scanCycles += 1;
    stats.routeCount += Math.max(0, input.routes);
    stats.readyCount += Math.max(0, input.ready);
    if (input.block && input.block > 0) {
      stats.blockHits[String(input.block)] = true;
      stats.lastBlock = input.block;
    }
    if (input.ok === false) stats.rpcFail += 1;
    else stats.rpcOk += 1;
    ensureHeartbeatLoop();
  } catch (error) {
    console.warn("[heartbeat] record scan", error instanceof Error ? error.message : error);
  }
}

export function recordProHeartbeatPing(input: {
  isPro?: boolean;
  telegramId?: string;
  username?: string;
  email?: string;
  wallet?: string;
  sandbox?: boolean;
  wssEnabled?: boolean;
  rpcFallbackEnabled?: boolean;
}): void {
  try {
    if (!input.isPro) return;
    const key =
      input.telegramId?.trim() ||
      input.username?.trim().toLowerCase() ||
      input.email?.trim().toLowerCase() ||
      input.wallet?.trim().toLowerCase() ||
      "pro-session";
    sessions()[key] = {
      telegramId: input.telegramId,
      username: input.username,
      email: input.email,
      wallet: input.wallet,
      sandbox: input.sandbox,
      wssEnabled: input.wssEnabled,
      rpcFallbackEnabled: input.rpcFallbackEnabled,
      lastPingAt: Date.now(),
    };
    ensureHeartbeatLoop();
  } catch (error) {
    console.warn("[heartbeat] ping", error instanceof Error ? error.message : error);
  }
}

function snapshotAndResetWindow(): HeartbeatWindow {
  const current = windowState();
  (globalThis as HeartbeatGlobal).__mevHeartbeatWindow = emptyWindow();
  return current;
}

function activeSessions(now = Date.now()): HeartbeatSession[] {
  return Object.values(sessions()).filter((session) => now - session.lastPingAt <= SESSION_TTL_MS);
}

async function tickHeartbeat(): Promise<void> {
  try {
    const recipients = activeSessions();
    if (recipients.length === 0) {
      snapshotAndResetWindow();
      return;
    }

    const hour = snapshotAndResetWindow();
    const state = await readBotState().catch(() => null);
    const killed = Boolean(state?.killed);
    const blocksScanned = Object.keys(hour.blockHits).length;
    const rpcStable = hour.rpcFail === 0 && hour.rpcOk > 0;
    const rpcMixed = hour.rpcFail > 0 && hour.rpcOk > 0;
    const rpcLabel = rpcStable
      ? "Stabil"
      : rpcMixed
        ? "Terputus sebagian"
        : hour.rpcFail > 0
          ? "Terputus"
          : "Tidak ada sampel";

    const wssOn = recipients.some((session) => session.wssEnabled);
    const wssOff = recipients.every((session) => session.wssEnabled === false);
    const wssLabel = wssOff ? "Off / terputus" : wssOn ? "Stabil" : "Tidak dilaporkan";
    const rpcFeedOn = recipients.some((session) => session.rpcFallbackEnabled !== false);
    const feedLabel = rpcFeedOn ? rpcLabel : "Off";

    const status = killed ? "Paused (kill switch)" : "Running Normally";
    const network = recipients.every((session) => session.sandbox) ? "Testnet" : "Mainnet";

    for (const session of recipients) {
      notifyProHeartbeat({
        isPro: true,
        telegramId: session.telegramId,
        username: session.username,
        email: session.email,
        wallet: session.wallet,
        sandbox: session.sandbox,
        status,
        network,
        blocksScanned,
        routesScanned: hour.routeCount,
        scanCycles: hour.scanCycles,
        lastBlock: hour.lastBlock || state?.lastBlock || 0,
        wssLabel: session.wssEnabled ? "Stabil" : session.wssEnabled === false ? "Off / terputus" : wssLabel,
        rpcLabel: session.rpcFallbackEnabled === false ? "Off" : feedLabel,
        healthy: !killed && hour.rpcFail === 0,
      });
    }

    appendServerLog({
      level: killed ? "warn" : "info",
      source: "heartbeat",
      message: `Heartbeat 60m · ${status} · ${blocksScanned} blok · ${hour.routeCount} rute · ${recipients.length} sesi Pro`,
    });
  } catch (error) {
    console.warn("[heartbeat] tick gagal (bot tetap jalan)", error instanceof Error ? error.message : error);
  }
}
