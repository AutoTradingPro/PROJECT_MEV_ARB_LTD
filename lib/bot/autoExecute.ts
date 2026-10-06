import { AUTO_EXECUTE, dexLabel, SCAN_HOT_INTERVAL_MAX_MS, SCAN_HOT_INTERVAL_MIN_MS, SCAN_IDLE_INTERVAL_MS, SCAN_IDLE_SPREAD_GAP_PCT, SOLANA_SCAN_HOT_INTERVAL_MAX_MS, SOLANA_SCAN_HOT_INTERVAL_MIN_MS, SOLANA_SCAN_IDLE_INTERVAL_MS } from "@/lib/bot/constants";
import { compareDirectedOpportunities, formatDexArrow } from "@/lib/bot/dexDirections";
import { extremeFilterCaps } from "@/lib/bot/gasStrategy";
import { formatPoolLiquidityLabel, meetsMinPoolLiquidityUsd, opportunityFailsPoolSafety } from "@/lib/bot/poolSafety";
import { formatPct, pctToBps, tokenWeiToUsd } from "@/lib/bot/configUnits";
import {
  resolveAdaptiveMinProfitUsd,
  solanaEffectiveMinSpreadPct,
} from "@/lib/bot/adaptiveMinProfit";
import { formatEstimatedTxGasFromPrice } from "@/lib/bot/gasCostEstimate";
import { parseBlockNumber } from "@/lib/chain/publicEnv";
import { formatBps } from "@/lib/bot/dexMath";
import { normalizeTradingChainId } from "@/config/networks";
import { appendServerLog } from "@/lib/bot/serverLog";
import { publishQueuedScanRoutes } from "@/lib/bot/queueFeedBridge";
import type { BotConfig, Opportunity } from "@/lib/bot/types";

/* Tidak ada chain yang ditahan. Monad memakai executor EVM standar. */
const MEV_EXECUTOR_REDEPLOY_HOLD: Record<string, string> = {};

const redeployHoldLoggedAt = new Map<string, number>();

/** Alasan skip, atau null jika chain boleh masuk profit, gas, dan dryRun. */
export function mevExecutorRedeployHoldReason(chainId: string | null | undefined): string | null {
  const key = String(chainId ?? "").trim().toLowerCase();
  return MEV_EXECUTOR_REDEPLOY_HOLD[key] ?? null;
}

/** Tulis alasan yang sama ke stdout dan CONSOLE_LOG. Telegram dikirim pemanggil. */
export function noteMevExecutorRedeployHold(chainId: string | null | undefined): string | null {
  const reason = mevExecutorRedeployHoldReason(chainId);
  if (!reason) return null;
  const key = String(chainId ?? "").trim().toLowerCase();
  const now = Date.now();
  if (now - (redeployHoldLoggedAt.get(key) ?? 0) >= AUTO_EXECUTE.skipTelegramMs) {
    redeployHoldLoggedAt.set(key, now);
    console.log(reason);
    if (typeof window === "undefined") {
      appendServerLog({
        level: "warn",
        source: "SKIPPED",
        chainId: key,
        message: reason,
      });
    }
  }
  return reason;
}
/* CIRCUIT BREAKER END */

export function gasPriceToGwei(gasPriceWei: string | undefined): number {
  try {
    const wei = BigInt(gasPriceWei || "0");
    if (wei <= 0n) return 0;
    return Number(wei) / 1e9;
  } catch {
    return 0;
  }
}

/** Pilih wei gas yang valid; data live node diutamakan dibanding state bot yang masih 0. */
export function pickLiveGasWei(...candidates: Array<string | undefined>): string {
  for (const value of candidates) {
    try {
      if (value && BigInt(value) > 0n) return value;
    } catch {
      /* skip */
    }
  }
  return "0";
}

export function formatGasNetworkDisplay(
  gasPriceWei: string | undefined,
  nativeSymbol: string,
  opts?: { chainId?: string | null }
): { primary: string; secondary: string } {
  const gwei = gasPriceToGwei(gasPriceWei);
  if (opts?.chainId === "solana") {
    try {
      const micro = BigInt(gasPriceWei || "0");
      if (micro <= 0n) {
        return { primary: "Menunggu priority fee…", secondary: "" };
      }
      return {
        primary: `${micro.toString()} µLamports/CU`,
        secondary: "Solana prioritization fee",
      };
    } catch {
      return { primary: "Menunggu priority fee…", secondary: "" };
    }
  }
  if (gwei <= 0) {
    return { primary: "Menunggu node…", secondary: "" };
  }
  let native = "";
  try {
    const wei = BigInt(gasPriceWei || "0");
    native = `${(Number(wei) / 1e18).toFixed(12).replace(/0+$/, "").replace(/\.$/, "")} ${nativeSymbol} / unit`;
  } catch {
    native = "";
  }
  return {
    primary: `${gwei >= 10 ? gwei.toFixed(2) : gwei.toFixed(4)} gwei`,
    secondary: native,
  };
}

export function formatGasGweiLabel(gasPriceWei: string | undefined): string {
  const gwei = gasPriceToGwei(gasPriceWei);
  if (gwei <= 0) return "—";
  return `${gwei >= 10 ? gwei.toFixed(2) : gwei.toFixed(4)} gwei`;
}

/** Jam terminal `[21.06.34]` — konsisten di UI dan stdout. */
export function formatScanTimestamp(date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}.${m}.${s}`;
}

export function formatSpreadPct(spreadBps: number): string {
  const bps = Number.isFinite(spreadBps) ? spreadBps : 0;
  const sign = bps > 0 ? "+" : "";
  return `${sign}${(bps / 100).toFixed(2)}%`;
}

export function formatFlashRouteLabel(input: {
  provider?: string;
  pair?: string;
  dexIn?: string;
  dexOut?: string;
}): string {
  const pair = (input.pair || "—").trim() || "—";
  const dexIn = (input.dexIn || "—").trim() || "—";
  const dexOut = (input.dexOut || "—").trim() || "—";
  return `${pair} ${dexIn} -> ${dexOut}`;
}

function isPlaceholderScanRoute(value: string): boolean {
  const text = value.replace(/\s+/g, " ").trim();
  return !text || text === "—" || text === "— — -> —" || text === "— -> —";
}

export function networkScanTag(chainId?: string, sandbox = false): string {
  const id = normalizeTradingChainId(chainId);
  const name =
    id === "polygon"
      ? "Polygon"
      : id === "arbitrum"
        ? "Arbitrum"
        : id === "ethereum"
          ? "Ethereum"
          : id === "solana"
            ? "Solana"
            : id === "monad"
              ? "Monad"
              : id === "linea"
                ? "Linea"
                : id === "optimism"
                  ? "Optimism"
                  : id === "avalanche"
                    ? "Avalanche"
                    : id === "base"
                      ? "Base"
                      : "BSC";
  return `${name} ${sandbox ? "testnet" : "mainnet"}`;
}

const FOREIGN_SCAN_LOG: Record<string, RegExp> = {
  ethereum: /chain=ethereum|\[Ethereum\s|PRIVATE_KEY_ETHEREUM|RPC_HTTP_URL_ETHEREUM/i,
  polygon: /chain=polygon|\[Polygon\s|PRIVATE_KEY_POLYGON|RPC_HTTP_URL_POLYGON/i,
  arbitrum: /chain=arbitrum|\[Arbitrum\s|PRIVATE_KEY_ARBITRUM|RPC_HTTP_URL_ARBITRUM/i,
  bsc: /chain=bsc|\[BSC\s|PRIVATE_KEY_BSC|RPC_HTTP_URL_BSC/i,
  solana: /chain=solana|\[Solana\s|SOLANA-SCAN|SOLANA-WORKER|SOLANA-LIVE|SOLANA-EXEC/i,
  monad: /chain=monad|\[Monad\s|\[MONAD 143\]|MONAD_RPC_URL|MONAD_WSS_URL/i,
};

/** Log scan/signer hanya untuk rantai tab aktif. */
export function scanLogBelongsToActiveChain(message: string, chainId?: string): boolean {
  const active = normalizeTradingChainId(chainId);
  for (const [id, marker] of Object.entries(FOREIGN_SCAN_LOG)) {
    if (id === active) continue;
    if (marker.test(message)) return false;
  }
  return true;
}

/** `[12.04.11] [AUTO] Spread max +0.290% belum >= Minimum Spread 0.40% (0.40%) — menunggu tick berikutnya.` */
export function formatAutoSpreadWaitLine(input: {
  maxSpreadBps: number;
  minSpreadPct: number;
  minSpreadBps?: number;
  reason?: string;
  provider?: string;
  pair?: string;
  dexIn?: string;
  dexOut?: string;
  chainId?: string;
  sandbox?: boolean;
  at?: Date;
}): string {
  const clock = formatScanTimestamp(input.at);
  const network = networkScanTag(input.chainId, input.sandbox);
  const panel = formatPct(input.minSpreadPct);
  const gateBps =
    input.minSpreadBps !== undefined ? input.minSpreadBps : pctToBps(input.minSpreadPct);
  const gate = `${(gateBps / 100).toFixed(2)}%`;
  const max = formatBps(input.maxSpreadBps);
  const provider = (input.provider || "").trim();
  const route = formatFlashRouteLabel({
    pair: input.pair,
    dexIn: input.dexIn,
    dexOut: input.dexOut,
  });
  const providerBit = provider ? ` · ${provider}` : "";
  const routeBit = isPlaceholderScanRoute(route) ? "" : ` · ${route}`;
  if (spreadMeetsMinimum(input.maxSpreadBps, gateBps)) {
    const detail = (input.reason || "net profit AMM belum lolos").replace(/\s+/g, " ").trim();
    return `[${clock}] [${network}] [AUTO] Spread max ${max} sudah >= Minimum Spread ${panel} (${gate})${providerBit}${routeBit} tetapi 0 ready — ${detail}.`;
  }
  return `[${clock}] [${network}] [AUTO] Spread max ${max} belum >= Minimum Spread ${panel} (${gate})${providerBit}${routeBit} — menunggu tick berikutnya.`;
}

export function featuredOpportunity(opportunities: Opportunity[]): Opportunity | null {
  if (opportunities.length === 0) return null;
  return [...opportunities].sort((a, b) => (b.spreadBps || 0) - (a.spreadBps || 0))[0] ?? null;
}

/** Alasan kandidat spot≥min tetapi status bukan ready (untuk log UI / worker). */
export function describeSolanaNotReadyDetail(
  opportunities: Opportunity[],
  minSpreadBps: number
): string | undefined {
  const candidates = [...opportunities]
    .filter((item) => spreadMeetsMinimum(item.spreadBps, minSpreadBps) && item.status !== "ready")
    .sort((a, b) => (b.spreadBps || 0) - (a.spreadBps || 0));
  const top = candidates[0];
  if (!top?.reason) return undefined;
  const route = `${top.tokenPair || "—"} ${top.buyExchange || top.dexAName || "?"}→${top.sellExchange || top.dexBName || "?"}`;
  return `${route} · ${top.reason}`;
}

/** Alasan rute terbaik tidak masuk eksekusi (setelah sinyal spread tercapai). */
export function explainAutoExecuteSkip(input: {
  opportunities: Opportunity[];
  config: BotConfig;
  sandbox?: boolean;
}): string {
  const minSpreadBps = minSpreadBpsFromConfig(input.config, input.sandbox);
  const top = featuredOpportunity(input.opportunities);
  if (!top) return "tidak ada rute hasil pindai";
  if (!spreadMeetsMinimum(top.spreadBps, minSpreadBps)) {
    return `spread ${formatBps(top.spreadBps)} masih di bawah minimum ${formatPct(input.config.minSpreadPct)}`;
  }
  if (!input.sandbox && top.status !== "ready") {
    return (top.reason || `status ${top.status}, belum Siap`).replace(/\s+/g, " ").trim();
  }
  const poolBlock = opportunityFailsPoolSafety(
    top,
    input.config.minPoolLiquidityUsd,
    input.config.maxPriceImpactPct
  );
  if (poolBlock) return poolBlock.replace(/\s+/g, " ").trim();
  return "tidak lolos filter auto-exec";
}

export function formatAutoSignalSkipLine(input: {
  maxSpreadBps: number;
  minSpreadPct: number;
  minSpreadBps?: number;
  reason: string;
  pair?: string;
  dexIn?: string;
  dexOut?: string;
  chainId?: string;
  sandbox?: boolean;
  at?: Date;
}): string {
  const clock = formatScanTimestamp(input.at);
  const network = networkScanTag(input.chainId, input.sandbox);
  const gateBps =
    input.minSpreadBps !== undefined ? input.minSpreadBps : pctToBps(input.minSpreadPct);
  const max = formatBps(input.maxSpreadBps);
  const gate = formatPct(input.minSpreadPct);
  const route = formatFlashRouteLabel({
    pair: input.pair,
    dexIn: input.dexIn,
    dexOut: input.dexOut,
  });
  const routeBit = isPlaceholderScanRoute(route) ? "" : ` · ${route}`;
  const detail = (input.reason || "alasan tidak diketahui").replace(/\s+/g, " ").trim();
  return `[${clock}] [${network}] [AUTO] Sinyal tercapai ${max} ≥ min ${gate} (${(gateBps / 100).toFixed(2)}%)${routeBit} — tidak eksekusi: ${detail}`;
}

export function readyOpportunityCount(opportunities: Opportunity[]): number {
  return opportunities.filter((item) => item.status === "ready").length;
}

type SpreadWaitGlobal = typeof globalThis & {
  __mevAutoSpreadWait?: Record<string, { peak: number; at: number }>;
};

function spreadWaitStore(): Record<string, { peak: number; at: number }> {
  const g = globalThis as SpreadWaitGlobal;
  if (!g.__mevAutoSpreadWait) g.__mevAutoSpreadWait = {};
  return g.__mevAutoSpreadWait;
}

export function noteAutoSpreadWaitPeak(spreadBps: number, channel = "mainnet"): void {
  const store = spreadWaitStore();
  const value = Number.isFinite(spreadBps) ? spreadBps : 0;
  const row = store[channel] ?? { peak: 0, at: 0 };
  row.peak = Math.max(row.peak, value);
  store[channel] = row;
}

export function takeAutoSpreadWaitPeakIfDue(
  intervalMs: number = AUTO_EXECUTE.spreadWaitLogMs,
  now = Date.now(),
  channel = "mainnet"
): number | null {
  const store = spreadWaitStore();
  const row = store[channel] ?? { peak: 0, at: 0 };
  if (now - row.at < intervalMs) {
    store[channel] = row;
    return null;
  }
  const peak = row.peak;
  store[channel] = { peak: 0, at: now };
  return peak;
}

export interface ScanPairHighlight {
  pair: string;
  dexIn: string;
  dexOut: string;
  spreadBps: number;
  quoteSymbol?: string;
  baseSymbol?: string;
  poolLiquidityUsd?: number;
  buyLiquidityUsd?: number;
  sellLiquidityUsd?: number;
}

export function featuredScanRoute(opportunities: Opportunity[]): ScanPairHighlight | null {
  const ranked = [...opportunities].sort((a, b) => (b.spreadBps || 0) - (a.spreadBps || 0));
  const best = ranked[0];
  if (!best) return null;
  return toScanHighlight(best);
}

function toScanHighlight(item: Opportunity): ScanPairHighlight {
  return {
    pair: item.tokenPair || "—",
    dexIn: item.dexAName || item.buyExchange || dexLabel(item.buyDex),
    dexOut: item.dexBName || item.sellExchange || dexLabel(item.sellDex),
    spreadBps: item.spreadBps || 0,
    quoteSymbol: item.tokenIn,
    baseSymbol: item.tokenOut,
    poolLiquidityUsd: item.poolLiquidityUsd,
    buyLiquidityUsd: item.buyLiquidityUsd,
    sellLiquidityUsd: item.sellLiquidityUsd,
  };
}

/** Semua rute terurut spread tertinggi dulu — log scan memfilter ≥ min spread. */
export function scanPairHighlights(opportunities: Opportunity[]): ScanPairHighlight[] {
  return [...opportunities]
    .sort((a, b) => {
      const spread = (b.spreadBps || 0) - (a.spreadBps || 0);
      if (spread !== 0) return spread;
      const ready = Number(b.status === "ready") - Number(a.status === "ready");
      if (ready !== 0) return ready;
      const directed = compareDirectedOpportunities(a, b);
      if (directed !== 0) return directed;
      return a.id.localeCompare(b.id);
    })
    .map(toScanHighlight);
}

function isCompleteHighlight(item: ScanPairHighlight): boolean {
  const pair = (item.pair || "").trim();
  const dexIn = (item.dexIn || "").trim();
  const dexOut = (item.dexOut || "").trim();
  return Boolean(pair && pair !== "—" && dexIn && dexIn !== "—" && dexOut && dexOut !== "—");
}

function completeHighlights(highlights: ScanPairHighlight[]): ScanPairHighlight[] {
  return highlights.filter(isCompleteHighlight);
}

/**
 * Log scan: semua rute ≥ Minimum Spread dan ≥ Min Pool Liquidity.
 * Jika belum ada yang lolos, tampilkan satu rute terbaik yang masih lolos filter liq.
 */
export function selectScanLogHighlights(
  highlights: ScanPairHighlight[],
  minSpreadBps: number,
  minPoolLiquidityUsd = 0
): ScanPairHighlight[] {
  const valid = completeHighlights(highlights).filter((item) =>
    meetsMinPoolLiquidityUsd(item.poolLiquidityUsd, minPoolLiquidityUsd)
  );
  if (valid.length === 0) return [];
  const above = valid.filter((item) => spreadMeetsMinimum(item.spreadBps, minSpreadBps));
  if (above.length > 0) {
    return [...above]
      .sort((a, b) => (b.spreadBps || 0) - (a.spreadBps || 0))
      .slice(0, AUTO_EXECUTE.maxQueueSize);
  }
  return [
    valid.reduce((best, item) => ((item.spreadBps || 0) > (best.spreadBps || 0) ? item : best)),
  ];
}

function formatHighlightRouteBit(item: ScanPairHighlight, index: number, total: number): string {
  const prefix = total > 1 ? `#${index} ` : "";
  const liqBit = ` · liq min ${formatPoolLiquidityLabel(item.poolLiquidityUsd)} (beli ${formatPoolLiquidityLabel(item.buyLiquidityUsd)} / jual ${formatPoolLiquidityLabel(item.sellLiquidityUsd)})`;
  return `${prefix}${item.pair} ${formatDexArrow(item.dexIn, item.dexOut)} spread: ${formatSpreadPct(item.spreadBps)}${liqBit}`;
}

/**
 * `[21.06.34] [Polygon mainnet] … · POL (Gas): estimasi · Wallet POL (gas): saldo EOA · Vault POL: kontrak · 0 ready`
 * Catatan: `0 ready` = spread/profit belum lolos — bukan karena Vault native = 0.
 * Gas EVM selalu dari Wallet (signer); Vault native kosong normal untuk flashloan.
 */
export function formatRuntimeScanLine(input: {
  sandbox?: boolean;
  chainId?: string;
  block: number | string;
  routes: number;
  ready: number;
  maxSpreadBps: number;
  gasPriceWei?: string;
  /** gasLimit config; Arbitrum di-cap 250k untuk estimasi pra-eksekusi. */
  gasLimit?: number;
  pair?: string;
  dexIn?: string;
  dexOut?: string;
  provider?: string;
  nativeSymbol?: string;
  /** Saldo native di dompet signer (bukan biaya gas). */
  nativeBalance?: string;
  tokenSymbol?: string;
  tokenBalance?: string;
  vaultEth?: string;
  vaultUsdc?: string;
  vaultUsdt?: string;
  pairHighlights?: ScanPairHighlight[];
  scannedPairLabels?: string[];
  minSpreadBps?: number;
  minPoolLiquidityUsd?: number;
  /** Alasan top kandidat spot≥min tetapi belum Ready (Solana). */
  notReadyDetail?: string;
  at?: Date;
}): string {
  const clock = formatScanTimestamp(input.at);
  const tag = networkScanTag(input.chainId, input.sandbox);
  const fallback: ScanPairHighlight[] = [
    {
      pair: (input.pair || "").trim(),
      dexIn: (input.dexIn || "").trim(),
      dexOut: (input.dexOut || "").trim(),
      spreadBps: input.maxSpreadBps,
    },
  ];
  const selected = selectScanLogHighlights(
    input.pairHighlights && input.pairHighlights.length > 0 ? input.pairHighlights : fallback,
    input.minSpreadBps ?? 0,
    input.minPoolLiquidityUsd ?? 0
  );
  const routeBit =
    selected.length > 0
      ? selected.map((item, index) => formatHighlightRouteBit(item, index + 1, selected.length)).join(" · ")
      : "menunggu rute";
  const parsedBlock = parseBlockNumber(input.block);
  const block = parsedBlock > 0 ? String(parsedBlock) : "—";
  const sym = input.nativeSymbol || "ETH";
  const gasLabel =
    sym === "BNB"
      ? "BNB (Gas)"
      : sym === "POL"
        ? "POL (Gas)"
        : sym === "MON"
          ? "MON (Gas)"
          : sym === "SOL"
            ? "SOL (Fee)"
            : "ETH (Gas)";
  // Gas EVM dibayar EOA signer — label eksplisit agar tidak tertukar dengan Vault (kontrak executor).
  const walletLabel =
    sym === "BNB"
      ? "Wallet BNB (gas)"
      : sym === "POL"
        ? "Wallet POL (gas)"
        : sym === "MON"
          ? "Wallet MON (gas)"
          : sym === "SOL"
            ? "Wallet SOL"
            : "Wallet ETH (gas)";
  const vaultNativeLabel =
    sym === "POL"
      ? "Vault POL"
      : sym === "BNB"
        ? "Vault BNB"
        : sym === "MON"
          ? "Vault MON"
          : sym === "SOL"
            ? "Vault SOL"
            : "Vault ETH";

  // ETH/POL (Gas) = estimasi biaya tx (gasLimit × gasPrice), BUKAN saldo.
  // Arbitrum: plafon pra-eksekusi 250k unit (bukan 650k config default).
  const estimatedGas =
    sym === "SOL"
      ? input.nativeBalance != null && input.nativeBalance !== ""
        ? input.nativeBalance
        : "—"
      : formatEstimatedTxGasFromPrice(
          input.gasPriceWei,
          input.gasLimit ?? 650_000,
          input.chainId
        );
  const gasBit = ` · ${gasLabel}: ${estimatedGas}`;
  const walletBit =
    sym === "SOL"
      ? ""
      : ` · ${walletLabel}: ${input.nativeBalance != null && input.nativeBalance !== "" ? input.nativeBalance : "—"}`;
  // Vault native=0 normal (flashloan); gas tidak dipotong dari sini.
  const vaultEthBit = ` · ${vaultNativeLabel}: ${input.vaultEth ?? "—"}`;
  const vaultUsdcBit = ` · Vault USDC: ${input.vaultUsdc ?? "—"}`;
  const vaultUsdtBit = ` · Vault USDT: ${input.vaultUsdt ?? "—"}`;
  const readyBit = input.ready > 0 ? "Ready" : "0 ready";
  const heightLabel = input.chainId === "solana" || sym === "SOL" ? "Slot" : "Block";
  const feeBit =
    input.provider && /kamino/i.test(input.provider) ? ` · ${input.provider}` : "";
  const skipBit =
    input.ready <= 0 && input.notReadyDetail
      ? ` · NOT-READY: ${input.notReadyDetail.replace(/\s+/g, " ").trim()}`
      : "";
  return `[${clock}] [${tag}] ${routeBit} · ${heightLabel} #${block}${gasBit}${walletBit}${vaultEthBit}${vaultUsdcBit}${vaultUsdtBit}${feeBit} · ${readyBit}${skipBit}`;
}

const MONAD_SCAN_PAIRS = [
  { id: "wmon-usdc", label: "WMON/USDC" },
  { id: "weth-usdc-monad", label: "WETH/USDC" },
] as const;

function formatQuoteAmount(wei: string, decimals: number): string {
  try {
    const value = BigInt(wei || "0");
    const scale = 10n ** BigInt(Math.max(0, decimals));
    const whole = value / scale;
    const frac = (value % scale).toString().padStart(Math.max(0, decimals), "0").slice(0, 4).padEnd(4, "0");
    const sign = value < 0n ? "-" : "";
    return `${sign}${whole}.${frac}`;
  } catch {
    return "0.0000";
  }
}

/** Satu baris per siklus scan Monad: blok, spread DEX, gas quote, dan laba bersih. */
export function formatMonadScanCycle(input: {
  block: number;
  opportunities: Opportunity[];
}): string {
  const block = input.block > 0 ? String(input.block) : "—";
  const bits = MONAD_SCAN_PAIRS.map((pair) => {
    const match = input.opportunities
      .filter((item) => item.pairId === pair.id)
      .sort((a, b) => (b.spreadBps || 0) - (a.spreadBps || 0))[0];
    if (!match) return `${pair.label} spread — · gas — · profit —`;
    const dexIn = match.dexAName || match.buyExchange || "DEX";
    const dexOut = match.dexBName || match.sellExchange || "DEX";
    const decimals = match.quoteDecimals ?? 6;
    const quote = match.tokenIn || "USDC";
    const spread = ((match.spreadBps || 0) / 100).toFixed(4);
    const gas = formatQuoteAmount(match.gasCostWei || "0", decimals);
    const profit = formatQuoteAmount(match.netProfitWei || "0", decimals);
    return `${pair.label} ${dexIn} → ${dexOut} spread ${spread}% · gas ${gas} ${quote} · profit ${profit} ${quote}`;
  });
  return `[MONAD 143] block #${block} · ${bits.join(" · ")}`;
}

export function isUserRejectedExec(message: string): boolean {
  return /ditolak di metamask|user rejected|rejected the request/i.test(message);
}

export function minSpreadBpsFromConfig(config: BotConfig, sandbox = false): number {
  const configuredPct =
    config.chainId === "solana"
      ? solanaEffectiveMinSpreadPct(config.minSpreadPct)
      : config.minSpreadPct;
  if (sandbox) return pctToBps(configuredPct);
  const caps = extremeFilterCaps(config);
  return Math.max(pctToBps(configuredPct), caps.minSpreadBps);
}

export function spreadMeetsMinimum(spreadBps: number, minSpreadBps: number): boolean {
  return Number.isFinite(spreadBps) && Number.isFinite(minSpreadBps) && minSpreadBps >= 0 && spreadBps + 1e-9 >= minSpreadBps;
}

export function opportunityUsdValue(
  wei: string | bigint | undefined,
  opp: Pick<Opportunity, "quoteDecimals" | "quoteUsd">
): number {
  return tokenWeiToUsd(wei || "0", opp.quoteDecimals ?? 18, opp.quoteUsd ?? 1);
}

export function maxOpportunitySpreadBps(opportunities: Opportunity[]): number {
  return opportunities.reduce((max, item) => Math.max(max, item.spreadBps || 0), 0);
}

/** Ambang zona pelan: min spread konfigurasi dikurangi 0.1 poin persen (0.50% → 0.40%). */
export function scanIdleThresholdPct(minSpreadPct: number): number {
  const minPct = Number.isFinite(minSpreadPct) && minSpreadPct > 0 ? minSpreadPct : 0.5;
  return Math.max(0, minPct - SCAN_IDLE_SPREAD_GAP_PCT);
}

/**
 * Cooldown eksekusi dinamis:
 * - max spread ≥ (minSpread − 0.1%) → hotCooldownMs (3s)
 * - di bawah itu → cooldownMs (18s)
 */
export function resolveAutoExecuteCooldownMs(
  minSpreadPct: number,
  maxSpreadBps: number
): number {
  const minPct = configuredMinSpreadPct(minSpreadPct);
  const approachFloorPct = scanIdleThresholdPct(minPct);
  const maxPct = maxSpreadPctFromBps(maxSpreadBps);
  if (maxPct + 1e-12 >= approachFloorPct) {
    return AUTO_EXECUTE.hotCooldownMs;
  }
  return AUTO_EXECUTE.cooldownMs;
}

function maxSpreadPctFromBps(maxSpreadBps: number): number {
  return (Number.isFinite(maxSpreadBps) ? maxSpreadBps : 0) / 100;
}

function configuredMinSpreadPct(minSpreadPct: number): number {
  return Number.isFinite(minSpreadPct) && minSpreadPct > 0 ? minSpreadPct : 0.5;
}

/** Belum di atas min spread setting → interval pelan 1000 ms. */
export function isScanIdlePace(minSpreadPct: number, maxSpreadBps: number): boolean {
  return maxSpreadPctFromBps(maxSpreadBps) <= configuredMinSpreadPct(minSpreadPct) + 1e-12;
}

/**
 * Max spread < (minSpread − 0.1%) atau belum > setting → idle.
 * Max spread > minSpread setting → hot.
 * Solana: idle 500ms / hot 250–450ms (bukan cooldown eksekusi 18s).
 */
export function resolveAdaptiveScanIntervalMs(
  minSpreadPct: number,
  maxSpreadBps: number,
  chainId?: string | null
): number {
  const solana = chainId === "solana";
  if (isScanIdlePace(minSpreadPct, maxSpreadBps)) {
    return solana ? SOLANA_SCAN_IDLE_INTERVAL_MS : SCAN_IDLE_INTERVAL_MS;
  }
  if (solana) {
    const span = SOLANA_SCAN_HOT_INTERVAL_MAX_MS - SOLANA_SCAN_HOT_INTERVAL_MIN_MS;
    return SOLANA_SCAN_HOT_INTERVAL_MIN_MS + Math.floor(Math.random() * (span + 1));
  }
  const span = SCAN_HOT_INTERVAL_MAX_MS - SCAN_HOT_INTERVAL_MIN_MS;
  return SCAN_HOT_INTERVAL_MIN_MS + Math.floor(Math.random() * (span + 1));
}

export function formatAdaptiveScanPaceLine(input: {
  minSpreadPct: number;
  maxSpreadBps: number;
  intervalMs: number;
  chainId?: string | null;
}): string {
  const minPct = configuredMinSpreadPct(input.minSpreadPct);
  const thresholdPct = scanIdleThresholdPct(minPct);
  const maxSpreadPct = maxSpreadPctFromBps(input.maxSpreadBps);
  const solana = input.chainId === "solana";
  const idleFloor = solana ? SOLANA_SCAN_IDLE_INTERVAL_MS : SCAN_IDLE_INTERVAL_MS;
  const idle = input.intervalMs >= idleFloor;
  const pace = `${input.intervalMs} ms`;
  if (idle) {
    return `[SCAN] Interval ${pace} · max spread ${maxSpreadPct.toFixed(2)}% < ambang ${thresholdPct.toFixed(2)}% (min ${minPct.toFixed(2)}% − 0.10%)${solana ? " · Solana" : ""}`;
  }
  return `[SCAN] Interval ${pace} · max spread ${maxSpreadPct.toFixed(2)}% > setting ${minPct.toFixed(2)}%${solana ? " · Solana" : ""}`;
}

export function opportunityMeetsNetProfitFloor(
  opp: Opportunity,
  config: BotConfig,
  sandbox = false
): boolean {
  if (sandbox) return true;
  const netUsd = opportunityUsdValue(opp.netProfitWei || "0", opp);
  const loanAmountUsd = opportunityUsdValue(opp.amountInWei, opp);
  if (!(loanAmountUsd > 0)) return false;
  const bribePct = Number(config.dynamicBribePercent ?? config.minerTipPct);
  const bribeUsd = Number(opp.bribeUsd);
  const { minProfitUsd } = resolveAdaptiveMinProfitUsd({
    configMinProfitUsd: config.minProfitUsd,
    gasCostUsd: opportunityUsdValue(opp.gasCostWei || "0", opp),
    bribeUsd: Number.isFinite(bribeUsd) ? bribeUsd : 0,
    bribePct: Number.isFinite(bribePct) ? bribePct : 0,
    spreadBps: opp.spreadBps,
    minSpreadBps: minSpreadBpsFromConfig(config),
    extreme: config.gasStrategyMode === "extreme",
    loanAmountUsd,
  });
  return netUsd + 1e-9 >= minProfitUsd;
}

export function formatQueueRouteLabel(opp: Opportunity): string {
  return `${opp.tokenPair || "—"} ${formatDexArrow(
    opp.dexAName || opp.buyExchange || dexLabel(opp.buyDex),
    opp.dexBName || opp.sellExchange || dexLabel(opp.sellDex)
  )} ${formatSpreadPct(opp.spreadBps || 0)}`;
}

const lastQueueFilterLogAt = new Map<string, number>();

function logSpreadFilteredRoute(opp: Opportunity, config: BotConfig): void {
  if (typeof window !== "undefined") return;
  const pair = opp.tokenPair || opp.id || "—";
  const buy = opp.dexAName || opp.buyExchange || opp.buyDex || "DEX";
  const sell = opp.dexBName || opp.sellExchange || opp.sellDex || "DEX";
  const gate = formatPct(config.minSpreadPct);
  const message = `[QUEUE_FILTER] Rute ${pair} ${buy} → ${sell} dikeluarkan dari antrean (Spread di bawah ${gate} config).`;
  const key = `${opp.chainId || ""}:${opp.id}:${gate}`;
  const now = Date.now();
  if (now - (lastQueueFilterLogAt.get(key) ?? 0) < AUTO_EXECUTE.signalSkipLogMs) return;
  lastQueueFilterLogAt.set(key, now);
  console.log(message);
  appendServerLog({
    level: "info",
    source: "QUEUE_FILTER",
    chainId: opp.chainId,
    message,
  });
}

/** Semua rute dengan spread ≥ min, urut tertinggi → terendah (bukan hanya Top-1). */
export function rankAutoExecuteQueue(
  opportunities: Opportunity[],
  config: BotConfig,
  opts?: { sandbox?: boolean }
): Opportunity[] {
  const sandbox = Boolean(opts?.sandbox);
  const minSpreadBps = minSpreadBpsFromConfig(config, sandbox);
  const solana = config.chainId === "solana";
  if (!sandbox) publishQueuedScanRoutes(opportunities);
  return [...opportunities]
    .filter((opp) => {
      if (!spreadMeetsMinimum(opp.spreadBps, minSpreadBps)) {
        logSpreadFilteredRoute(opp, config);
        return false;
      }
      // Solana: hanya antrikan yang status ready (deep net sudah lolos lantai).
      if (solana && opp.status !== "ready") return false;
      return true;
    })
    .sort((a, b) => {
      const spread = (b.spreadBps || 0) - (a.spreadBps || 0);
      if (spread !== 0) return spread;
      const net =
        opportunityUsdValue(b.netProfitWei || "0", b) - opportunityUsdValue(a.netProfitWei || "0", a);
      if (net !== 0) return net;
      const ready = Number(b.status === "ready") - Number(a.status === "ready");
      if (ready !== 0) return ready;
      return compareDirectedOpportunities(a, b);
    })
    .slice(0, AUTO_EXECUTE.maxQueueSize);
}

/** Geser antrian supaya rute setelah `lastId` jadi yang pertama (bergantian). */
export function rotateQueueAfterId<T extends { id: string }>(
  queue: T[],
  lastId?: string | null
): T[] {
  if (!lastId || queue.length <= 1) return queue;
  const idx = queue.findIndex((item) => item.id === lastId);
  if (idx < 0) return queue;
  return [...queue.slice(idx + 1), ...queue.slice(0, idx + 1)];
}

/** Utamakan urutan id dari klien, lalu sisa antrian hasil ranking server. */
export function orderAutoExecuteQueue(
  opportunities: Opportunity[],
  config: BotConfig,
  opts?: { sandbox?: boolean; preferredIds?: string[]; exclusive?: boolean; lastRotateOppId?: string }
): Opportunity[] {
  const ranked = rankAutoExecuteQueue(opportunities, config, opts);
  const byId = new Map(ranked.map((item) => [item.id, item]));
  const preferred: Opportunity[] = [];
  for (const id of opts?.preferredIds ?? []) {
    const item = byId.get(id);
    if (item && !preferred.some((row) => row.id === item.id)) preferred.push(item);
  }
  if (opts?.exclusive && preferred.length > 0) return preferred;
  const seen = new Set(preferred.map((item) => item.id));
  const combined = [...preferred, ...ranked.filter((item) => !seen.has(item.id))];
  return rotateQueueAfterId(combined, opts?.lastRotateOppId);
}

export function formatAutoExecuteQueueLine(
  queue: Opportunity[],
  config: BotConfig,
  opts?: { sandbox?: boolean; at?: Date; chainId?: string }
): string {
  const clock = formatScanTimestamp(opts?.at);
  const network = networkScanTag(opts?.chainId ?? config.chainId, opts?.sandbox);
  const gate = formatPct(config.minSpreadPct);
  if (queue.length === 0) {
    return `[${clock}] [${network}] [QUEUE] 0 kandidat lolos min spread ${gate}.`;
  }
  const ranks = queue
    .map((opp, index) => `#${index + 1} ${formatQueueRouteLabel(opp)}`)
    .join(" · ");
  return `[${clock}] [${network}] [QUEUE] ${queue.length} kandidat lolos min ${gate} (bergantian): ${ranks}`;
}

/** Pilih rute berikutnya dari antrian (≥ min), berputar setelah rute terakhir. */
export function pickAutoExecuteCandidate(
  opportunities: Opportunity[],
  config: BotConfig,
  opts?: { sandbox?: boolean; lastRotateOppId?: string }
): Opportunity | null {
  return orderAutoExecuteQueue(opportunities, config, opts)[0] ?? null;
}
