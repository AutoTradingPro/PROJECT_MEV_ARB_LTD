import crypto from "node:crypto";
import http from "node:http";
import net from "node:net";
import type { ConsoleLine, FeedBadge, FeedRow } from "@/components/mev-core/types";
import { tokenWeiToUsd } from "@/lib/bot/configUnits";
import { netProfitUsdFromSpread } from "@/lib/bot/feedNet";
import { subscribeServerLogs, type ServerLogEntry, type ServerLogLevel } from "@/lib/bot/serverLog";
import type { Opportunity } from "@/lib/bot/types";
import { MEV_LIVE_PORT, type LivePublishMessage, type LiveServerMessage } from "@/lib/bot/liveTypes";
import { registerQueuedFeedPublisher } from "@/lib/bot/queueFeedBridge";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_FEED = 12;
const MAX_LOGS = 40;
const TERMINAL_MS = 120_000;
const ETH_USD_FALLBACK = 3450;

type SocketState = { socket: net.Socket; buffer: Buffer };

type Hub = {
  role: "idle" | "binding" | "server" | "client";
  server?: http.Server;
  clients: Set<net.Socket>;
  publisher?: net.Socket;
  publisherReady: boolean;
  feed: FeedRow[];
  logs: ConsoleLine[];
  fingerprint: string;
  terminal: Map<string, { status: FeedBadge; at: number }>;
  queue: LivePublishMessage[];
};

type HubGlobal = typeof globalThis & { __mevLiveHub?: Hub };

function hub(): Hub {
  const g = globalThis as HubGlobal;
  if (!g.__mevLiveHub) {
    g.__mevLiveHub = {
      role: "idle",
      clients: new Set(),
      publisherReady: false,
      feed: [],
      logs: [],
      fingerprint: "",
      terminal: new Map(),
      queue: [],
    };
  }
  return g.__mevLiveHub;
}

function ethUsdOf(item: Opportunity): number {
  const fromEnv = Number(process.env.ETH_USD || process.env.NATIVE_USD || "");
  if (Number.isFinite(fromEnv) && fromEnv > 50) return fromEnv;
  const quote = (item.tokenIn || "").toUpperCase();
  if ((quote === "WETH" || quote === "ETH") && Number(item.quoteUsd) > 50) return Number(item.quoteUsd);
  const base = (item.tokenOut || "").toUpperCase();
  if (base === "WETH" || base === "ETH") {
    const px = Number(item.priceDexAUsd || item.priceDexBUsd || 0);
    if (px > 50) return px;
  }
  return ETH_USD_FALLBACK;
}

export function toFeedBadge(status?: string, reason?: string): FeedBadge {
  if (status === "validated") return "validated";
  if (status === "queued") return "queued";
  if (status === "ready" || status === "simulated") return "ready";
  if (status === "executing" || status === "completed") return "executed";
  if (status === "failed") return "reverted";
  if (status === "rejected" && /revert/i.test(reason || "")) return "reverted";
  return "skipped";
}

export function opportunityToFeedRow(item: Opportunity): FeedRow {
  const decimals = item.quoteDecimals && item.quoteDecimals > 0 ? item.quoteDecimals : 18;
  const tokenUsd = item.quoteUsd && item.quoteUsd > 0 ? item.quoteUsd : 1;
  const loanUsd = tokenWeiToUsd(item.amountInWei || "0", decimals, tokenUsd);
  const gasUsd = tokenWeiToUsd(item.gasCostWei || "0", decimals, tokenUsd);
  const spreadPct = (item.spreadBps || 0) / 100;
  const bribeUsd = Number.isFinite(item.bribeUsd) ? Math.max(0, Number(item.bribeUsd)) : 0;
  const netUsd = netProfitUsdFromSpread({ loanUsd, spreadPct, gasUsd, bribeUsd });
  const ethUsd = ethUsdOf(item);
  return {
    id: item.id,
    chainId: item.chainId,
    pair: item.tokenPair || "—",
    route: `${item.dexAName || item.buyExchange || "DEX"} → ${item.dexBName || item.sellExchange || "DEX"}`,
    spreadPct,
    loanUsd,
    gasUsd,
    bribeUsd,
    gasEth: ethUsd > 0 ? gasUsd / ethUsd : 0,
    netEth: ethUsd > 0 ? netUsd / ethUsd : 0,
    netUsd,
    status: toFeedBadge(item.status, item.reason),
    live: true,
  };
}

/** Satu arah per pasangan DEX. Arah sebaliknya hanya cermin harga, bukan event pool kedua. */
function dropMirrorRoutes(items: Opportunity[]): Opportunity[] {
  const ranked = [...items].sort((a, b) => (b.spreadBps || 0) - (a.spreadBps || 0));
  const seen = new Set<string>();
  const kept: Opportunity[] = [];
  for (const item of ranked) {
    const forward = `${item.chainId}:${item.pairId}:${item.buyDex}:${item.sellDex}`;
    const mirror = `${item.chainId}:${item.pairId}:${item.sellDex}:${item.buyDex}`;
    if (seen.has(mirror) || seen.has(forward)) continue;
    seen.add(forward);
    kept.push(item);
  }
  return kept;
}

function stamp(iso?: string): string {
  const now = iso ? new Date(iso) : new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0").slice(0, 2);
  return `${hh}:${mm}:${ss}.${ms}`;
}

function toneFor(level: ServerLogLevel, source: string, message: string): ConsoleLine["tone"] {
  const blob = `${source} ${message}`.toUpperCase();
  if (blob.includes("REVERT")) return "error";
  if (level === "error") return "error";
  if (blob.includes("VALIDATED") || blob.includes("EXECUTED") || level === "exec" || level === "profit") return "ok";
  if (level === "warn" || blob.includes("SKIP")) return "warn";
  return "info";
}

function tagFor(source: string, message: string): string {
  const blob = `${source} ${message}`.toUpperCase();
  if (blob.includes("REVERT")) return "REVERTED";
  if (blob.includes("VALIDATED")) return "VALIDATED";
  if (blob.includes("EXECUTED")) return "EXECUTED";
  if (blob.includes("ETH_CALL") || blob.includes("DRY RUN") || blob.includes("SIMUL")) return "eth_call";
  if (blob.includes("BRIBE") || blob.includes("MINER TIP") || blob.includes("TIP BUDGET")) return "BRIBE";
  if (blob.includes("SKIP")) return "SKIPPED";
  return source.slice(0, 18) || "LOG";
}

function fingerprintOf(rows: FeedRow[]): string {
  return rows
    .map((row) => `${row.id}:${row.status}:${row.spreadPct.toFixed(2)}:${row.netUsd.toFixed(2)}:${row.gasEth.toFixed(4)}`)
    .join("|");
}

function overlay(rows: FeedRow[]): FeedRow[] {
  const state = hub();
  const now = Date.now();
  return rows.map((row) => {
    const mark = state.terminal.get(row.id);
    if (!mark || now - mark.at > TERMINAL_MS) return row;
    return { ...row, status: mark.status };
  });
}

function encodeServerText(text: string): Buffer {
  const payload = Buffer.from(text);
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function encodeClientText(text: string): Buffer {
  const payload = Buffer.from(text);
  const mask = crypto.randomBytes(4);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(6);
    header[0] = 0x81;
    header[1] = 0x80 | len;
    mask.copy(header, 2);
    return Buffer.concat([header, masked]);
  }
  header = Buffer.alloc(8);
  header[0] = 0x81;
  header[1] = 0x80 | 126;
  header.writeUInt16BE(len, 2);
  mask.copy(header, 4);
  return Buffer.concat([header, masked]);
}

function decodeFrames(buffer: Buffer): { messages: string[]; rest: Buffer; closed: boolean } {
  const messages: string[] = [];
  let offset = 0;
  let closed = false;
  while (offset + 2 <= buffer.length) {
    const opcode = buffer[offset] & 0x0f;
    const masked = (buffer[offset + 1] & 0x80) !== 0;
    let len = buffer[offset + 1] & 0x7f;
    let header = 2;
    if (len === 126) {
      if (buffer.length < offset + 4) break;
      len = buffer.readUInt16BE(offset + 2);
      header = 4;
    } else if (len === 127) {
      if (buffer.length < offset + 10) break;
      const wide = buffer.readBigUInt64BE(offset + 2);
      if (wide > BigInt(256_000)) {
        closed = true;
        break;
      }
      len = Number(wide);
      header = 10;
    }
    const maskLen = masked ? 4 : 0;
    if (buffer.length < offset + header + maskLen + len) break;
    const start = offset + header;
    let payload = buffer.subarray(start + maskLen, start + maskLen + len);
    if (masked) {
      const mask = buffer.subarray(start, start + 4);
      const copy = Buffer.from(payload);
      for (let i = 0; i < copy.length; i++) copy[i] ^= mask[i % 4];
      payload = copy;
    }
    if (opcode === 0x8) closed = true;
    else if (opcode === 0x9) messages.push("\u0000ping");
    else if (opcode === 0x1) messages.push(payload.toString("utf8"));
    offset += header + maskLen + len;
  }
  return { messages, rest: buffer.subarray(offset), closed };
}

function sendRaw(socket: net.Socket, frame: Buffer): void {
  if (socket.destroyed || !socket.writable) return;
  socket.write(frame);
}

function broadcast(message: LiveServerMessage): void {
  const frame = encodeServerText(JSON.stringify(message));
  for (const socket of hub().clients) sendRaw(socket, frame);
}

function snapshotMessage(): LiveServerMessage {
  const state = hub();
  return { type: "snapshot", feed: state.feed, logs: state.logs };
}

function applyPublish(message: LivePublishMessage): void {
  const state = hub();
  if (message.type === "publish-feed") {
    const rows = overlay(message.rows.slice(0, MAX_FEED));
    const next = fingerprintOf(rows);
    if (next === state.fingerprint) return;
    state.fingerprint = next;
    state.feed = rows;
    broadcast({ type: "ARBITRAGE_FEED", rows });
    return;
  }
  if (message.type === "publish-log") {
    state.logs = [message.line, ...state.logs].slice(0, MAX_LOGS);
    broadcast({ type: "CONSOLE_LOG", line: message.line });
    return;
  }
  state.terminal.set(message.id, { status: message.status, at: Date.now() });
  if (state.feed.length === 0) return;
  state.feed = overlay(state.feed.map((row) => (row.id === message.id ? { ...row, status: message.status } : row)));
  state.fingerprint = fingerprintOf(state.feed);
  broadcast({ type: "ARBITRAGE_FEED", rows: state.feed });
}

function flushQueue(): void {
  const state = hub();
  const pending = state.queue.splice(0);
  for (const message of pending) dispatch(message);
}

function dispatch(message: LivePublishMessage): void {
  const state = hub();
  if (state.role === "server") {
    applyPublish(message);
    return;
  }
  if (state.role === "client" && state.publisherReady && state.publisher?.writable) {
    sendRaw(state.publisher, encodeClientText(JSON.stringify(message)));
    return;
  }
  state.queue.push(message);
  ensureLiveHub();
}

function acceptUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
  const key = req.headers["sec-websocket-key"];
  if (!key || Array.isArray(key)) {
    socket.destroy();
    return;
  }
  const accept = crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  const state = hub();
  state.clients.add(socket);
  const bag: SocketState = { socket, buffer: Buffer.from(head) };
  const snap = snapshotMessage();
  if (snap.type === "snapshot") {
    sendRaw(socket, encodeServerText(JSON.stringify({ type: "ARBITRAGE_FEED", rows: snap.feed })));
    for (const line of [...snap.logs].reverse()) {
      sendRaw(socket, encodeServerText(JSON.stringify({ type: "CONSOLE_LOG", line })));
    }
  }
  socket.on("data", (chunk: Buffer) => {
    bag.buffer = Buffer.concat([bag.buffer, chunk]);
    const decoded = decodeFrames(bag.buffer);
    bag.buffer = Buffer.from(decoded.rest);
    if (decoded.closed) {
      state.clients.delete(socket);
      socket.destroy();
      return;
    }
    for (const text of decoded.messages) {
      if (text === "\u0000ping") {
        sendRaw(socket, Buffer.from([0x8a, 0x00]));
        continue;
      }
      try {
        const parsed = JSON.parse(text) as LivePublishMessage;
        if (parsed.type === "publish-feed" || parsed.type === "publish-log" || parsed.type === "publish-status") {
          applyPublish(parsed);
        }
      } catch {
        /* frame UI tidak dipakai sebagai perintah */
      }
    }
  });
  socket.on("close", () => state.clients.delete(socket));
  socket.on("error", () => state.clients.delete(socket));
}

function connectPublisher(attempt = 0): void {
  const state = hub();
  if (state.role === "server") return;
  state.role = "client";
  state.publisherReady = false;
  const socket = net.connect({ port: MEV_LIVE_PORT, host: "127.0.0.1" });
  state.publisher = socket;
  const key = crypto.randomBytes(16).toString("base64");
  let accepted = false;
  let retried = false;
  const bag: SocketState = { socket, buffer: Buffer.alloc(0) };
  socket.on("connect", () => {
    socket.write(
      `GET /ingest HTTP/1.1\r\nHost: 127.0.0.1:${MEV_LIVE_PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
    );
  });
  socket.on("data", (chunk: Buffer) => {
    if (!accepted) {
      bag.buffer = Buffer.concat([bag.buffer, chunk]);
      const text = bag.buffer.toString("utf8");
      const split = text.indexOf("\r\n\r\n");
      if (split < 0) return;
      accepted = text.slice(0, split).includes("101");
      bag.buffer = Buffer.from(bag.buffer.subarray(split + 4));
      if (!accepted) {
        socket.destroy();
        return;
      }
      state.publisherReady = true;
      flushQueue();
    }
    if (bag.buffer.length > 1_000_000) bag.buffer = Buffer.alloc(0);
  });
  const retry = () => {
    if (retried || hub().publisher !== socket) return;
    retried = true;
    state.publisher = undefined;
    state.publisherReady = false;
    if (state.role === "server") return;
    state.role = "idle";
    const wait = Math.min(2000, 200 * (attempt + 1));
    setTimeout(() => {
      if (hub().role === "idle") connectPublisher(attempt + 1);
    }, wait);
  };
  socket.on("error", retry);
  socket.on("close", retry);
}

const wireFlag = globalThis as typeof globalThis & { __mevLiveLogWired?: boolean };
if (!wireFlag.__mevLiveLogWired) {
  wireFlag.__mevLiveLogWired = true;
  subscribeServerLogs((entry) => publishConsoleFromLog(entry));
}

export function ensureLiveHub(): void {
  const state = hub();
  if (state.role === "server" || state.role === "client" || state.role === "binding") return;
  state.role = "binding";
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, clients: hub().clients.size, feed: hub().feed.length }));
  });
  server.on("upgrade", (req, socket, head) => {
    acceptUpgrade(req, socket as net.Socket, head);
  });
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      state.server = undefined;
      connectPublisher();
      return;
    }
    state.role = "idle";
    console.warn(`[live] ${error.message}`);
  });
  server.listen(MEV_LIVE_PORT, "127.0.0.1", () => {
    state.role = "server";
    state.server = server;
    console.log(`[live] stream dashboard ws://127.0.0.1:${MEV_LIVE_PORT}`);
    flushQueue();
  });
}

function rebindLiveServer(): void {
  const state = hub();
  const server = state.server;
  if (!server || state.role !== "server") return;
  server.removeAllListeners("upgrade");
  server.on("upgrade", (req, socket, head) => {
    acceptUpgrade(req, socket as net.Socket, Buffer.isBuffer(head) ? head : Buffer.from(head));
  });
  for (const socket of state.clients) socket.destroy();
  state.clients.clear();
}

rebindLiveServer();

export function publishFeedFromOpportunities(items: Opportunity[]): void {
  const rows = dropMirrorRoutes(items)
    .filter((item) => Boolean(item.chainId))
    .slice(0, MAX_FEED)
    .map(opportunityToFeedRow);
  dispatch({ type: "publish-feed", rows });
}

/** Rute yang lolos scan awal, sebelum filter spread eksekusi. */
export function publishQueuedFeed(items: Opportunity[]): void {
  const rows = dropMirrorRoutes(items)
    .filter((item) => Boolean(item.chainId))
    .slice(0, MAX_FEED)
    .map((item) => ({ ...opportunityToFeedRow(item), status: "queued" as const }));
  dispatch({ type: "publish-feed", rows });
}

registerQueuedFeedPublisher(publishQueuedFeed);

export function publishConsoleFromLog(entry: Pick<ServerLogEntry, "id" | "at" | "level" | "source" | "message" | "chainId">): void {
  const line: ConsoleLine = {
    id: entry.id,
    time: stamp(entry.at),
    tag: tagFor(entry.source, entry.message),
    message: entry.message,
    tone: toneFor(entry.level, entry.source, entry.message),
    chainId: entry.chainId,
  };
  dispatch({ type: "publish-log", line });
}

export function noteFeedStatus(id: string, status: FeedBadge): void {
  if (!id) return;
  dispatch({ type: "publish-status", id, status });
}
