/**
 * Matriks flash loan yang dikunci.
 * feePpm: 1_000_000 = 100%. 0 = gratis, 10 = 0.001%, 100 = 0.01%, 900 = 0.09%, 3000 = 0.30%.
 * Pemenang runtime = provider legal dengan fee terkecil. Balancer V2 menang di chain yang mengizinkannya.
 */

export const FLASH_FEE_PPM = {
  BALANCER_V2: 0,
  PANCAKE_V3: 100,
  KAMINO: 10,
  V3_FLASH_LOW: 100,
  V3_FLASH_HIGH: 3000,
  AAVE_V3: 900,
  SUSHI_V2: 3000,
} as const;

export const FANTOM_EXECUTOR_SKIP_REASON = "Executor contract not deployed on Fantom";

export interface FlashloanProviderEntry {
  id: string;
  name: string;
  feePpm: number;
}

export interface FlashloanRouteFee {
  /** Tier uint24 pool V3: 100 atau 3000. */
  poolFee?: number;
  /** Persen fee pool, misalnya 0.01 atau 0.30. */
  poolFeePct?: number;
}

interface ProviderSpec {
  id: string;
  name: string;
  feePpm: number;
  dynamicV3?: boolean;
  chains: readonly (number | "solana")[];
}

const PROVIDER_SPECS: readonly ProviderSpec[] = [
  {
    id: "balancer-v2",
    name: "Balancer V2",
    feePpm: FLASH_FEE_PPM.BALANCER_V2,
    chains: [1, 137, 42161],
  },
  {
    id: "pancakeswap-v3",
    name: "PancakeSwap V3",
    feePpm: FLASH_FEE_PPM.PANCAKE_V3,
    chains: [59144],
  },
  {
    id: "kamino",
    name: "Kamino Finance (K-Lend)",
    feePpm: FLASH_FEE_PPM.KAMINO,
    chains: ["solana"],
  },
  {
    id: "uniswap-v3",
    name: "Uniswap V3",
    feePpm: FLASH_FEE_PPM.V3_FLASH_LOW,
    dynamicV3: true,
    chains: [1, 137, 42161, 8453],
  },
  {
    id: "pancakeswap-v3",
    name: "PancakeSwap V3",
    feePpm: FLASH_FEE_PPM.V3_FLASH_LOW,
    dynamicV3: true,
    chains: [56],
  },
  {
    id: "pancakeswap-v2",
    name: "PancakeSwap V2",
    feePpm: FLASH_FEE_PPM.SUSHI_V2,
    chains: [56],
  },
  {
    id: "aave-v3",
    name: "Aave V3",
    feePpm: FLASH_FEE_PPM.AAVE_V3,
    chains: [1, 137, 42161, 43114, 10],
  },
  {
    id: "sushiswap-v2",
    name: "SushiSwap V2",
    feePpm: FLASH_FEE_PPM.SUSHI_V2,
    chains: [1, 137, 42161, 250],
  },
];

const EVM_CHAIN_IDS = [1, 10, 56, 137, 250, 8453, 42161, 43114, 59144] as const;

const TRADING_CHAIN_TO_NUMERIC: Record<string, number> = {
  ethereum: 1,
  optimism: 10,
  bsc: 56,
  polygon: 137,
  fantom: 250,
  base: 8453,
  arbitrum: 42161,
  avalanche: 43114,
  linea: 59144,
};

export function numericChainIdForTradingChain(chainKey: string | number | null | undefined): number | null {
  if (typeof chainKey === "number" && Number.isFinite(chainKey)) return chainKey;
  const key = String(chainKey ?? "").trim().toLowerCase();
  if (key === "solana") return null;
  return TRADING_CHAIN_TO_NUMERIC[key] ?? null;
}

export function isSolanaTradingChain(chainKey: string | number | null | undefined): boolean {
  return String(chainKey ?? "").trim().toLowerCase() === "solana";
}

/** Fantom tidak punya executor. Chain lain boleh lanjut. */
export function flashloanExecutionBlock(chainKey: string | number | null | undefined): string | null {
  const key = String(chainKey ?? "").trim().toLowerCase();
  if (key === "fantom" || numericChainIdForTradingChain(chainKey) === 250) {
    return FANTOM_EXECUTOR_SKIP_REASON;
  }
  return null;
}

/** 100 ppm kecuali rute pool jelas 0.30% (tier 3000 atau fee >= 0.25%). */
export function resolveV3FlashFeePpm(route?: FlashloanRouteFee): 100 | 3000 {
  const tier = route?.poolFee;
  if (tier === 3000 || tier === 10000) return FLASH_FEE_PPM.V3_FLASH_HIGH;
  if (tier === 100) return FLASH_FEE_PPM.V3_FLASH_LOW;
  const pct = route?.poolFeePct;
  if (typeof pct === "number" && Number.isFinite(pct) && pct >= 0.25) return FLASH_FEE_PPM.V3_FLASH_HIGH;
  return FLASH_FEE_PPM.V3_FLASH_LOW;
}

function chainToken(chainId: number | "solana"): number | "solana" {
  return chainId;
}

function legalSpecs(chain: number | "solana"): ProviderSpec[] {
  return PROVIDER_SPECS.filter((spec) => {
    if (chain === 56 && spec.id === "balancer-v2") return false;
    return spec.chains.includes(chainToken(chain));
  });
}

function materialize(spec: ProviderSpec, route?: FlashloanRouteFee): FlashloanProviderEntry {
  return {
    id: spec.id,
    name: spec.name,
    feePpm: spec.dynamicV3 ? resolveV3FlashFeePpm(route) : spec.feePpm,
  };
}

export function rankFlashloanProvidersForChain(
  chainId: number | "solana",
  route?: FlashloanRouteFee
): FlashloanProviderEntry[] {
  return legalSpecs(chainId)
    .map((spec, index) => ({ entry: materialize(spec, route), index }))
    .sort((a, b) => a.entry.feePpm - b.entry.feePpm || a.index - b.index)
    .map((item) => item.entry);
}

export function getBestFlashloanProvider(
  chainId: number | "solana",
  route?: FlashloanRouteFee
): FlashloanProviderEntry | null {
  return rankFlashloanProvidersForChain(chainId, route)[0] ?? null;
}

export const GLOBAL_FLASHLOAN_REGISTRY: Record<number, FlashloanProviderEntry[]> = Object.fromEntries(
  EVM_CHAIN_IDS.map((chainId) => [chainId, rankFlashloanProvidersForChain(chainId)])
);

export function bestFlashloanForTradingChain(
  chainKey: string | number | null | undefined,
  route?: FlashloanRouteFee
): (FlashloanProviderEntry & { chainId: number }) | null {
  if (isSolanaTradingChain(chainKey)) {
    const best = getBestFlashloanProvider("solana", route);
    return best ? { ...best, chainId: 0 } : null;
  }
  const chainId = numericChainIdForTradingChain(chainKey);
  if (chainId == null) return null;
  const best = getBestFlashloanProvider(chainId, route);
  return best ? { ...best, chainId } : null;
}

export function feePpmToPct(feePpm: number): number {
  return feePpm / 10_000;
}

export function feePpmToBps(feePpm: number): number {
  return Math.round(feePpm / 100);
}
