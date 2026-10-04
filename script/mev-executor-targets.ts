/**
 * Target deploy MevExecutor.
 * Optimism, Avalanche: Aave V3, premi 900 ppm.
 * Base: Uniswap V3 flash, fee tier 100 (fallback 3000 di kontrak).
 * Fantom: Balancer V2 fee 0 sampai redeploy berikutnya.
 * Linea: PancakeSwap V3 fee tier 100 (0.01%).
 * Ukuran pinjaman: 200 bps pool V3, 300 bps AMM.
 */
import {
  AVALANCHE_TOKENS,
  BALANCER_V2_VAULT,
  BASE_TOKENS,
  FANTOM_TOKENS,
  LINEA_TOKENS,
  OPTIMISM_TOKENS,
} from "../config/networks";
import { AMM_LOAN_OF_POOL_RATIO, V3_LOAN_OF_POOL_RATIO } from "../lib/bot/adaptiveMinProfit";

export const KIND_BALANCER = 1;
export const KIND_PANCAKE_V3 = 2;
export const KIND_AAVE_V3 = 3;
export const KIND_UNISWAP_V3_FLASH = 4;
/** Pool Aave V3 (CREATE2 yang sama di Optimism dan Avalanche). Premi kontrak 900 ppm. */
export const OPTIMISM_AAVE_V3_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
export const AVALANCHE_AAVE_V3_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
export const AAVE_V3_PREMIUM_PPM = 900;
export const V3_LOAN_BPS = 200;
export const AMM_LOAN_BPS = 300;
/** Factory PancakeSwap V3 (CREATE2 yang sama dengan registry pancake-v3). */
export const PANCAKE_V3_FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";
export const PANCAKE_V3_FEE_TIER = 100;
/** Factory Uniswap V3 Base. Kontrak mencoba tier 100 dulu, lalu 3000. */
export const BASE_UNISWAP_V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
export const UNISWAP_V3_FLASH_FEE_PPM = 100;

export interface MevExecutorTarget {
  chain: "optimism" | "base" | "avalanche" | "fantom" | "linea";
  chainId: number;
  kind: typeof KIND_BALANCER | typeof KIND_PANCAKE_V3 | typeof KIND_AAVE_V3 | typeof KIND_UNISWAP_V3_FLASH;
  flashFee: number;
  feePpm: number;
  providerId: "balancer-v2" | "pancakeswap-v3" | "aave-v3" | "uniswap-v3";
  providerName: string;
  flashSource: string;
  wrappedNative: string;
  nativeSymbol: string;
  envKeys: readonly string[];
}

export const MEV_EXECUTOR_DEPLOY_TARGETS: readonly MevExecutorTarget[] = [
  {
    chain: "optimism",
    chainId: 10,
    kind: KIND_AAVE_V3,
    flashFee: AAVE_V3_PREMIUM_PPM,
    feePpm: AAVE_V3_PREMIUM_PPM,
    providerId: "aave-v3",
    providerName: "Aave V3",
    flashSource: OPTIMISM_AAVE_V3_POOL,
    wrappedNative: OPTIMISM_TOKENS.weth,
    nativeSymbol: "ETH",
    envKeys: ["NEXT_PUBLIC_OPTIMISM_ARBITRAGE_EXECUTOR", "OPTIMISM_ARBITRAGE_EXECUTOR"],
  },
  {
    chain: "base",
    chainId: 8453,
    kind: KIND_UNISWAP_V3_FLASH,
    flashFee: UNISWAP_V3_FLASH_FEE_PPM,
    feePpm: UNISWAP_V3_FLASH_FEE_PPM,
    providerId: "uniswap-v3",
    providerName: "Uniswap V3",
    flashSource: BASE_UNISWAP_V3_FACTORY,
    wrappedNative: BASE_TOKENS.weth,
    nativeSymbol: "ETH",
    envKeys: ["NEXT_PUBLIC_BASE_ARBITRAGE_EXECUTOR", "BASE_ARBITRAGE_EXECUTOR"],
  },
  {
    chain: "avalanche",
    chainId: 43114,
    kind: KIND_AAVE_V3,
    flashFee: AAVE_V3_PREMIUM_PPM,
    feePpm: AAVE_V3_PREMIUM_PPM,
    providerId: "aave-v3",
    providerName: "Aave V3",
    flashSource: AVALANCHE_AAVE_V3_POOL,
    wrappedNative: AVALANCHE_TOKENS.wavax,
    nativeSymbol: "AVAX",
    envKeys: ["NEXT_PUBLIC_AVALANCHE_ARBITRAGE_EXECUTOR", "AVALANCHE_ARBITRAGE_EXECUTOR"],
  },
  {
    chain: "fantom",
    chainId: 250,
    kind: KIND_BALANCER,
    flashFee: 0,
    feePpm: 0,
    providerId: "balancer-v2",
    providerName: "Balancer V2",
    flashSource: BALANCER_V2_VAULT,
    wrappedNative: FANTOM_TOKENS.wftm,
    nativeSymbol: "FTM",
    envKeys: ["NEXT_PUBLIC_FANTOM_ARBITRAGE_EXECUTOR", "FANTOM_ARBITRAGE_EXECUTOR"],
  },
  {
    chain: "linea",
    chainId: 59144,
    kind: KIND_PANCAKE_V3,
    flashFee: PANCAKE_V3_FEE_TIER,
    feePpm: 100,
    providerId: "pancakeswap-v3",
    providerName: "PancakeSwap V3",
    flashSource: PANCAKE_V3_FACTORY,
    wrappedNative: LINEA_TOKENS.weth,
    nativeSymbol: "ETH",
    envKeys: ["NEXT_PUBLIC_LINEA_ARBITRAGE_EXECUTOR", "LINEA_ARBITRAGE_EXECUTOR"],
  },
];

export function assertDynamicSizingBps(): void {
  if (Math.round(V3_LOAN_OF_POOL_RATIO * 10_000) !== V3_LOAN_BPS) {
    throw new Error("Rasio V3 bukan 2% (200 bps). Deploy dibatalkan.");
  }
  if (Math.round(AMM_LOAN_OF_POOL_RATIO * 10_000) !== AMM_LOAN_BPS) {
    throw new Error("Rasio AMM bukan 3% (300 bps). Deploy dibatalkan.");
  }
}
