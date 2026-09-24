import { formatBnbAmount, formatStableWeiAsBnb, formatUsdAsBnb, MOCK_BNB_USD } from "@/lib/bot/bnbQuote";
import { aaveFeePctForTier, DEFAULT_BOT_CONFIG } from "@/lib/bot/constants";
import { formatPct, formatUsd, stableWeiToUsd, usdToStableWei } from "@/lib/bot/configUnits";
import type { BotConfig, Opportunity, TradeRecord, TradeTraceSnapshot } from "@/lib/bot/types";

export interface TradeTraceContext {
  lastBlock: number;
  gasPriceWei: string;
  gasLimit: number;
  aaveFeePct: number;
  loanAmountUsd: number;
  isSandbox?: boolean;
  isPro?: boolean;
}

export interface ResolvedTradeTrace {
  status: "Success";
  txHash: string;
  pair: string;
  route: string;
  executedAt: string;
  blockNumber: number;
  gasUsed: number;
  gasUsedLabel: string;
  durationMs: number;
  durationLabel: string;
  providerLabel: string;
  loanToken: string;
  loanAmountLabel: string;
  loanAmountBnb: string;
  buyDex: string;
  sellDex: string;
  buyToken: string;
  sellToken: string;
  buyDetail: string;
  sellDetail: string;
  protocolFeePctLabel: string;
  protocolFeeLabel: string;
  protocolFeeBnb: string;
  repayLabel: string;
  gasBnbLabel: string;
  gasPriceGweiLabel: string;
  netProfitBnb: string;
  netProfitUsd: string;
  nativeSymbol: string;
  loanQtyLabel: string;
  loanUsdLabel: string;
  buyQtyLabel: string;
  buyUsdLabel: string;
  sellQtyLabel: string;
  sellUsdLabel: string;
  repayQtyLabel: string;
  repayUsdLabel: string;
  confirmations: number;
  timestampRelative: string;
  timestampUtc: string;
  gasFeeNative: string;
  gasFeeUsdLabel: string;
  gasPriceGwei: number;
  gasPriceNativeLabel: string;
  valueNativeLabel: string;
  valueUsdLabel: string;
}

function mix32(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function splitRoute(route: string): { buy: string; sell: string } {
  const parts = route.split(/\s*→\s*|\s*->\s*/).map((s) => s.trim()).filter(Boolean);
  return { buy: parts[0] || "DEX beli", sell: parts[1] || "DEX jual" };
}

function splitPair(pair: string): { quote: string; base: string } {
  const parts = pair.split(/[/\-_]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { base: parts[0], quote: parts[1] };
  return { base: pair || "WBNB", quote: "USDT" };
}

function parseWei(value: string | undefined, fallback = "0"): string {
  try {
    return BigInt(value || fallback).toString();
  } catch {
    return fallback;
  }
}

function formatUsdGrouped(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatQty(value: number): string {
  const n = Number.isFinite(value) ? Math.abs(value) : 0;
  const digits = n >= 1000 ? 2 : n >= 1 ? 4 : 6;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function isStableSymbol(symbol: string): boolean {
  return /^(USDT|USDC|BUSD|DAI|USD)$/i.test(symbol.trim());
}

function relativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return `${sec} secs ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function formatUtcStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hh = d.getUTCHours();
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${months[d.getUTCMonth()]}-${pad(d.getUTCDate())}-${d.getUTCFullYear()} ${h12}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${ampm} +UTC`;
}

function parseGasPrice(value: string | undefined): bigint {
  try {
    const n = BigInt(value || "0");
    return n > 0n ? n : 10n ** 9n;
  } catch {
    return 10n ** 9n;
  }
}

export function buildTradeTraceSnapshot(input: {
  opportunity?: Opportunity;
  pair?: string;
  route?: string;
  txHash?: string;
  config?: Partial<BotConfig>;
  blockNumber: number;
  gasPriceWei?: string;
  isSandbox?: boolean;
  isPro?: boolean;
}): TradeTraceSnapshot {
  const opp = input.opportunity;
  const config = { ...DEFAULT_BOT_CONFIG, ...input.config };
  const pair = opp?.tokenPair || input.pair || "—";
  const route = opp ? `${opp.buyExchange} → ${opp.sellExchange}` : input.route || "—";
  const tokens = splitPair(pair);
  const dex = splitRoute(route);
  const seed = input.txHash || `${pair}:${route}:${input.blockNumber}`;
  const aaveFeePct =
    typeof config.aaveFeePct === "number" ? config.aaveFeePct : aaveFeePctForTier(Boolean(input.isPro));
  const loanUsd = Math.max(1, config.loanAmountUsd || DEFAULT_BOT_CONFIG.loanAmountUsd);
  const loanAmountWei = parseWei(opp?.amountInWei, usdToStableWei(loanUsd));
  const loanUsdActual = stableWeiToUsd(loanAmountWei);
  const protocolFeeUsd = loanUsdActual * (aaveFeePct / 100);
  const protocolFeeWei = usdToStableWei(protocolFeeUsd);
  const repayWei = parseWei(opp?.repayWei, (BigInt(loanAmountWei) + BigInt(protocolFeeWei)).toString());
  const gasLimit = Math.max(1, config.gasLimit || DEFAULT_BOT_CONFIG.gasLimit);
  const gasUsed = Math.min(gasLimit, 318_000 + (mix32(`${seed}:gas`) % 168_000));
  const gasPriceWei = parseGasPrice(input.gasPriceWei).toString();
  const durationMs = 960 + (mix32(`${seed}:ms`) % 1_540);

  return {
    blockNumber: input.blockNumber || 42_000_000 + (mix32(seed) % 9_000),
    gasUsed,
    gasPriceWei,
    durationMs,
    loanToken: opp?.tokenIn || tokens.quote,
    loanAmountWei,
    providerLabel: input.isSandbox ? "Aave V3 Pool (Testnet)" : "Aave V3 Pool",
    buyDex: opp?.buyExchange || dex.buy,
    sellDex: opp?.sellExchange || dex.sell,
    buyToken: opp?.tokenOut || tokens.base,
    sellToken: opp?.tokenIn || tokens.quote,
    amountOutWei: parseWei(opp?.amountOutWei, "0"),
    repayWei,
    protocolFeePct: aaveFeePct,
    protocolFeeWei,
    gasCostWei: parseWei(opp?.gasCostWei, "0"),
    priceBuyUsd: opp?.priceDexAUsd,
    priceSellUsd: opp?.priceDexBUsd,
  };
}

export function resolveTradeTrace(trade: TradeRecord, ctx: TradeTraceContext): ResolvedTradeTrace {
  const snapshot =
    trade.trace ??
    buildTradeTraceSnapshot({
      pair: trade.pair,
      route: trade.route,
      txHash: trade.txHash,
      blockNumber: ctx.lastBlock,
      gasPriceWei: ctx.gasPriceWei,
      isSandbox: ctx.isSandbox,
      isPro: ctx.isPro,
      config: {
        aaveFeePct: ctx.aaveFeePct,
        loanAmountUsd: ctx.loanAmountUsd,
        gasLimit: ctx.gasLimit,
      },
    });

  const gasPriceWei = parseGasPrice(snapshot.gasPriceWei || ctx.gasPriceWei);
  const gasUsed = snapshot.gasUsed || Math.max(1, Math.floor(ctx.gasLimit * 0.62));
  const nativeGasWei = gasPriceWei * BigInt(gasUsed);
  const gasBnb = Number(nativeGasWei) / 1e18;
  const gwei = Number(gasPriceWei) / 1e9;
  const loanUsd = stableWeiToUsd(snapshot.loanAmountWei);
  const feeUsd = stableWeiToUsd(snapshot.protocolFeeWei);
  const repayUsd = stableWeiToUsd(snapshot.repayWei);
  const netUsd = stableWeiToUsd(trade.netProfitWei);
  const amountOutUsd = stableWeiToUsd(snapshot.amountOutWei);
  const buyPrice =
    snapshot.priceBuyUsd && Number.isFinite(snapshot.priceBuyUsd)
      ? ` @ ${formatUsd(snapshot.priceBuyUsd)}`
      : "";
  const sellPrice =
    snapshot.priceSellUsd && Number.isFinite(snapshot.priceSellUsd)
      ? ` @ ${formatUsd(snapshot.priceSellUsd)}`
      : "";

  const seconds = snapshot.durationMs / 1000;
  const buyPx = snapshot.priceBuyUsd && snapshot.priceBuyUsd > 0 ? snapshot.priceBuyUsd : MOCK_BNB_USD;
  const sellPx = snapshot.priceSellUsd && snapshot.priceSellUsd > 0 ? snapshot.priceSellUsd : buyPx;
  let buyQty: number;
  try {
    buyQty = Number(BigInt(snapshot.amountOutWei || "0")) / 1e18;
  } catch {
    buyQty = 0;
  }
  let buyUsd = isStableSymbol(snapshot.buyToken) ? buyQty : buyQty * buyPx;
  if (!isStableSymbol(snapshot.buyToken) && buyUsd > loanUsd * 8) {
    buyUsd = buyQty;
    buyQty = buyPx > 0 ? buyUsd / buyPx : buyQty;
  }
  if (!Number.isFinite(buyQty) || buyQty <= 0) {
    buyQty = isStableSymbol(snapshot.buyToken) ? loanUsd : loanUsd / buyPx;
    buyUsd = isStableSymbol(snapshot.buyToken) ? buyQty : buyQty * buyPx;
  }
  if (!Number.isFinite(buyUsd) || buyUsd <= 0) {
    buyUsd = loanUsd;
  }
  const sellUsd = Math.max(loanUsd, repayUsd + netUsd, buyUsd * (sellPx / buyPx));
  const sellQty = isStableSymbol(snapshot.sellToken) ? sellUsd : sellUsd / sellPx;
  const repayQty = isStableSymbol(snapshot.loanToken) ? repayUsd : repayUsd / buyPx;
  const blockNumber = snapshot.blockNumber || ctx.lastBlock;
  const ageMs = Date.now() - new Date(trade.at).getTime();
  const ageBlocks = Number.isFinite(ageMs) && ageMs > 0 ? Math.floor(ageMs / 3_000) : 1;
  const confirmations = Math.max(1, (ctx.lastBlock || blockNumber) - blockNumber + 1, ageBlocks);
  const gasFeeUsd = (Number.isFinite(gasBnb) ? gasBnb : 0) * MOCK_BNB_USD;
  const gasNativePerUnit = gwei / 1e9;
  const nativeSymbol = "BNB";

  return {
    status: "Success",
    txHash: trade.txHash || "—",
    pair: trade.pair,
    route: trade.route,
    executedAt: trade.at,
    blockNumber,
    gasUsed,
    gasUsedLabel: gasUsed.toLocaleString("en-US"),
    durationMs: snapshot.durationMs,
    durationLabel: `${seconds.toFixed(2)} dtk`,
    providerLabel: snapshot.providerLabel.includes("Aave") ? "Aave Protocol V3" : snapshot.providerLabel,
    loanToken: snapshot.loanToken,
    loanAmountLabel: `${formatUsd(loanUsd)} ${snapshot.loanToken}`,
    loanAmountBnb: formatUsdAsBnb(loanUsd, 6),
    buyDex: snapshot.buyDex,
    sellDex: snapshot.sellDex,
    buyToken: snapshot.buyToken,
    sellToken: snapshot.sellToken,
    buyDetail: `Beli ${snapshot.buyToken}${buyPrice}${amountOutUsd > 0 ? ` · notional ${formatUsd(amountOutUsd)}` : ""}`,
    sellDetail: `Jual ${snapshot.buyToken} → ${snapshot.sellToken}${sellPrice}`,
    protocolFeePctLabel: formatPct(snapshot.protocolFeePct),
    protocolFeeLabel: `${formatUsd(feeUsd)} ${snapshot.loanToken}`,
    protocolFeeBnb: formatUsdAsBnb(feeUsd, 6),
    repayLabel: `${formatUsd(repayUsd)} ${snapshot.loanToken}`,
    gasBnbLabel: formatBnbAmount(Number.isFinite(gasBnb) ? gasBnb : 0, 8),
    gasPriceGweiLabel: `${gwei.toFixed(4)} gwei`,
    netProfitBnb: formatStableWeiAsBnb(trade.netProfitWei, 6),
    netProfitUsd: `${formatUsd(netUsd)} (≈ ${formatUsdAsBnb(netUsd, 6)} @ $${MOCK_BNB_USD}/BNB)`,
    nativeSymbol,
    loanQtyLabel: formatQty(isStableSymbol(snapshot.loanToken) ? loanUsd : loanUsd / buyPx),
    loanUsdLabel: formatUsdGrouped(loanUsd),
    buyQtyLabel: formatQty(buyQty),
    buyUsdLabel: formatUsdGrouped(buyUsd),
    sellQtyLabel: formatQty(sellQty),
    sellUsdLabel: formatUsdGrouped(sellUsd),
    repayQtyLabel: formatQty(repayQty),
    repayUsdLabel: formatUsdGrouped(repayUsd),
    confirmations,
    timestampRelative: relativeTime(trade.at),
    timestampUtc: formatUtcStamp(trade.at),
    gasFeeNative: (Number.isFinite(gasBnb) ? gasBnb : 0).toFixed(10).replace(/0+$/, "").replace(/\.$/, ""),
    gasFeeUsdLabel: formatUsdGrouped(gasFeeUsd),
    gasPriceGwei: gwei,
    gasPriceNativeLabel: `${gasNativePerUnit.toFixed(12).replace(/0+$/, "").replace(/\.$/, "")} ${nativeSymbol}`,
    valueNativeLabel: `0 ${nativeSymbol}`,
    valueUsdLabel: "$0.00",
  };
}
