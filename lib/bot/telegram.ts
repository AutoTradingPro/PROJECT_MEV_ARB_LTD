import { tokenWeiToUsd } from "@/lib/bot/configUnits";
import type { TradeTraceSnapshot } from "@/lib/bot/types";
import { explorerTxUrl } from "@/lib/chain/explorer";
import { getTradingNetwork, isTradingChainId } from "@/config/networks";
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
  chainId?: string;
  quoteDecimals?: number;
  quoteUsd?: number;
  minProfitUsd?: number;
  minerTipPct?: number;
}

/** Semua angka dolar pesan sukses. Fungsi pengirim menerima objek ini. */
export interface ArbitrageSuccessTelegram {
  chainName: string;
  tokenIn: string;
  tokenOut: string;
  dexA: string;
  dexB: string;
  blockNumber: number;
  loanUsd: number;
  grossProfitUsd: number;
  gasCostUsd: number;
  bribeUsd: number;
  netProfitUsd: number;
  minProfitTargetUsd: number;
  explorerUrl: string;
}

function usd2(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return `$${n.toFixed(2)}`;
}

function quoteUsdOf(wei: string | undefined, decimals: number, tokenUsd: number): number {
  return tokenWeiToUsd(wei || "0", decimals, tokenUsd);
}

export function formatArbitrageSuccessHtml(input: ArbitrageSuccessTelegram): string {
  const route = `${escapeHtml(input.tokenIn)} -&gt; ${escapeHtml(input.tokenOut)} (${escapeHtml(input.dexA)} -&gt; ${escapeHtml(input.dexB)})`;
  const href = escapeHtml(input.explorerUrl);
  return [
    "🚀 <b>[ARBITRAGE SUCCESS]</b>",
    `Jaringan: ${escapeHtml(input.chainName)}`,
    `Rute: ${route}`,
    `Block: #${input.blockNumber > 0 ? input.blockNumber : "—"}`,
    "💰 <b>KINERJA TRANSAKSI:</b>",
    `- Ukuran Loan: ${usd2(input.loanUsd)}`,
    `- Keuntungan Kotor: ${usd2(input.grossProfitUsd)}`,
    `- Biaya Gas Riil: ${usd2(input.gasCostUsd)}`,
    `- Bribe (Tip Builder): ${usd2(input.bribeUsd)}`,
    `✅ <b>PROFIT BERSIH: +${usd2(input.netProfitUsd)} (Lolos Target Min ${usd2(input.minProfitTargetUsd)})</b>`,
    `Tx Hash: <a href="${href}">${href}</a>`,
  ].join("\n");
}

export function toArbitrageSuccessTelegram(input: ProTradeSuccessNotifyInput): ArbitrageSuccessTelegram {
  const trace = input.trace;
  const chainId = input.chainId || "";
  const named = chainId && isTradingChainId(chainId) ? getTradingNetwork(chainId).name : "";
  const chainName = named
    ? input.sandbox
      ? `${named} (Testnet)`
      : named
    : input.sandbox
      ? "Testnet"
      : "Mainnet";
  const decimals = input.quoteDecimals && input.quoteDecimals > 0 ? input.quoteDecimals : 18;
  const tokenUsd = input.quoteUsd && input.quoteUsd > 0 ? input.quoteUsd : 1;
  const usd = (wei?: string) => quoteUsdOf(wei, decimals, tokenUsd);

  const pairParts = (input.pair || "").split(/[/\-→>]+/).map((part) => part.trim()).filter(Boolean);
  const tokenIn = trace?.sellToken || pairParts[0] || "—";
  const tokenOut = trace?.buyToken || pairParts[1] || "—";
  const dexA = trace?.buyDex || input.route?.split(/→|->/)[0]?.trim() || "—";
  const dexB = trace?.sellDex || input.route?.split(/→|->/)[1]?.trim() || "—";

  const loanFromWei = usd(trace?.loanAmountWei);
  const loanUsd = loanFromWei > 0 ? loanFromWei : input.loanAmountUsd || 0;
  const netProfitUsd = usd(input.netProfitWei);
  const gasCostUsd = usd(trace?.gasCostWei);
  const grossFromLegs = usd(trace?.amountOutWei) - usd(trace?.repayWei);
  const tipPct = Math.max(0, input.minerTipPct ?? 0);
  const grossBase = grossFromLegs > 0 ? grossFromLegs : netProfitUsd + gasCostUsd;
  const bribeUsd = grossBase > 0 ? (grossBase * tipPct) / 100 : 0;
  const grossProfitUsd = grossFromLegs > 0 ? grossFromLegs : netProfitUsd + gasCostUsd + bribeUsd;

  const hash = input.txHash.trim();
  return {
    chainName,
    tokenIn,
    tokenOut,
    dexA,
    dexB,
    blockNumber: trace?.blockNumber || 0,
    loanUsd,
    grossProfitUsd,
    gasCostUsd,
    bribeUsd,
    netProfitUsd,
    minProfitTargetUsd: input.minProfitUsd && input.minProfitUsd > 0 ? input.minProfitUsd : 0,
    explorerUrl: explorerTxUrl(hash, chainId || "bsc"),
  };
}

export function formatProTradeSuccessHtml(input: ProTradeSuccessNotifyInput): string {
  return formatArbitrageSuccessHtml(toArbitrageSuccessTelegram(input));
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
  chainId?: string;
  quoteDecimals?: number;
  quoteUsd?: number;
  loanAmountUsd?: number;
  minProfitUsd?: number;
  minerTipPct?: number;
  trace?: TradeTraceSnapshot;
  sandbox?: boolean;
}): void {
  const text = formatArbitrageSuccessHtml(toArbitrageSuccessTelegram(input));
  void sendTelegramMessage(text);
}

const SIMULATION_FAILOVER_TEXT =
  "⚠️ [FAILOVER] Node Utama mengalami fetch failed. Jalur simulasi berhasil dialihkan ke Premium BlockPi dalam &lt; 1ms.";

/** eth_call pindah ke BlockPi tanpa jeda setelah node cadangan putus. */
export function notifySimulationBlockPiFailover(): void {
  void sendTelegramMessage(SIMULATION_FAILOVER_TEXT);
}

/** eth_call pulih setelah fetch failed. Dipakai memantau node yang sempat putus. */
export function notifySimulationRetryRecovered(input: {
  chainId?: string;
  endpoint?: string;
  attempt: number;
  maxRetries: number;
  pair?: string;
  route?: string;
}): void {
  const text = [
    "✅ <b>RPC retry berhasil</b>",
    "Simulasi eth_call pulih setelah <b>fetch failed</b>.",
    `Percobaan: ${input.attempt}/${input.maxRetries}`,
    `Chain: ${escapeHtml(input.chainId || "—")}`,
    `Node: ${escapeHtml(input.endpoint || "—")}`,
    input.pair ? `Pair: ${escapeHtml(input.pair)}` : "",
    input.route ? `Rute: ${escapeHtml(input.route)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
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
