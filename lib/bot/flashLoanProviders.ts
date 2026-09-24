import type { BotConfig, FlashLoanPlatformState, FlashLoanProviderId } from "./types";
import { defaultTradingChainId, type TradingChainId } from "@/config/networks";
import { FLASH_LOAN_FEE_PCT, UNISWAP_FLASH_POOL_FEE_MODES, flashLoanFeePctForProvider } from "./dexRegistry";
import { KAMINO_FLASH_CHAIN_ID, KAMINO_FLASH_FEE_PCT } from "@/lib/bot/solana/kaminoConstants";

export const FLASH_LOAN_PLATFORM_IDS: FlashLoanProviderId[] = [
  "aave",
  "kamino",
  "uniswap",
  "balancer",
  "sushiswap",
];

export interface FlashLoanFeeMode {
  id: string;
  label: string;
  feePct: number;
}

export interface FlashLoanChainOption {
  id: string;
  label: string;
}

export interface FlashLoanPlatformMeta {
  id: FlashLoanProviderId;
  label: string;
  feeLabel: string;
  feePct: number;
  feeModes?: FlashLoanFeeMode[];
  autoDetectFee?: boolean;
  chains: FlashLoanChainOption[];
  bestFor: string;
  liquidity: "Very High" | "High" | "Moderate";
  /** Label UI opsional (mis. bilingual). */
  liquidityLabel?: string;
}

export const FLASH_LOAN_PLATFORMS: FlashLoanPlatformMeta[] = [
  {
    id: "aave",
    label: "Aave",
    feeLabel: "0.09%",
    feePct: FLASH_LOAN_FEE_PCT.aave,
    chains: [
      { id: "ethereum", label: "Ethereum" },
      { id: "polygon", label: "Polygon" },
      { id: "arbitrum", label: "Arbitrum" },
      { id: "optimism", label: "Optimism" },
      { id: "avalanche", label: "Avalanche" },
    ],
    bestFor: "Multi-asset arbitrage and collateral swaps",
    liquidity: "Very High",
  },
  {
    id: "kamino",
    label: "Kamino Finance (K-Lend)",
    feeLabel: "0.001%",
    feePct: KAMINO_FLASH_FEE_PCT,
    chains: [{ id: KAMINO_FLASH_CHAIN_ID, label: "Solana" }],
    bestFor: "Solana K-Lend flash borrow · High Depth liquidity",
    liquidity: "Very High",
    liquidityLabel: "Sangat Tinggi / High Depth",
  },
  {
    id: "uniswap",
    label: "Uniswap",
    feeLabel: "Pool fee applies",
    feePct: UNISWAP_FLASH_POOL_FEE_MODES[0].feePct,
    feeModes: UNISWAP_FLASH_POOL_FEE_MODES.map((item) => ({ ...item })),
    chains: [
      { id: "ethereum", label: "Ethereum" },
      { id: "polygon", label: "Polygon" },
      { id: "arbitrum", label: "Arbitrum" },
      { id: "base", label: "Base" },
      { id: "bsc", label: "BNB Chain" },
    ],
    bestFor: "Flash swaps and liquidity arbitrage",
    liquidity: "Very High",
  },
  {
    id: "balancer",
    label: "Balancer",
    feeLabel: "0%",
    feePct: FLASH_LOAN_FEE_PCT.balancer,
    chains: [
      { id: "ethereum", label: "Ethereum" },
      { id: "polygon", label: "Polygon" },
      { id: "arbitrum", label: "Arbitrum" },
    ],
    bestFor: "Custom pool arbitrage",
    liquidity: "Moderate",
  },
  {
    id: "sushiswap",
    label: "SushiSwap",
    feeLabel: "0.3% swap fee",
    feePct: FLASH_LOAN_FEE_PCT.sushiswap,
    chains: [
      { id: "ethereum", label: "Ethereum" },
      { id: "polygon", label: "Polygon" },
      { id: "arbitrum", label: "Arbitrum" },
      { id: "fantom", label: "Fantom" },
    ],
    bestFor: "Cross-DEX trading strategies",
    liquidity: "Moderate",
  },
];

export const BSC_FLASH_CHAIN_ID = "bsc";

export function platformSupportsBsc(meta: FlashLoanPlatformMeta): boolean {
  return meta.chains.some((item) => item.id === BSC_FLASH_CHAIN_ID);
}

export function platformSupportsChain(meta: FlashLoanPlatformMeta, chainId: string): boolean {
  return meta.chains.some((item) => item.id === chainId);
}

export function preferredChainForPlatform(meta: FlashLoanPlatformMeta, preferred?: string): string {
  if (preferred && platformSupportsChain(meta, preferred)) return preferred;
  return meta.chains[0]?.id ?? "ethereum";
}

export function syncFlashLoanPlatformsToChain(
  raw: BotConfig["flashLoanPlatforms"] | undefined,
  chainId: TradingChainId
): Record<FlashLoanProviderId, FlashLoanPlatformState> {
  const next = mergeFlashLoanPlatforms(raw);
  for (const meta of FLASH_LOAN_PLATFORMS) {
    if (!platformSupportsChain(meta, chainId)) continue;
    next[meta.id] = { ...next[meta.id], chain: chainId };
  }
  return next;
}

export function defaultFlashLoanPlatforms(): Record<FlashLoanProviderId, FlashLoanPlatformState> {
  const preferred = defaultTradingChainId();
  return {
    aave: { enabled: false, chain: preferredChainForPlatform(FLASH_LOAN_PLATFORMS[0], preferred) },
    kamino: {
      enabled: false,
      chain: preferredChainForPlatform(FLASH_LOAN_PLATFORMS[1], KAMINO_FLASH_CHAIN_ID),
    },
    uniswap: {
      enabled: false,
      chain: preferredChainForPlatform(FLASH_LOAN_PLATFORMS[2], preferred),
      feeMode: "pool-005",
    },
    balancer: {
      enabled: false,
      chain: preferredChainForPlatform(FLASH_LOAN_PLATFORMS[3], preferred),
    },
    sushiswap: { enabled: false, chain: preferredChainForPlatform(FLASH_LOAN_PLATFORMS[4], preferred) },
  };
}

/** Migrate persisted `dydx` slot → `kamino` (Solana K-Lend). */
function migrateFlashLoanPlatformsRaw(
  raw?: Partial<Record<string, Partial<FlashLoanPlatformState>>>
): Partial<Record<FlashLoanProviderId, Partial<FlashLoanPlatformState>>> | undefined {
  if (!raw) return undefined;
  const next: Partial<Record<FlashLoanProviderId, Partial<FlashLoanPlatformState>>> = {
    ...(raw as Partial<Record<FlashLoanProviderId, Partial<FlashLoanPlatformState>>>),
  };
  const legacy = (raw as Record<string, Partial<FlashLoanPlatformState> | undefined>).dydx;
  if (legacy && !next.kamino) {
    next.kamino = {
      enabled: Boolean(legacy.enabled),
      chain: KAMINO_FLASH_CHAIN_ID,
      feeMode: legacy.feeMode,
    };
  }
  delete (next as Record<string, unknown>).dydx;
  return next;
}

export function mergeFlashLoanPlatforms(
  raw?: Partial<Record<FlashLoanProviderId, Partial<FlashLoanPlatformState>>>
): Record<FlashLoanProviderId, FlashLoanPlatformState> {
  const base = defaultFlashLoanPlatforms();
  const migrated = migrateFlashLoanPlatformsRaw(raw);
  if (!migrated) return base;
  for (const meta of FLASH_LOAN_PLATFORMS) {
    const patch = migrated[meta.id];
    if (!patch) continue;
    const chainOk = Boolean(patch.chain && meta.chains.some((item) => item.id === patch.chain));
    const feeOk = !meta.feeModes || meta.feeModes.some((item) => item.id === patch.feeMode);
    base[meta.id] = {
      enabled: Boolean(patch.enabled),
      chain: chainOk && patch.chain ? patch.chain : base[meta.id].chain,
      feeMode: feeOk && patch.feeMode ? patch.feeMode : base[meta.id].feeMode,
    };
  }
  // Radio-style: 0 atau 1 aktif. Jika >1, sisakan satu (prioritas urutan daftar).
  const enabledIds = FLASH_LOAN_PLATFORM_IDS.filter((id) => base[id].enabled);
  if (enabledIds.length > 1) {
    const keep = enabledIds[0];
    for (const pid of FLASH_LOAN_PLATFORM_IDS) {
      base[pid] = { ...base[pid], enabled: pid === keep };
    }
  }
  return base;
}

/** Provider yang sedang ON, atau null jika semua siaga (OFF). */
export function activeFlashLoanProviderId(
  platforms?: BotConfig["flashLoanPlatforms"] | Record<FlashLoanProviderId, FlashLoanPlatformState>
): FlashLoanProviderId | null {
  const merged = mergeFlashLoanPlatforms(platforms);
  return FLASH_LOAN_PLATFORM_IDS.find((id) => merged[id]?.enabled) ?? null;
}

export function hasActiveFlashLoanProvider(
  platforms?: BotConfig["flashLoanPlatforms"] | Record<FlashLoanProviderId, FlashLoanPlatformState>
): boolean {
  return activeFlashLoanProviderId(platforms) != null;
}

/** Matikan semua provider — mode siaga (scanner/RPC idle). */
export function disableAllFlashLoanPlatforms(
  raw?: BotConfig["flashLoanPlatforms"]
): Record<FlashLoanProviderId, FlashLoanPlatformState> {
  const next = mergeFlashLoanPlatforms(raw);
  for (const pid of FLASH_LOAN_PLATFORM_IDS) {
    next[pid] = { ...next[pid], enabled: false };
  }
  return next;
}

export function isFlashLoanProviderId(value: unknown): value is FlashLoanProviderId {
  return FLASH_LOAN_PLATFORM_IDS.includes(value as FlashLoanProviderId);
}

/** Terima id lama `dydx` sebagai alias Kamino saat load config. */
export function normalizeFlashLoanProviderId(value: unknown): FlashLoanProviderId | undefined {
  if (value === "dydx") return "kamino";
  if (isFlashLoanProviderId(value)) return value;
  return undefined;
}

export function getFlashLoanPlatform(id: FlashLoanProviderId): FlashLoanPlatformMeta {
  return FLASH_LOAN_PLATFORMS.find((item) => item.id === id) ?? FLASH_LOAN_PLATFORMS[0];
}

export function supportedChainsLabel(meta: FlashLoanPlatformMeta): string {
  return meta.chains.map((item) => item.label).join(", ");
}

/** Aktifkan satu platform (radio); yang lain dimatikan. */
export function exclusiveEnablePlatform(
  raw: BotConfig["flashLoanPlatforms"] | undefined,
  id: FlashLoanProviderId,
  chainHint?: string
): Record<FlashLoanProviderId, FlashLoanPlatformState> {
  const next = mergeFlashLoanPlatforms(raw);
  const meta = getFlashLoanPlatform(id);
  const chain = preferredChainForPlatform(meta, chainHint ?? next[id]?.chain);
  for (const pid of FLASH_LOAN_PLATFORM_IDS) {
    next[pid] = {
      ...next[pid],
      enabled: pid === id,
      chain: pid === id ? chain : next[pid].chain,
    };
  }
  return next;
}

export function flashLoanProviderLabel(id?: string | null): string {
  if (!id) return "Flash loan";
  const normalized = normalizeFlashLoanProviderId(id);
  if (!normalized) return "Flash loan";
  return getFlashLoanPlatform(normalized).label;
}

export function resolveFlashLoanFeePct(
  platforms: Record<FlashLoanProviderId, FlashLoanPlatformState>,
  preferred?: FlashLoanProviderId,
  options?: { aaveFeePct?: number; uniswapPoolFeePct?: number }
): { providerId: FlashLoanProviderId; feePct: number; liquidity: FlashLoanPlatformMeta["liquidity"] } {
  const preferredRow = preferred ? platforms[preferred] : undefined;
  const activeId =
    (preferredRow?.enabled && preferred ? preferred : undefined) ??
    FLASH_LOAN_PLATFORM_IDS.find((id) => platforms[id]?.enabled) ??
    preferred ??
    "balancer";
  const meta = getFlashLoanPlatform(activeId);
  const state = platforms[activeId];
  if (activeId === "uniswap") {
    const mode = meta.feeModes?.find((item) => item.id === state?.feeMode) ?? meta.feeModes?.[0];
    const feePct = flashLoanFeePctForProvider(
      "uniswap",
      typeof options?.uniswapPoolFeePct === "number" ? options.uniswapPoolFeePct : mode?.feePct
    );
    return { providerId: activeId, feePct, liquidity: meta.liquidity };
  }
  return {
    providerId: activeId,
    feePct: flashLoanFeePctForProvider(activeId),
    liquidity: meta.liquidity,
  };
}

/**
 * Estimasi net USD dari parameter operasional:
 * Loan × (Minimum Spread − margin aman minAmountOut − Flash Fee) − Validator Tip.
 * Slippage % statis tidak dipakai.
 */
export function estimateOperationalNetProfitUsd(input: {
  loanAmountUsd: number;
  minSpreadPct: number;
  minerTipPct: number;
  flashFeePct: number;
}): number {
  const loan = Number.isFinite(input.loanAmountUsd) ? Math.max(0, input.loanAmountUsd) : 0;
  const spread = Math.max(0, input.minSpreadPct) / 100;
  const safety = 8 / 10_000;
  const fee = Math.max(0, input.flashFeePct) / 100;
  const tip = Math.max(0, input.minerTipPct) / 100;
  const gross = loan * spread;
  const afterCosts = gross - loan * safety - loan * fee;
  const validatorTip = Math.max(0, afterCosts) * tip;
  return afterCosts - validatorTip;
}

export function scanPoolFeePctFromBps(feeBps: bigint | number): number {
  const bps = typeof feeBps === "bigint" ? Number(feeBps) : feeBps;
  if (!Number.isFinite(bps) || bps < 0) return 0;
  return bps / 100;
}

export function pickLivePoolFeePct(
  opportunities: {
    pairId: string;
    tokenPair?: string;
    status?: string;
    uniswapPoolFeePct?: number;
    scanPoolFeePct?: number;
  }[],
  pairId: string
): { feePct: number; pairLabel?: string } | null {
  const rows = opportunities.filter((item) => item.pairId === pairId);
  const featured =
    rows.find((item) => item.status === "ready" && item.uniswapPoolFeePct != null) ??
    rows.find((item) => item.uniswapPoolFeePct != null) ??
    rows.find((item) => item.status === "ready" && item.scanPoolFeePct != null) ??
    rows.find((item) => item.scanPoolFeePct != null) ??
    rows[0];
  if (!featured) return null;
  const feePct = featured.uniswapPoolFeePct ?? featured.scanPoolFeePct;
  if (feePct == null || !Number.isFinite(feePct)) return null;
  return { feePct, pairLabel: featured.tokenPair };
}
