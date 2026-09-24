import {
  ARBITRUM_BALANCER_FLASH_ARB,
  BALANCER_V2_VAULT,
  ETHEREUM_BALANCER_FLASH_ARB,
} from "@/config/networks";
import {
  publicArbitrumArbitrageExecutor,
  publicEthereumArbitrageExecutor,
} from "@/lib/chain/publicEnv";
import type { ChainId } from "@/lib/chain/networks";

export const BSC_EVM_CHAIN_ID = 56;
export const ARBITRUM_EVM_CHAIN_ID = 42161;
export const ETHEREUM_EVM_CHAIN_ID = 1;

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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface ExecutorNetworkConfig {
  evmChainId: number;
  portalChain: "bsc" | "arbitrum" | "ethereum" | "polygon";
  address: string;
  nativeSymbol: "BNB" | "ETH" | "POL";
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
  [BSC_EVM_CHAIN_ID]: bscConfig(),
  [ARBITRUM_EVM_CHAIN_ID]: arbitrumConfig(),
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
    case BSC_EVM_CHAIN_ID:
      return "bsc";
    case 250:
      return "fantom";
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
  return EXECUTOR_BY_CHAIN_ID[evmChainId] ?? null;
}

export function executorAddressForChainId(evmChainId: number | null): string {
  const config = executorConfigForChainId(evmChainId);
  return config?.configured ? config.address : "";
}

export function isExecutorConfigured(config: ExecutorNetworkConfig | null): boolean {
  return Boolean(config?.configured && isUsableExecutor(config.address));
}
