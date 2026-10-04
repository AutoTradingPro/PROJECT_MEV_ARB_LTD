import { getAddress } from "ethers";
import { FLASH_FEE_PPM, feePpmToPct } from "@/src/flashloan/globalProviderSelector";
import { BALANCER_V2_VAULT } from "@/config/networks";
import { getChain, type ChainId } from "@/lib/chain/networks";
import { pairsForChain, type TokenPairConfig } from "@/lib/chain/tokenPairs";
import type { DexId, DexRoute, FlashLoanProviderId } from "./types";

/** EIP-55 via lowercase first — mixed-case strings with a bad checksum fail ethers v6. */
function addr(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return getAddress(trimmed.toLowerCase());
}

/** Fee flashloan kanonik (persen) — Uniswap memakai mode pool, bukan angka tetap. */
export const FLASH_LOAN_FEE_PCT: Record<Exclude<FlashLoanProviderId, "uniswap">, number> = {
  aave: feePpmToPct(FLASH_FEE_PPM.AAVE_V3),
  /** Kamino K-Lend: 10 ppm = 0.001%. */
  kamino: feePpmToPct(FLASH_FEE_PPM.KAMINO),
  balancer: feePpmToPct(FLASH_FEE_PPM.BALANCER_V2),
  sushiswap: feePpmToPct(FLASH_FEE_PPM.SUSHI_V2),
};

export const UNISWAP_FLASH_POOL_FEE_MODES = [
  { id: "pool-001", label: "Pool 0.01%", feePct: 0.01 },
  { id: "pool-030", label: "Pool 0.30%", feePct: 0.3 },
] as const;

export function flashLoanFeePctForProvider(
  id: FlashLoanProviderId,
  uniswapPoolFeePct?: number
): number {
  if (id === "uniswap") {
    const allowed = UNISWAP_FLASH_POOL_FEE_MODES.map((item) => item.feePct);
    if (typeof uniswapPoolFeePct === "number" && allowed.includes(uniswapPoolFeePct as (typeof allowed)[number])) {
      return uniswapPoolFeePct;
    }
    return UNISWAP_FLASH_POOL_FEE_MODES[0].feePct;
  }
  return FLASH_LOAN_FEE_PCT[id];
}

export const DEX_ROUTES: DexRoute[] = [
  {
    id: "pancake-v3",
    label: "PancakeSwap V3",
    router: addr("0x1b81D678ffb9C0263b24A97847620C99d213eB14"),
    factory: addr("0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865"),
    feeBps: 25,
    enabled: true,
    networks: ["bsc"],
    kind: "v3",
  },
  {
    id: "pancake-v2",
    label: "PancakeSwap V2",
    router: addr("0x10ED43C718714eb63d5aA57B78B54704E256024E"),
    factory: addr("0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73"),
    feeBps: 25,
    enabled: true,
    networks: ["bsc"],
  },
  {
    id: "biswap",
    label: "BiSwap",
    router: addr("0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8"),
    factory: addr("0x858E3312ed3A876947EA49d572A7C42DE08af7EE"),
    feeBps: 10,
    enabled: true,
    networks: ["bsc"],
  },
  {
    id: "mdex",
    label: "MDEX",
    router: addr("0x7DAe51BD3E3376B8c7c4900E9107f12Be3AF1bA8"),
    factory: addr("0x3CD1C46068dAEa5Ebb0d3f55F3135A01336c7b0e"),
    feeBps: 30,
    enabled: false,
    networks: ["bsc"],
  },
  {
    id: "bakeryswap",
    label: "BakerySwap",
    router: addr("0xCDe540d7eAFE93aC5eD1938cBd26bfBD5d50D4d0"),
    factory: addr("0x01bF7C66c6BD861915CbdBD16d6c2eb33078004E"),
    feeBps: 30,
    enabled: false,
    networks: ["bsc"],
  },
  {
    id: "sushiswap-v2",
    label: "SushiSwap",
    router: addr("0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"),
    factory: addr("0xc35DADB65012eC5796536bD9864eD8773aBc74C4"),
    feeBps: 30,
    enabled: true,
    networks: ["arbitrum", "polygon", "optimism", "base", "avalanche", "fantom"],
    v3Factory: addr("0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e"),
  },
  {
    id: "uniswap-v2",
    label: "Uniswap V3",
    router: addr("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
    factory: addr("0x1F98431c8aD98523631AE4a59f267346ea31F984"),
    feeBps: 30,
    enabled: true,
    networks: ["arbitrum", "polygon", "ethereum", "optimism"],
    kind: "v3",
  },
  {
    id: "camelot",
    label: "Camelot",
    router: addr("0xc873fEcbd354f5A56E00E710B90EF4201db2448d"),
    factory: addr("0x6EcCab422D763aC031210895C81787E87B43A652"),
    feeBps: 30,
    enabled: true,
    networks: ["arbitrum"],
    algebraFactory: addr("0x1a3c9B1d2F0529D97f2afC5136Cc23e58f1FD35B"),
  },
  {
    id: "quickswap",
    label: "QuickSwap",
    router: addr("0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"),
    factory: addr("0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32"),
    feeBps: 30,
    enabled: true,
    networks: ["polygon"],
    algebraFactory: addr("0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28"),
  },
  {
    id: "balancer-v2",
    label: "Balancer",
    router: addr(BALANCER_V2_VAULT),
    factory: addr(BALANCER_V2_VAULT),
    feeBps: 0,
    enabled: true,
    networks: ["polygon", "ethereum", "arbitrum"],
    kind: "vault",
  },
  {
    id: "sushiswap-eth",
    label: "SushiSwap",
    router: addr("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"),
    factory: addr("0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac"),
    feeBps: 30,
    enabled: true,
    networks: ["ethereum"],
    v3Factory: addr("0xbACEB8eC6b9355Dfc0269AC0145C46505Ef3B6b6"),
  },
  {
    id: "curve",
    label: "Curve",
    router: addr("0x16C6521Dff6bebA97B2A73F791D7809D00cdD26e"),
    factory: addr("0xF18056Bbd320E96A24e3C8ab39749789ad795291"),
    feeBps: 4,
    enabled: true,
    networks: ["ethereum"],
    kind: "curve",
  },
  {
    id: "velodrome",
    label: "Velodrome",
    router: addr("0xa062aE8A9c5e11aaA026fc2670B0D65cCc8B2858"),
    factory: addr("0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a"),
    feeBps: 30,
    enabled: true,
    networks: ["optimism"],
    kind: "solidly",
  },
  {
    id: "uniswap-base",
    label: "Uniswap V3",
    router: addr("0x2626664c2603336E57B271c5C0b26F421741e481"),
    factory: addr("0x33128a8fC17869897dcE68Ed026d694621f6FDfD"),
    feeBps: 30,
    enabled: true,
    networks: ["base"],
    kind: "v3",
  },
  {
    id: "aerodrome",
    label: "Aerodrome",
    router: addr("0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43"),
    factory: addr("0x420DD381b31aEf6683db6B902084cB0FFECe40Da"),
    feeBps: 30,
    enabled: true,
    networks: ["base"],
    kind: "solidly",
  },
  {
    id: "uniswap-avax",
    label: "Uniswap V3",
    router: addr("0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE"),
    factory: addr("0x740b1c1de25031C31FF4fC9A62c2670832E3D370"),
    feeBps: 30,
    enabled: true,
    networks: ["avalanche"],
    kind: "v3",
  },
  {
    id: "traderjoe",
    label: "Trader Joe",
    router: addr("0x60aE616a2155Ee3d9A68541Ba4544862310933d4"),
    factory: addr("0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10"),
    feeBps: 30,
    enabled: true,
    networks: ["avalanche"],
  },
  {
    id: "spookyswap",
    label: "SpookySwap",
    router: addr("0xF491e7B69E4244ad4002BC14e878a34207E38c29"),
    factory: addr("0x152eE697f2E276fA89E96742e9bB9aB1F2E61bF3"),
    feeBps: 20,
    enabled: true,
    networks: ["fantom"],
  },
  {
    id: "osmosis",
    label: "Osmosis",
    router: "",
    factory: "",
    feeBps: 30,
    enabled: false,
    networks: ["cosmos"],
    kind: "cosmos",
  },
  {
    id: "raydium",
    label: "Raydium",
    router: "",
    factory: "",
    feeBps: 25,
    enabled: true,
    networks: ["solana"],
    kind: "solana",
  },
  {
    id: "orca",
    label: "Orca",
    router: "",
    factory: "",
    feeBps: 30,
    enabled: true,
    networks: ["solana"],
    kind: "solana",
  },
];

/** DEX likuiditas utama per jaringan scanner (urutan = prioritas scan). */
export const CHAIN_DEX_REGISTRY: Record<
  ChainId,
  { primary: DexId; dexIds: DexId[]; notes: string }
> = {
  ethereum: {
    primary: "uniswap-v2",
    dexIds: ["uniswap-v2", "curve", "balancer-v2", "sushiswap-eth"],
    notes: "Uniswap V3 + Curve + Balancer",
  },
  polygon: {
    primary: "uniswap-v2",
    dexIds: ["uniswap-v2", "quickswap", "balancer-v2", "sushiswap-v2"],
    notes: "Uniswap V3 + QuickSwap + Balancer",
  },
  arbitrum: {
    primary: "uniswap-v2",
    dexIds: ["uniswap-v2", "camelot", "balancer-v2", "sushiswap-v2"],
    notes: "Uniswap V3 + Camelot + Balancer",
  },
  optimism: {
    primary: "velodrome",
    dexIds: ["velodrome", "uniswap-v2", "sushiswap-v2"],
    notes: "Velodrome + Uniswap V3",
  },
  avalanche: {
    primary: "traderjoe",
    dexIds: ["traderjoe", "uniswap-avax", "sushiswap-v2"],
    notes: "Trader Joe + Uniswap V3",
  },
  cosmos: {
    primary: "osmosis",
    dexIds: ["osmosis"],
    notes: "Osmosis (legacy — diganti Solana di scanner)",
  },
  solana: {
    primary: "raydium",
    dexIds: ["raydium", "orca"],
    notes: "Raydium + Orca via Ankr Solana RPC",
  },
  base: {
    primary: "aerodrome",
    dexIds: ["aerodrome", "uniswap-base", "sushiswap-v2"],
    notes: "Aerodrome + Uniswap V3",
  },
  bsc: {
    primary: "pancake-v3",
    dexIds: ["pancake-v3", "pancake-v2", "biswap"],
    notes: "PancakeSwap V3/V2",
  },
  fantom: {
    primary: "spookyswap",
    dexIds: ["spookyswap", "sushiswap-v2"],
    notes: "SpookySwap + SushiSwap",
  },
  linea: {
    primary: "uniswap-v2",
    dexIds: ["uniswap-v2", "sushiswap-v2"],
    notes: "Uniswap + SushiSwap di Linea",
  },
};

export function dexRoutesForChain(chainId: ChainId): DexRoute[] {
  return DEX_ROUTES.filter((item) => item.networks.includes(chainId as DexRoute["networks"][number]));
}

export function defaultDexIdsForChain(chainId: ChainId): DexId[] {
  const mapped = CHAIN_DEX_REGISTRY[chainId];
  if (mapped?.dexIds.length) return [...mapped.dexIds];
  return dexRoutesForChain(chainId)
    .filter((item) => item.enabled)
    .map((item) => item.id);
}

export function dexIdsAllowedOnChain(chainId: ChainId): Set<DexId> {
  return new Set(dexRoutesForChain(chainId).map((item) => item.id));
}

export function dexLabelsForChain(chainId: ChainId): string {
  const labels = defaultDexIdsForChain(chainId).map((id) => dexLabel(id));
  return labels.length > 0 ? labels.join(" / ") : "DEX";
}

/** DEX yang boleh di-scan di rantai aktif; fallback ke registry jika pilihan UI/state tidak valid. */
export function resolveScanDexIds(chainId: ChainId, requested?: DexId[]): DexId[] {
  const allowed = dexIdsAllowedOnChain(chainId);
  const picked = [...new Set((requested ?? []).filter((id) => allowed.has(id)))];
  const defaults = defaultDexIdsForChain(chainId);
  if (picked.length === 0) return defaults;
  const legacyTwo =
    picked.length <= 2 &&
    picked.every((id) => id === "balancer-v2" || id === "uniswap-v2") &&
    defaults.length > picked.length;
  return legacyTwo ? defaults : picked;
}

export function dexLabel(id: DexId): string {
  return DEX_ROUTES.find((d) => d.id === id)?.label ?? id;
}

export function dexUsesV2Router(id: DexId): boolean {
  const kind = DEX_ROUTES.find((item) => item.id === id)?.kind;
  return (
    kind !== "v3" &&
    kind !== "vault" &&
    kind !== "curve" &&
    kind !== "solidly" &&
    kind !== "cosmos" &&
    kind !== "solana"
  );
}

export function dexQuotesOnChain(id: DexId): boolean {
  const meta = DEX_ROUTES.find((item) => item.id === id);
  return Boolean(meta && meta.kind !== "cosmos" && meta.kind !== "solana" && meta.factory);
}

export function dexIsConcentrated(id: DexId): boolean {
  const meta = DEX_ROUTES.find((item) => item.id === id);
  return meta?.kind === "v3" || Boolean(meta?.algebraFactory);
}

export function opportunityUsesV2Routers(opp: { buyDex: DexId; sellDex: DexId }): boolean {
  return dexUsesV2Router(opp.buyDex) && dexUsesV2Router(opp.sellDex);
}

export function resolveOpportunitySwapRouters(opp: { buyDex: DexId; sellDex: DexId }) {
  const buy = DEX_ROUTES.find((item) => item.id === opp.buyDex);
  const sell = DEX_ROUTES.find((item) => item.id === opp.sellDex);
  if (!buy?.router || !sell?.router) return null;
  return { buy, sell };
}

export interface ScanPlan {
  chainId: ChainId;
  evm: boolean;
  dexIds: DexId[];
  pairs: TokenPairConfig[];
}

/** Satu rantai aktif: katalog pair + DEX registry. Scanner tidak boleh memakai plan rantai lain. */
export function scanPlanForChain(chainId: ChainId, requestedDexIds?: DexId[]): ScanPlan {
  const chain = getChain(chainId);
  return {
    chainId,
    evm: chain.evm,
    dexIds: resolveScanDexIds(chainId, requestedDexIds),
    pairs: pairsForChain(chainId),
  };
}
