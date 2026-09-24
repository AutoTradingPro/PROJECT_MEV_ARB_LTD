import { formatBnbAmount, formatStableWeiAsBnb, usdToBnb } from "@/lib/bot/bnbQuote";
import { formatUsd, stableWeiToUsd } from "@/lib/bot/configUnits";
import { resolveTradeTrace } from "@/lib/bot/transactionTrace";
import type { TradeRecord, TradeTraceSnapshot } from "@/lib/bot/types";
import { bscscanTxUrl, shortenTxHash } from "@/lib/chain/explorer";
import { lookupStoredUser, telegramIdForUser } from "@/lib/db";
import { after } from "next/server";
import { AUTO_EXECUTE } from "@/lib/bot/constants";

const TELEGRAM_API = "https://api.telegram.org";

function env(name: string): string {
  return process.env[name]?.trim() || "";
}

export function telegramBotToken(): string {
  return env("TELEGRAM_BOT_TOKEN");
}

export function telegramFallbackChatId(): string {
  return env("TELEGRAM_CHAT_ID");
}

export function telegramConfig(): { token: string; chatId: string } | null {
  const token = telegramBotToken();
  const chatId = telegramFallbackChatId();
  if (!token || !chatId) return null;
  return { token, chatId };
}

export function telegramWebhookSecret(): string {
  return env("TELEGRAM_WEBHOOK_SECRET");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isPlausibleTelegramChatId(chatId: string): boolean {
  return /^-?\d{5,20}$/.test(chatId.trim());
}

export interface TelegramUserRef {
  username?: string;
  email?: string;
  wallet?: string;
  telegramId?: string;
}

/** Telegram ID user Pro dari DB terpusat, lalu ID sesi, lalu TELEGRAM_CHAT_ID. */
export function resolveProTelegramChatIds(ref: TelegramUserRef = {}): string[] {
  const ids = new Set<string>();
  try {
    const stored = lookupStoredUser(ref);
    const fromDb = telegramIdForUser(stored);
    if (fromDb && isPlausibleTelegramChatId(fromDb)) ids.add(fromDb.trim());
  } catch (error) {
    console.warn("[telegram] lookup user gagal", error instanceof Error ? error.message : error);
  }

  const sessionId = ref.telegramId?.trim() || "";
  if (sessionId && isPlausibleTelegramChatId(sessionId)) ids.add(sessionId);

  if (ids.size === 0) {
    const fallback = telegramFallbackChatId();
    if (fallback && isPlausibleTelegramChatId(fallback)) ids.add(fallback);
  }

  return [...ids];
}

export async function sendTelegramMessageToChat(
  chatId: string,
  text: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = telegramBotToken();
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN belum diisi di .env.local." };
  }
  const target = chatId.trim();
  if (!target) {
    return { ok: false, error: "Telegram chat ID kosong." };
  }
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: target,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (!res.ok || json.ok === false) {
      console.warn("[telegram] sendMessage HTTP", res.status, json.description || "");
      return { ok: false, error: sanitizeTelegramApiError(res.status, json.description) };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "telegram gagal";
    console.warn("[telegram]", message);
    return { ok: false, error: "Tidak bisa menghubungi API Telegram. Periksa jaringan server." };
  }
}

/** Kirim pesan ke chat bot. Tidak melempar — gagal Telegram tidak boleh memutus eksekusi. */
export async function sendTelegramMessage(text: string): Promise<void> {
  await sendTelegramMessageResult(text);
}

export async function sendTelegramMessageResult(
  text: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = telegramConfig();
  if (!cfg) {
    return {
      ok: false,
      error: "TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diisi di .env.local.",
    };
  }
  return sendTelegramMessageToChat(cfg.chatId, text);
}

function sanitizeTelegramApiError(status: number, description?: string): string {
  const desc = (description || "").toLowerCase();
  if (status === 401 || desc.includes("unauthorized")) {
    return "Token bot tidak valid. Periksa TELEGRAM_BOT_TOKEN di .env.local.";
  }
  if (status === 400 && (desc.includes("chat not found") || desc.includes("chat_id"))) {
    return "Chat ID tidak valid atau bot belum di-start di percakapan itu.";
  }
  if (status === 403) {
    return "Bot diblokir atau belum punya izin mengirim ke chat ini.";
  }
  return "Telegram menolak pesan uji. Periksa token, chat ID, dan apakah bot sudah di-Start.";
}

export interface ProTradeSuccessNotifyInput extends TelegramUserRef {
  isPro?: boolean;
  txHash: string;
  pair?: string;
  route?: string;
  netProfitWei?: string;
  trace?: TradeTraceSnapshot;
  loanAmountUsd?: number;
  source?: string;
  sandbox?: boolean;
}

export function formatProTradeSuccessHtml(input: ProTradeSuccessNotifyInput): string {
  const trade: TradeRecord = {
    id: "telegram-report",
    at: new Date().toISOString(),
    pair: input.pair || "—",
    route: input.route || "—",
    netProfitWei: input.netProfitWei || "0",
    txHash: input.txHash,
    outcome: "success",
    trace: input.trace,
  };
  const resolved = resolveTradeTrace(trade, {
    lastBlock: input.trace?.blockNumber || 0,
    gasPriceWei: input.trace?.gasPriceWei || "0",
    gasLimit: Math.max(1, input.trace?.gasUsed || 500_000),
    aaveFeePct: input.trace?.protocolFeePct || 0.05,
    loanAmountUsd: input.loanAmountUsd || 0,
    isSandbox: input.sandbox,
    isPro: true,
  });

  const gasBnb = Number(resolved.gasFeeNative);
  const feeBnb = usdToBnb(stableWeiToUsd(input.trace?.protocolFeeWei || "0"));
  const gasFeeTotal = formatBnbAmount(
    (Number.isFinite(gasBnb) ? gasBnb : 0) + (Number.isFinite(feeBnb) ? feeBnb : 0),
    8
  );
  const loanLabel =
    resolved.loanAmountLabel !== "—"
      ? resolved.loanAmountLabel
      : input.loanAmountUsd
        ? `${formatUsd(input.loanAmountUsd)}`
        : "—";
  const hash = input.txHash.trim();
  const networkLine = input.sandbox ? "Jaringan: Testnet (sandbox)" : "Jaringan: Mainnet";
  const sourceLine = input.source ? `Sumber: ${escapeHtml(input.source)}` : "";

  const lines = [
    "✅ <b>Success</b>",
    "<i>MEV Flash Loan · Mode Pro</i>",
    escapeHtml(networkLine),
    sourceLine,
    "",
    "<b>Pair</b>",
    escapeHtml(resolved.pair || input.pair || "—"),
    "",
    "<b>Route</b>",
    escapeHtml(
      resolved.buyDex && resolved.sellDex
        ? `${resolved.buyDex} → ${resolved.sellDex}`
        : input.route || "—"
    ),
    "",
    "<b>Loan Amount</b>",
    escapeHtml(loanLabel),
    "",
    "<b>Tx Hash</b>",
    `<code>${escapeHtml(hash)}</code>`,
  ];

  if (!input.sandbox && hash.startsWith("0x") && hash.length >= 66) {
    lines.push(`<a href="${escapeHtml(bscscanTxUrl(hash))}">Buka BSCScan</a>`);
  }

  lines.push(
    "",
    "<b>Gas + Fee</b>",
    escapeHtml(`Gas ${resolved.gasBnbLabel}`),
    escapeHtml(`Fee protokol ${resolved.protocolFeeBnb}`),
    `<b>Total ${escapeHtml(gasFeeTotal)}</b>`,
    "",
    "<b>Net Profit</b>",
    `<b>${escapeHtml(resolved.netProfitBnb || formatStableWeiAsBnb(input.netProfitWei || "0", 6))}</b>`
  );

  return lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n");
}

async function deliverProTradeSuccess(input: ProTradeSuccessNotifyInput): Promise<void> {
  try {
    if (!input.isPro) return;
    const hash = input.txHash?.trim();
    if (!hash) return;

    const chatIds = resolveProTelegramChatIds(input);
    if (chatIds.length === 0) {
      console.warn("[telegram] laporan Pro dilewati — Telegram ID user tidak ditemukan.");
      return;
    }

    const text = formatProTradeSuccessHtml(input);
    await Promise.all(chatIds.map((chatId) => sendTelegramMessageToChat(chatId, text)));
  } catch (error) {
    console.warn(
      "[telegram] laporan Pro gagal (eksekusi dApp tetap jalan)",
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Laporan sukses flash loan ke Telegram user Pro.
 * Fire-and-forget: tidak pernah melempar ke pemanggil.
 */
export function notifyProTradeSuccess(input: ProTradeSuccessNotifyInput): void {
  try {
    if (!input.isPro) return;
    void deliverProTradeSuccess(input);
  } catch (error) {
    console.warn(
      "[telegram] notifyProTradeSuccess",
      error instanceof Error ? error.message : error
    );
  }
}

/** Jadwalkan laporan setelah response HTTP dikirim agar Telegram tidak menahan eksekusi. */
export function scheduleProTradeSuccessNotify(input: ProTradeSuccessNotifyInput): void {
  try {
    if (!input.isPro) return;
    after(() => {
      notifyProTradeSuccess(input);
    });
  } catch {
    notifyProTradeSuccess(input);
  }
}

export interface ProHeartbeatNotifyInput extends TelegramUserRef {
  isPro?: boolean;
  sandbox?: boolean;
  status: string;
  network: string;
  blocksScanned: number;
  routesScanned: number;
  scanCycles: number;
  lastBlock: number;
  wssLabel: string;
  rpcLabel: string;
  healthy: boolean;
}

export function formatProHeartbeatHtml(input: ProHeartbeatNotifyInput): string {
  const networkTag = input.sandbox ? "TESTNET" : "MAINNET";
  return [
    "💓 <b>Heartbeat Report</b>",
    `<i>MEV Arbitrase · Mode Pro · ${escapeHtml(networkTag)}</i>`,
    "",
    `<b>Status sistem</b>`,
    escapeHtml(input.status),
    "",
    `<b>1 jam terakhir</b>`,
    `Blok dipindai: <b>${input.blocksScanned}</b>`,
    `Rute dipindai: <b>${input.routesScanned}</b>`,
    `Siklus scan: ${input.scanCycles}`,
    `Blok terakhir: #${input.lastBlock || "—"}`,
    `Jaringan: ${escapeHtml(input.network)}`,
    "",
    `<b>Koneksi</b>`,
    `WSS Node: ${escapeHtml(input.wssLabel)}`,
    `RPC Fallback: ${escapeHtml(input.rpcLabel)}`,
    "",
    input.healthy
      ? "✅ <b>Heartbeat:</b> bot berjalan tanpa kendala."
      : "⚠️ <b>Heartbeat:</b> ada gangguan (kill switch atau RPC). Periksa Dashboard Owner.",
  ].join("\n");
}

async function deliverProHeartbeat(input: ProHeartbeatNotifyInput): Promise<void> {
  try {
    if (!input.isPro) return;
    const chatIds = resolveProTelegramChatIds(input);
    if (chatIds.length === 0) return;
    const text = formatProHeartbeatHtml(input);
    await Promise.all(chatIds.map((chatId) => sendTelegramMessageToChat(chatId, text)));
  } catch (error) {
    console.warn(
      "[telegram] heartbeat gagal (eksekusi dApp tetap jalan)",
      error instanceof Error ? error.message : error
    );
  }
}

/** Heartbeat 60 menit — fire-and-forget, tidak melempar ke pemanggil. */
export function notifyProHeartbeat(input: ProHeartbeatNotifyInput): void {
  try {
    if (!input.isPro) return;
    void deliverProHeartbeat(input);
  } catch (error) {
    console.warn("[telegram] notifyProHeartbeat", error instanceof Error ? error.message : error);
  }
}

export function notifyTxSuccess(input: {
  txHash: string;
  pair?: string;
  route?: string;
  netProfitWei?: string;
  source?: string;
}): void {
  const profitUsd = formatUsd(stableWeiToUsd(input.netProfitWei || "0"));
  const hash = input.txHash;
  const text = [
    "✅ <b>MEV eksekusi sukses</b>",
    `Sumber: ${escapeHtml(input.source || "bot")}`,
    `Pair: ${escapeHtml(input.pair || "—")}`,
    `Rute: ${escapeHtml(input.route || "—")}`,
    `Profit est.: <b>${escapeHtml(profitUsd)}</b>`,
    `Tx: <code>${escapeHtml(shortenTxHash(hash))}</code>`,
    `<a href="${escapeHtml(bscscanTxUrl(hash))}">Buka BSCScan</a>`,
  ].join("\n");
  void sendTelegramMessage(text);
}

export function notifyTxFailure(input: {
  message: string;
  pair?: string;
  route?: string;
  source?: string;
}): void {
  if (!shouldAlertExecError(input.message)) return;
  if (isSkipOrFailProfitAlreadyNotified(input.message)) return;
  const text = [
    "⚠️ <b>MEV eksekusi gagal / revert</b>",
    `Sumber: ${escapeHtml(input.source || "bot")}`,
    `Pair: ${escapeHtml(input.pair || "—")}`,
    `Rute: ${escapeHtml(input.route || "—")}`,
    `Error: ${escapeHtml(input.message.slice(0, 500))}`,
  ].join("\n");
  void sendTelegramMessage(text);
}

function isSkipOrFailProfitAlreadyNotified(message: string): boolean {
  return /Net profit di bawah lantai|Profit terlalu kecil|tidak menutup biaya gas|\[SKIP\]|\[FAIL\]|SKIP MATH|FAIL MATH|FINANCIAL BREAKDOWN/i.test(
    message
  );
}

type SkipTelegramStore = typeof globalThis & {
  __mevSkipTelegramAt?: Record<string, number>;
};

function skipTelegramStore(): Record<string, number> {
  const g = globalThis as SkipTelegramStore;
  if (!g.__mevSkipTelegramAt) g.__mevSkipTelegramAt = {};
  return g.__mevSkipTelegramAt;
}

export function notifySkipOrFailProfitHtml(input: {
  text: string;
  dedupeKey: string;
  force?: boolean;
}): void {
  try {
    const text = input.text?.trim();
    if (!text) return;
    const key = (input.dedupeKey || "skip").slice(0, 180);
    const now = Date.now();
    const store = skipTelegramStore();
    if (!input.force) {
      const last = store[key] || 0;
      if (now - last < AUTO_EXECUTE.skipTelegramMs) return;
    }
    store[key] = now;
    const send = () => {
      void sendTelegramMessage(text);
    };
    try {
      after(send);
    } catch {
      send();
    }
  } catch (error) {
    console.warn("[telegram] skip/fail notify", error instanceof Error ? error.message : error);
  }
}

/** Skip noise operasional (cooldown, gas cap, tidak ada peluang) agar HP tidak kebanjiran. */
export function shouldAlertExecError(message: string): boolean {
  return !/Cooldown otonom|Tidak ada peluang|tidak ada peluang|Kill switch|ditahan|melebihi batas|Gas jaringan belum|belum siap|status siap|Approval Extreme|ditolak di MetaMask|user rejected/i.test(
    message
  );
}
