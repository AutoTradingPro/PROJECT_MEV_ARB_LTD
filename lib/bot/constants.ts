import { proportionalMinProfitAnchorUsd } from "./adaptiveMinProfit";
import type { BotConfig } from "./types";
import { defaultFlashLoanPlatforms } from "./flashLoanProviders";
import { defaultDexIdsForChain, FLASH_LOAN_FEE_PCT } from "./dexRegistry";
import { defaultPairForChain } from "@/lib/chain/tokenPairs";
import {
  ARBITRUM_BALANCER_FLASH_ARB,
  BALANCER_V2_VAULT,
  ETHEREUM_BALANCER_FLASH_ARB,
  defaultTradingChainId,
} from "@/config/networks";

export {
  DEX_ROUTES,
  defaultDexIdsForChain,
  dexIdsAllowedOnChain,
  dexIsConcentrated,
  dexLabel,
  dexLabelsForChain,
  dexQuotesOnChain,
  dexRoutesForChain,
  dexUsesV2Router,
  opportunityUsesV2Routers,
  resolveOpportunitySwapRouters,
  resolveScanDexIds,
  scanPlanForChain,
} from "./dexRegistry";

export const FLASH_LOAN_PROVIDER =
  defaultTradingChainId() === "bsc" ? ("uniswap" as const) : ("balancer" as const);

/** Premi flashloan Aave V3 (persen) per mode akun */
export const AAVE_FLASH_FEE_PCT = {
  free: FLASH_LOAN_FEE_PCT.aave,
  pro: FLASH_LOAN_FEE_PCT.aave,
} as const;

export function aaveFeePctForTier(isPro: boolean): number {
  return isPro ? AAVE_FLASH_FEE_PCT.pro : AAVE_FLASH_FEE_PCT.free;
}

/** Interval auto-scan Pro saat pasar panas (spread dekat min konfigurasi). */
export const SCAN_INTERVAL_MS = 150;
export const SCAN_HOT_INTERVAL_MIN_MS = 100;
export const SCAN_HOT_INTERVAL_MAX_MS = 200;
/** Scan pelan (1 detik) jika max spread belum di atas setting. Zona < (minSpreadPct − 0.1). Contoh min 0.65% → pelan jika < 0.55%. */
export const SCAN_IDLE_INTERVAL_MS = 1_000;
export const SCAN_IDLE_SPREAD_GAP_PCT = 0.1;

/**
 * Pace Solana (Jupiter HTTP) — sedikit lebih longgar dari EVM agar tidak overlap
 * dengan siklus quote, tapi jauh di bawah cooldown eksekusi 18s.
 */
export const SOLANA_SCAN_HOT_INTERVAL_MIN_MS = 250;
export const SOLANA_SCAN_HOT_INTERVAL_MAX_MS = 450;
export const SOLANA_SCAN_IDLE_INTERVAL_MS = 500;

/** Pengaman auto-execute Mode Pro — mencegah spam saat gas tinggi / gagal beruntun. */
export const AUTO_EXECUTE = {
  /** Log [AUTO] spread-wait (Mainnet & Testnet) setiap interval ini. */
  spreadWaitLogMs: 30_000,
  /** Log alasan skip saat sinyal spread sudah tercapai. */
  signalSkipLogMs: 3_000,
  /** Jeda notifikasi Telegram skip/gagal per rute agar chat tidak kebanjiran. */
  skipTelegramMs: 30_000,
  /** Jeda minimum antar transaksi otomatis (eksekusi) — BUKAN interval scan. */
  cooldownMs: 18_000,
  /**
   * Cooldown pendek saat max spread ≥ (minSpread − 0.1%).
   * Contoh min 0.80% → aktif sejak 0.70% agar pantau tick lebih agresif.
   */
  hotCooldownMs: 3_000,
  /** Jeda ulang untuk rute (pair + DEX) yang sama. */
  routeCooldownMs: 45_000,
  /** Mundur setelah gagal (RPC / kontrak) — pendek agar pecah telur tidak terkunci lama. */
  failBackoffMs: 8_000,
  /** Mundur jika user menolak di MetaMask. */
  rejectPauseMs: 25_000,
  maxConsecutiveFails: 3,
  haltAfterFailsMs: 45_000,
  /** 0 = tanpa plafon gwei; gas mengikuti harga live jaringan. */
  maxGasGwei: 0,
  /** 0 = tanpa plafon USD; filter profit loan×0.60% / costFloor yang menahan. */
  maxGasCostUsd: 0,
  /** Testnet Pro: jeda antar eksekusi simulasi (scan tetap SCAN_INTERVAL_MS). */
  sandboxCooldownMs: 6_000,
  sandboxRouteCooldownMs: 12_000,
  /** Batas selisih blok (hanya jika spread tipis / kalkulasi rugi). */
  maxAllowedBlockLag: 1,
  /** Spread di atas minSpread + ini (persen) → data basi diabaikan jika masih profit. */
  staleSpreadCushionPct: 0.1,
  /** Saldo native minimum agar auto-exec tidak dikirim tanpa gas. */
  minNativeGasEth: 0.0001,
  /** Buffer gasLimit di atas hasil eth_estimateGas (mempool Arbitrum / L2). */
  gasLimitBufferPct: 25,
  /** Kegagalan pre-flight "selector kosong" beruntun sebelum rute di-blacklist. */
  emptyRevertStreakToBan: 2,
  /** Lama blacklist rute (blok) setelah selector-kosong beruntun. */
  emptyRevertBanBlocks: 12,
  /** Maksimum kandidat fallback per tick (spread ≥ min, urut tertinggi dulu). */
  maxQueueSize: 8,
} as const;

export const MAX_ALLOWED_BLOCK_LAG = AUTO_EXECUTE.maxAllowedBlockLag;

export const DEFAULT_GAS_STRATEGY = {
  mode: "slow" as const,
  slowMaxGasGwei: 3,
  extremeMaxGasGwei: 15,
  extremeArmMs: 90_000,
  extremeProfitMultiplier: 1.5,
  extremeSpreadMultiplier: 1.25,
  extremeMaxGasCostUsd: 8,
  extremeBumpPct: 20,
};

/** Pool di bawah ini dianggap tipis — di-skip sebelum scan detail / log. */
export const MIN_POOL_LIQUIDITY_USD = 100_000;

export const DEFAULT_BOT_CONFIG: BotConfig = {
  minProfitUsd: proportionalMinProfitAnchorUsd(10_000),
  minerTipPct: 0.5,
  dynamicBribePercent: 0.5,
  minSpreadPct: 0.5,
  maxSpotSpreadPct: 5,
  gasLimit: 650_000,
  activeDexIds: defaultDexIdsForChain(defaultTradingChainId()),
  loanAmountUsd: 10_000,
  flashLoanProvider: FLASH_LOAN_PROVIDER,
  aaveFeePct: AAVE_FLASH_FEE_PCT.free,
  flashLoanPlatforms: defaultFlashLoanPlatforms(),
  gasStrategyMode: DEFAULT_GAS_STRATEGY.mode,
  slowMaxGasGwei: DEFAULT_GAS_STRATEGY.slowMaxGasGwei,
  extremeMaxGasGwei: DEFAULT_GAS_STRATEGY.extremeMaxGasGwei,
  minPoolLiquidityUsd: MIN_POOL_LIQUIDITY_USD,
  maxPriceImpactPct: 1,
  useBundle: true,
  chainId: defaultTradingChainId(),
  pairId: defaultPairForChain(defaultTradingChainId()).id,
  scanMode: "full",
};

export const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
export const USDT = "0x55d398326f99059fF775485246999027B3197955";

/** Spread spot di atas 5% diperlakukan sebagai data buruk / likuiditas tipis. */
export const MAX_SPOT_SPREAD_BPS = 500;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function isProtocolBalancerVault(address: string): boolean {
  return address.trim().toLowerCase() === BALANCER_V2_VAULT.toLowerCase();
}

export function isUsableExecutorAddress(address: string): boolean {
  const value = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) return false;
  const lower = value.toLowerCase();
  return lower !== ZERO_ADDRESS && lower !== BALANCER_V2_VAULT.toLowerCase();
}

function firstUsableEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim() ?? "";
    if (isUsableExecutorAddress(value)) return value;
  }
  return "";
}

/** Target `executeFlashLoan` / kill / withdraw per jaringan aktif (bukan Balancer Vault 0xBA12…). */
export function contractAddressFromEnv(chainId?: string): string {
  const chain = chainId || defaultTradingChainId();
  if (chain === "arbitrum") {
    return (
      firstUsableEnv(
        "NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR",
        "NEXT_PUBLIC_BALANCER_FLASH_ARB",
        "BALANCER_FLASH_ARB",
        "CONTRACT_ADDRESS"
      ) || ARBITRUM_BALANCER_FLASH_ARB
    );
  }
  if (chain === "ethereum") {
    return (
      firstUsableEnv(
        "NEXT_PUBLIC_ETHEREUM_ARBITRAGE_EXECUTOR",
        "ETHEREUM_BALANCER_FLASH_ARB",
        "BALANCER_FLASH_ARB_ETHEREUM"
      ) || ETHEREUM_BALANCER_FLASH_ARB
    );
  }
  if (chain === "polygon") {
    return firstUsableEnv(
      "NEXT_PUBLIC_POLYGON_ARBITRAGE_EXECUTOR",
      "POLYGON_BALANCER_FLASH_ARB",
      "BALANCER_FLASH_ARB_POLYGON"
    );
  }
  return firstEnv(
    "NEXT_PUBLIC_BSC_ARBITRAGE_EXECUTOR",
    "NEXT_PUBLIC_BSC_VAULT_CONTRACT",
    "CONTRACT_ADDRESS",
    "NEXT_PUBLIC_CONTRACT_ADDRESS"
  );
}

export function vaultContractFromEnv(chainId?: string): string {
  return contractAddressFromEnv(chainId);
}

/** Sumber flash loan; fallback jika pair DEX dari scanner kosong. */
export function flashLoanPoolFromEnv(chainId?: string): string {
  const chain = chainId || defaultTradingChainId();
  if (chain === "arbitrum") {
    return firstEnv("NEXT_PUBLIC_ARBITRUM_FLASH_LOAN_POOL") || BALANCER_V2_VAULT;
  }
  if (chain === "ethereum") {
    return firstEnv("ETHEREUM_FLASH_LOAN_POOL", "ETHEREUM_BALANCER_VAULT") || BALANCER_V2_VAULT;
  }
  if (chain === "polygon") {
    return firstEnv("POLYGON_FLASH_LOAN_POOL", "POLYGON_BALANCER_VAULT") || BALANCER_V2_VAULT;
  }
  return firstEnv(
    "NEXT_PUBLIC_BSC_FLASH_LOAN_POOL",
    "NEXT_PUBLIC_BSC_VAULT_CONTRACT",
    "NEXT_PUBLIC_BSC_ARBITRAGE_EXECUTOR"
  );
}
