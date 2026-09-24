import {
  ARBITRUM_BALANCER_FLASH_ARB,
  BALANCER_V2_VAULT,
  ETHEREUM_BALANCER_FLASH_ARB,
} from "@/config/networks";

function publicEnv(key: string): string {
  const value = process.env[key]?.trim() ?? "";
  if (/ankr\.com/i.test(value)) return "";
  return value;
}

/** Provider utama (Primary) — HTTP JSON-RPC. */
export function publicBscRpcUrl(): string {
  return publicEnv("NEXT_PUBLIC_BSC_RPC_URL");
}

/** Provider cadangan (Fallback) — HTTP JSON-RPC. */
export function publicBscRpcUrlFallback(): string {
  return publicEnv("NEXT_PUBLIC_BSC_RPC_URL_2");
}

/** Provider utama (Primary) — WebSocket. */
export function publicBscWsUrl(): string {
  return publicEnv("NEXT_PUBLIC_BSC_WS_URL");
}

/** Provider cadangan (Fallback) — WebSocket. */
export function publicBscWsUrlFallback(): string {
  return publicEnv("NEXT_PUBLIC_BSC_WS_URL_2");
}

export function publicArbitrumRpcUrl(): string {
  return publicEnv("NEXT_PUBLIC_ARBITRUM_RPC_URL");
}

export function publicArbitrumRpcUrlFallback(): string {
  return publicEnv("NEXT_PUBLIC_ARBITRUM_RPC_URL_2");
}

export function publicArbitrumWsUrl(): string {
  return publicEnv("NEXT_PUBLIC_ARBITRUM_WS_URL");
}

export function publicArbitrumWsUrlFallback(): string {
  return publicEnv("NEXT_PUBLIC_ARBITRUM_WS_URL_2");
}

export function publicBscArbitrageExecutor(): string {
  return (
    process.env.NEXT_PUBLIC_BSC_ARBITRAGE_EXECUTOR ??
    process.env.NEXT_PUBLIC_BSC_VAULT_CONTRACT ??
    ""
  );
}

export function publicBscFlashLoanPool(): string {
  return (
    process.env.NEXT_PUBLIC_BSC_FLASH_LOAN_POOL ??
    process.env.NEXT_PUBLIC_BSC_VAULT_CONTRACT ??
    ""
  );
}

export function publicBscVaultContract(): string {
  return (
    process.env.NEXT_PUBLIC_BSC_VAULT_CONTRACT ??
    process.env.NEXT_PUBLIC_BSC_ARBITRAGE_EXECUTOR ??
    ""
  );
}

export function publicArbitrumArbitrageExecutor(): string {
  const value = (
    process.env.NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR ??
    process.env.NEXT_PUBLIC_BALANCER_FLASH_ARB ??
    ARBITRUM_BALANCER_FLASH_ARB
  ).trim();
  if (!value || value.toLowerCase() === BALANCER_V2_VAULT.toLowerCase()) {
    return ARBITRUM_BALANCER_FLASH_ARB;
  }
  return value;
}

/** Executor flashloan Ethereum Mainnet (bukan Balancer Vault 0xBA12…). */
export function publicEthereumArbitrageExecutor(): string {
  const value = (
    process.env.NEXT_PUBLIC_ETHEREUM_ARBITRAGE_EXECUTOR ??
    process.env.ETHEREUM_BALANCER_FLASH_ARB ??
    ETHEREUM_BALANCER_FLASH_ARB
  ).trim();
  if (!value || value.toLowerCase() === BALANCER_V2_VAULT.toLowerCase()) {
    return ETHEREUM_BALANCER_FLASH_ARB;
  }
  return value;
}

/**
 * Nomor blok EVM sah (Arbitrum ~5e8). Tolak subscription id / hash yang
 * jika di-parse jadi 2.68e+38 dan membuat scanner macet.
 */
const MAX_EVM_BLOCK = 1_000_000_000_000;

export function parseBlockNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "bigint") {
    if (value <= 0n || value > BigInt(MAX_EVM_BLOCK)) return 0;
    return Number(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0 || value > MAX_EVM_BLOCK) return 0;
    return Math.trunc(value);
  }
  if (typeof value !== "string") return 0;
  const raw = value.trim();
  if (!raw) return 0;
  try {
    let parsed: bigint;
    if (/^0x[0-9a-fA-F]+$/i.test(raw)) {
      parsed = BigInt(raw);
    } else if (/^[0-9]+$/.test(raw)) {
      parsed = BigInt(raw);
    } else if (/^[0-9]*\.?[0-9]+e[+-]?[0-9]+$/i.test(raw)) {
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0 || n > MAX_EVM_BLOCK) return 0;
      return Math.trunc(n);
    } else {
      return 0;
    }
    if (parsed <= 0n || parsed > BigInt(MAX_EVM_BLOCK)) return 0;
    return Number(parsed);
  } catch {
    return 0;
  }
}

export function parseHexBlock(value: unknown): number {
  return parseBlockNumber(value);
}
