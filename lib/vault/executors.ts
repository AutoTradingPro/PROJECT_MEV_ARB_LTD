import {
  ARBITRUM_BALANCER_FLASH_ARB,
  BALANCER_V2_VAULT,
  ETHEREUM_BALANCER_FLASH_ARB,
} from "@/config/networks";
import {
  publicArbitrumArbitrageExecutor,
  publicAvalancheArbitrageExecutor,
  publicBaseArbitrageExecutor,
  publicEthereumArbitrageExecutor,
  publicLineaArbitrageExecutor,
  publicMonadArbitrageExecutor,
  publicOptimismArbitrageExecutor,
  publicPolygonArbitrageExecutor,
} from "@/lib/chain/publicEnv";
import type { ChainId } from "@/lib/chain/networks";

export const BSC_EVM_CHAIN_ID = 56;
export const ARBITRUM_EVM_CHAIN_ID = 42161;
export const ETHEREUM_EVM_CHAIN_ID = 1;
export const LINEA_EVM_CHAIN_ID = 59144;
export const MONAD_EVM_CHAIN_ID = 143;
export const POLYGON_EVM_CHAIN_ID = 137;
export const OPTIMISM_EVM_CHAIN_ID = 10;
export const BASE_EVM_CHAIN_ID = 8453;
export const AVALANCHE_EVM_CHAIN_ID = 43114;

/** Executor BSC Mainnet — native BNB. */
export const BSC_EXECUTOR_ADDRESS = "0x564abBC67F07C7621F86EABe25346eb5C5c81c7c";

/**
 * Fallback hardcode jika env kosong. Diutamakan
 * `process.env.NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR` (di-inline Next.js di client).
 */
export const ARBITRUM_EXECUTOR_ADDRESS = ARBITRUM_BALANCER_FLASH_ARB;

/**
 * Fallback hardcode Ethereum Mainnet jika
 * `NEXT_PUBLIC_ETHEREUM_ARBITRAGE_EXECUTOR` kosong.
 */
export const ETHEREUM_EXECUTOR_ADDRESS = ETHEREUM_BALANCER_FLASH_ARB;

/**
 * Executor Linea Mainnet. Sama dengan NEXT_PUBLIC_LINEA_ARBITRAGE_EXECUTOR
 * di .env.local. Env statis menang bila diisi; konstanta ini menjaga
 * pemanggilan transaksi tidak kosong saat bundle client belum melihat env.
 */
export const LINEA_EXECUTOR_ADDRESS = "0x564abBC67F07C7621F86EABe25346eb5C5c81c7c";

/**
 * Executor Monad Mainnet. Alamat yang sama dengan executor EVM standar
 * (BSC / Linea). Env statis menang bila diisi.
 */
export const MONAD_EXECUTOR_ADDRESS = "0x564abBC67F07C7621F86EABe25346eb5C5c81c7c";

/** Executor Polygon. Env statis menang; konstanta ini dipakai bila env kosong. */
export const POLYGON_EXECUTOR_ADDRESS = "0x9ad6dcbffa0b3865b12b296ec735b006c8c054a0";

/** Executor Optimism. Env statis menang; konstanta ini dipakai bila env kosong. */
export const OPTIMISM_EXECUTOR_ADDRESS = "0x969fdd49fcb3e70a164511ffb3ddb19aed0821d6";

/** Executor Base. Env statis menang; konstanta ini dipakai bila env kosong. */
export const BASE_EXECUTOR_ADDRESS = "0x9ad6dcbffa0b3865b12b296ec735b006c8c054a0";

/** Executor Avalanche. Env statis menang; konstanta ini dipakai bila env kosong. */
export const AVALANCHE_EXECUTOR_ADDRESS = "0x969fdd49fcb3e70a164511ffb3ddb19aed0821d6";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface ExecutorNetworkConfig {
  evmChainId: number;
  portalChain: "bsc" | "arbitrum" | "ethereum" | "polygon" | "optimism" | "base" | "avalanche" | "linea" | "monad";
  address: string;
  nativeSymbol: "BNB" | "ETH" | "POL" | "AVAX" | "MON";
  label: string;
  configured: boolean;
}

function isHexAddress(value: string | undefined): value is string {
  return Boolean(value && /^0x[0-9a-fA-F]{40}$/.test(value.trim()));
}

function isUsableExecutor(value: string | undefined): boolean {
  if (!isHexAddress(value)) return false;
  const lower = value.trim().toLowerCase();
  if (lower === ZERO_ADDRESS) return false;
  if (lower === BALANCER_V2_VAULT.toLowerCase()) return false;
  return true;
}

/** Baca env client Next.js: harus property statis `NEXT_PUBLIC_*`. */
export function resolveArbitrumExecutor(): string {
  const fromEnv = publicArbitrumArbitrageExecutor();
  if (isUsableExecutor(fromEnv)) return fromEnv.trim();
  const direct = process.env.NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(direct)) return direct;
  const flashArb = process.env.NEXT_PUBLIC_BALANCER_FLASH_ARB?.trim() ?? "";
  if (isUsableExecutor(flashArb)) return flashArb;
  if (isUsableExecutor(ARBITRUM_EXECUTOR_ADDRESS)) return ARBITRUM_EXECUTOR_ADDRESS;
  return ZERO_ADDRESS;
}

/** Executor Ethereum Mainnet dari NEXT_PUBLIC_ETHEREUM_* / fallback hardcode. */
export function resolveEthereumExecutor(): string {
  const fromEnv = publicEthereumArbitrageExecutor();
  if (isUsableExecutor(fromEnv)) return fromEnv.trim();
  const direct = process.env.NEXT_PUBLIC_ETHEREUM_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(direct)) return direct;
  const server = process.env.ETHEREUM_BALANCER_FLASH_ARB?.trim() ?? "";
  if (isUsableExecutor(server)) return server;
  if (isUsableExecutor(ETHEREUM_EXECUTOR_ADDRESS)) return ETHEREUM_EXECUTOR_ADDRESS;
  return ZERO_ADDRESS;
}

function bscConfig(): ExecutorNetworkConfig {
  return {
    evmChainId: BSC_EVM_CHAIN_ID,
    portalChain: "bsc",
    address: BSC_EXECUTOR_ADDRESS,
    nativeSymbol: "BNB",
    label: "BSC Mainnet",
    configured: true,
  };
}

function arbitrumConfig(): ExecutorNetworkConfig {
  const address = resolveArbitrumExecutor();
  return {
    evmChainId: ARBITRUM_EVM_CHAIN_ID,
    portalChain: "arbitrum",
    address,
    nativeSymbol: "ETH",
    label: "Arbitrum One",
    configured: isUsableExecutor(address),
  };
}

/** Executor Linea dari NEXT_PUBLIC_LINEA_ARBITRAGE_EXECUTOR, lalu konstanta. */
export function resolveLineaExecutor(): string {
  const fromEnv = publicLineaArbitrageExecutor();
  if (isUsableExecutor(fromEnv)) return fromEnv.trim();
  const direct = process.env.NEXT_PUBLIC_LINEA_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(direct)) return direct;
  const server = process.env.LINEA_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(server)) return server;
  if (isUsableExecutor(LINEA_EXECUTOR_ADDRESS)) return LINEA_EXECUTOR_ADDRESS;
  return "";
}

function lineaConfig(): ExecutorNetworkConfig {
  const address = resolveLineaExecutor();
  return {
    evmChainId: LINEA_EVM_CHAIN_ID,
    portalChain: "linea",
    address,
    nativeSymbol: "ETH",
    label: "Linea Mainnet",
    configured: isUsableExecutor(address),
  };
}

/** Executor Monad dari NEXT_PUBLIC_MONAD_ARBITRAGE_EXECUTOR, lalu konstanta. */
export function resolveMonadExecutor(): string {
  const fromEnv = publicMonadArbitrageExecutor();
  if (isUsableExecutor(fromEnv)) return fromEnv.trim();
  const direct = process.env.NEXT_PUBLIC_MONAD_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(direct)) return direct;
  const server = process.env.MONAD_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(server)) return server;
  if (isUsableExecutor(MONAD_EXECUTOR_ADDRESS)) return MONAD_EXECUTOR_ADDRESS;
  return "";
}

/** Executor Polygon dari NEXT_PUBLIC_POLYGON_ARBITRAGE_EXECUTOR, lalu konstanta. */
export function resolvePolygonExecutor(): string {
  const fromEnv = publicPolygonArbitrageExecutor();
  if (isUsableExecutor(fromEnv)) return fromEnv.trim();
  const direct = process.env.NEXT_PUBLIC_POLYGON_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(direct)) return direct;
  const server = process.env.POLYGON_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(server)) return server;
  if (isUsableExecutor(POLYGON_EXECUTOR_ADDRESS)) return POLYGON_EXECUTOR_ADDRESS;
  return "";
}

function polygonConfig(): ExecutorNetworkConfig {
  const address = resolvePolygonExecutor();
  return {
    evmChainId: POLYGON_EVM_CHAIN_ID,
    portalChain: "polygon",
    address,
    nativeSymbol: "POL",
    label: "Polygon Mainnet",
    configured: isUsableExecutor(address),
  };
}

/** Executor Optimism dari NEXT_PUBLIC_OPTIMISM_ARBITRAGE_EXECUTOR, lalu konstanta. */
export function resolveOptimismExecutor(): string {
  const fromEnv = publicOptimismArbitrageExecutor();
  if (isUsableExecutor(fromEnv)) return fromEnv.trim();
  const direct = process.env.NEXT_PUBLIC_OPTIMISM_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(direct)) return direct;
  const server = process.env.OPTIMISM_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(server)) return server;
  if (isUsableExecutor(OPTIMISM_EXECUTOR_ADDRESS)) return OPTIMISM_EXECUTOR_ADDRESS;
  return "";
}

function optimismConfig(): ExecutorNetworkConfig {
  const address = resolveOptimismExecutor();
  return {
    evmChainId: OPTIMISM_EVM_CHAIN_ID,
    portalChain: "optimism",
    address,
    nativeSymbol: "ETH",
    label: "Optimism Mainnet",
    configured: isUsableExecutor(address),
  };
}

/** Executor Base dari NEXT_PUBLIC_BASE_ARBITRAGE_EXECUTOR, lalu konstanta. */
export function resolveBaseExecutor(): string {
  const fromEnv = publicBaseArbitrageExecutor();
  if (isUsableExecutor(fromEnv)) return fromEnv.trim();
  const direct = process.env.NEXT_PUBLIC_BASE_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(direct)) return direct;
  const server = process.env.BASE_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(server)) return server;
  if (isUsableExecutor(BASE_EXECUTOR_ADDRESS)) return BASE_EXECUTOR_ADDRESS;
  return "";
}

function baseConfig(): ExecutorNetworkConfig {
  const address = resolveBaseExecutor();
  return {
    evmChainId: BASE_EVM_CHAIN_ID,
    portalChain: "base",
    address,
    nativeSymbol: "ETH",
    label: "Base Mainnet",
    configured: isUsableExecutor(address),
  };
}

/** Executor Avalanche dari NEXT_PUBLIC_AVALANCHE_ARBITRAGE_EXECUTOR, lalu konstanta. */
export function resolveAvalancheExecutor(): string {
  const fromEnv = publicAvalancheArbitrageExecutor();
  if (isUsableExecutor(fromEnv)) return fromEnv.trim();
  const direct = process.env.NEXT_PUBLIC_AVALANCHE_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(direct)) return direct;
  const server = process.env.AVALANCHE_ARBITRAGE_EXECUTOR?.trim() ?? "";
  if (isUsableExecutor(server)) return server;
  if (isUsableExecutor(AVALANCHE_EXECUTOR_ADDRESS)) return AVALANCHE_EXECUTOR_ADDRESS;
  return "";
}

function avalancheConfig(): ExecutorNetworkConfig {
  const address = resolveAvalancheExecutor();
  return {
    evmChainId: AVALANCHE_EVM_CHAIN_ID,
    portalChain: "avalanche",
    address,
    nativeSymbol: "AVAX",
    label: "Avalanche C-Chain",
    configured: isUsableExecutor(address),
  };
}

function monadConfig(): ExecutorNetworkConfig {
  const address = resolveMonadExecutor();
  return {
    evmChainId: MONAD_EVM_CHAIN_ID,
    portalChain: "monad",
    address,
    nativeSymbol: "MON",
    label: "Monad Mainnet",
    configured: isUsableExecutor(address),
  };
}

function ethereumConfig(): ExecutorNetworkConfig {
  const address = resolveEthereumExecutor();
  return {
    evmChainId: ETHEREUM_EVM_CHAIN_ID,
    portalChain: "ethereum",
    address,
    nativeSymbol: "ETH",
    label: "Ethereum Mainnet",
    configured: isUsableExecutor(address),
  };
}

/** Mapping executor + native per Chain ID yang aktif di MetaMask. */
export const EXECUTOR_BY_CHAIN_ID: Record<number, ExecutorNetworkConfig> = {
  [ETHEREUM_EVM_CHAIN_ID]: ethereumConfig(),
  [OPTIMISM_EVM_CHAIN_ID]: optimismConfig(),
  [POLYGON_EVM_CHAIN_ID]: polygonConfig(),
  [BASE_EVM_CHAIN_ID]: baseConfig(),
  [ARBITRUM_EVM_CHAIN_ID]: arbitrumConfig(),
  [AVALANCHE_EVM_CHAIN_ID]: avalancheConfig(),
  [BSC_EVM_CHAIN_ID]: bscConfig(),
  [LINEA_EVM_CHAIN_ID]: lineaConfig(),
  [MONAD_EVM_CHAIN_ID]: monadConfig(),
};

export function portalChainFromEvmId(evmChainId: number | null): ChainId | null {
  switch (evmChainId) {
    case 1:
      return "ethereum";
    case 137:
      return "polygon";
    case ARBITRUM_EVM_CHAIN_ID:
      return "arbitrum";
    case 10:
      return "optimism";
    case 43114:
      return "avalanche";
    case 8453:
      return "base";
    case 59144:
      return "linea";
    case MONAD_EVM_CHAIN_ID:
      return "monad";
    case BSC_EVM_CHAIN_ID:
      return "bsc";
    case 9001:
      return "cosmos";
    default:
      return null;
  }
}

export function executorConfigForChainId(evmChainId: number | null): ExecutorNetworkConfig | null {
  if (evmChainId == null) return null;
  if (evmChainId === ETHEREUM_EVM_CHAIN_ID) return ethereumConfig();
  if (evmChainId === ARBITRUM_EVM_CHAIN_ID) return arbitrumConfig();
  if (evmChainId === BSC_EVM_CHAIN_ID) return bscConfig();
  if (evmChainId === LINEA_EVM_CHAIN_ID) return lineaConfig();
  if (evmChainId === MONAD_EVM_CHAIN_ID) return monadConfig();
  if (evmChainId === POLYGON_EVM_CHAIN_ID) return polygonConfig();
  if (evmChainId === OPTIMISM_EVM_CHAIN_ID) return optimismConfig();
  if (evmChainId === BASE_EVM_CHAIN_ID) return baseConfig();
  if (evmChainId === AVALANCHE_EVM_CHAIN_ID) return avalancheConfig();
  return EXECUTOR_BY_CHAIN_ID[evmChainId] ?? null;
}

export function executorAddressForChainId(evmChainId: number | null): string {
  const config = executorConfigForChainId(evmChainId);
  return config?.configured ? config.address : "";
}

export function isExecutorConfigured(config: ExecutorNetworkConfig | null): boolean {
  return Boolean(config?.configured && isUsableExecutor(config.address));
}
