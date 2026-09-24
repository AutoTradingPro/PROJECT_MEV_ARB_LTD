import { defaultTradingChainId, normalizeTradingChainId } from "@/config/networks";
import { defaultPairForChain, getPair } from "@/lib/chain/tokenPairs";
import type { BotConfig } from "./types";
import { proportionalMinProfitAnchorUsd } from "./adaptiveMinProfit";
import { DEFAULT_GAS_STRATEGY, MIN_POOL_LIQUIDITY_USD } from "./constants";
import { defaultDexIdsForChain, resolveScanDexIds } from "./dexRegistry";
import { resolveDynamicBribePercent } from "./dynamicBribe";
import { activeFlashLoanProviderId, mergeFlashLoanPlatforms, normalizeFlashLoanProviderId } from "./flashLoanProviders";
import { clampMaxPriceImpactPct, clampMaxSpotSpreadPct, clampMinPoolLiquidityUsd } from "./poolSafety";

/** USDT/USDC on BSC menggunakan 18 desimal. USDC Arbitrum memakai 6. */
const STABLE_DECIMALS = 18;

export function pctToBps(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) return 0;
  return Math.round(percent * 100);
}

export function bpsToPct(bps: number): number {
  return bps / 100;
}

function clampDecimals(decimals: number): number {
  if (!Number.isFinite(decimals)) return STABLE_DECIMALS;
  return Math.max(0, Math.min(36, Math.floor(decimals)));
}

/** Nominal USD → wei token quote (desimal on-chain × harga token). */
export function usdToTokenWei(usd: number, decimals = STABLE_DECIMALS, tokenUsd = 1): string {
  if (!Number.isFinite(usd) || usd <= 0) return "0";
  const px = Number.isFinite(tokenUsd) && tokenUsd > 0 ? tokenUsd : 1;
  const tokens = usd / px;
  if (!Number.isFinite(tokens) || tokens <= 0) return "0";
  const dec = clampDecimals(decimals);
  const fracDigits = Math.min(dec, 18);
  const fixed = tokens.toFixed(fracDigits);
  const [whole, frac = ""] = fixed.split(".");
  const wholeSafe = (whole.startsWith("-") ? whole.slice(1) : whole) || "0";
  const fracPadded = (frac + "0".repeat(dec)).slice(0, dec);
  try {
    return (BigInt(wholeSafe) * 10n ** BigInt(dec) + BigInt(fracPadded || "0")).toString();
  } catch {
    return "0";
  }
}

export function tokenWeiToUsd(
  wei: string | bigint,
  decimals = STABLE_DECIMALS,
  tokenUsd = 1
): number {
  try {
    const value = typeof wei === "bigint" ? wei : BigInt(wei || "0");
    const tokens = Number(value) / 10 ** clampDecimals(decimals);
    const px = Number.isFinite(tokenUsd) && tokenUsd > 0 ? tokenUsd : 1;
    const usd = tokens * px;
    return Number.isFinite(usd) ? usd : 0;
  } catch {
    return 0;
  }
}

export function usdToStableWei(usd: number): string {
  return usdToTokenWei(usd, STABLE_DECIMALS, 1);
}

export function stableWeiToUsd(wei: string | bigint): number {
  return tokenWeiToUsd(wei, STABLE_DECIMALS, 1);
}

export interface EngineConfig {
  minProfitWei: string;
  minerTipBps: number;
  minSpreadBps: number;
  gasLimit: number;
  activeDexIds: BotConfig["activeDexIds"];
  aaveFeeBps: number;
}

export function toEngineConfig(config: BotConfig): EngineConfig {
  const bribe = resolveDynamicBribePercent(config);
  const minProfitUsd = proportionalMinProfitAnchorUsd(config.loanAmountUsd);
  return {
    minProfitWei: usdToStableWei(minProfitUsd),
    minerTipBps: pctToBps(bribe),
    minSpreadBps: pctToBps(config.minSpreadPct),
    gasLimit: config.gasLimit,
    activeDexIds: config.activeDexIds,
    aaveFeeBps: pctToBps(config.aaveFeePct),
  };
}

/** Migrasi konfigurasi lama (wei/bps) ke format UI baru */
export function migrateBotConfig(raw: Partial<BotConfig & LegacyBotConfig>): BotConfig {
  const defaults = {
    minerTipPct: 0.5,
    dynamicBribePercent: 0.5,
    minSpreadPct: 0.5,
    maxSpotSpreadPct: 5,
    gasLimit: 650_000,
    activeDexIds: defaultDexIdsForChain(defaultTradingChainId()) as BotConfig["activeDexIds"],
    loanAmountUsd: 10_000,
    flashLoanProvider: defaultTradingChainId() === "bsc" ? ("uniswap" as const) : ("balancer" as const),
    aaveFeePct: 0.09,
    gasStrategyMode: DEFAULT_GAS_STRATEGY.mode,
    slowMaxGasGwei: DEFAULT_GAS_STRATEGY.slowMaxGasGwei,
    extremeMaxGasGwei: DEFAULT_GAS_STRATEGY.extremeMaxGasGwei,
    minPoolLiquidityUsd: MIN_POOL_LIQUIDITY_USD,
    maxPriceImpactPct: 1,
    useBundle: true,
  };

  const legacy = raw as LegacyBotConfig;

  const slowMax = clampGwei(
    raw.slowMaxGasGwei ?? defaults.slowMaxGasGwei,
    0.1,
    80,
    defaults.slowMaxGasGwei
  );
  const extremeMax = Math.max(
    slowMax,
    clampGwei(
      raw.extremeMaxGasGwei ?? defaults.extremeMaxGasGwei,
      0.5,
      200,
      defaults.extremeMaxGasGwei
    )
  );

  const bribe = resolveDynamicBribePercent({
    minerTipPct:
      raw.minerTipPct ??
      (legacy.minerTipBps !== undefined ? bpsToPct(legacy.minerTipBps) : defaults.minerTipPct),
    dynamicBribePercent: raw.dynamicBribePercent,
  });

  const chainId = normalizeTradingChainId(raw.chainId);
  const pairId =
    raw.pairId && getPair(chainId, raw.pairId)
      ? raw.pairId
      : defaultPairForChain(chainId).id;
  const flashLoanPlatforms = mergeFlashLoanPlatforms(raw.flashLoanPlatforms);
  const exclusiveActive = activeFlashLoanProviderId(flashLoanPlatforms);
  // Nominal id untuk fee/estimate; tidak memaksa platform ON saat mode siaga.
  const flashLoanProvider =
    exclusiveActive ??
    normalizeFlashLoanProviderId(raw.flashLoanProvider) ??
    "balancer";
  const loanAmountUsd = raw.loanAmountUsd ?? defaults.loanAmountUsd;

  return {
    minProfitUsd: proportionalMinProfitAnchorUsd(loanAmountUsd),
    minerTipPct: bribe,
    dynamicBribePercent: bribe,
    minSpreadPct: raw.minSpreadPct ?? defaults.minSpreadPct,
    maxSpotSpreadPct: clampMaxSpotSpreadPct(raw.maxSpotSpreadPct ?? defaults.maxSpotSpreadPct),
    gasLimit: raw.gasLimit ?? defaults.gasLimit,
    activeDexIds: resolveScanDexIds(chainId, raw.activeDexIds ?? defaults.activeDexIds),
    loanAmountUsd,
    flashLoanProvider,
    aaveFeePct: raw.aaveFeePct ?? defaults.aaveFeePct,
    flashLoanPlatforms,
    gasStrategyMode: raw.gasStrategyMode === "extreme" ? "extreme" : "slow",
    slowMaxGasGwei: slowMax,
    extremeMaxGasGwei: extremeMax,
    minPoolLiquidityUsd: clampMinPoolLiquidityUsd(raw.minPoolLiquidityUsd ?? defaults.minPoolLiquidityUsd),
    maxPriceImpactPct: clampMaxPriceImpactPct(raw.maxPriceImpactPct ?? defaults.maxPriceImpactPct),
    useBundle: typeof raw.useBundle === "boolean" ? raw.useBundle : defaults.useBundle,
    chainId,
    pairId,
    scanMode: raw.scanMode === "full" ? "full" : "single",
  };
}

function clampGwei(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

interface LegacyBotConfig {
  minProfitWei?: string;
  minerTipBps?: number;
  contractAddress?: string;
  withdrawTo?: string;
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}
