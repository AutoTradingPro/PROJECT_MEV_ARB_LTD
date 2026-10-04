import {
  AMM_LOAN_OF_POOL_RATIO,
  V3_LOAN_OF_POOL_RATIO,
} from "@/lib/bot/adaptiveMinProfit";
import { KAMINO_FLASH_FEE_PCT, KAMINO_KLEND_PROGRAM_ID } from "@/lib/bot/solana/kaminoConstants";
import {
  ARBITRUM_BALANCER_FLASH_ARB,
  BALANCER_V2_VAULT,
  ETHEREUM_BALANCER_FLASH_ARB,
  type TradingChainId,
} from "@/config/networks";
import {
  bestFlashloanForTradingChain,
  feePpmToPct,
} from "@/src/flashloan/globalProviderSelector";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Vault Balancer V2 (CREATE2) yang benar-benar terpasang di chain ini. */
const CANONICAL_BALANCER_CHAINS = new Set<TradingChainId>(["ethereum", "polygon", "arbitrum"]);

export interface EvmExecutorActivation {
  chainId: TradingChainId;
  evmChainId: number;
  label: string;
  nativeSymbol: string;
  envKeys: readonly string[];
  /** Alamat yang sudah dikenal. Kosong sampai env / deploy diisi. */
  fallbackAddress: string;
  flashloanProviderId: string;
  flashloanName: string;
  feePpm: number;
  feePct: number;
  flashPool: string;
  v3LoanPct: number;
  ammLoanPct: number;
}

const EVM_ROWS: Array<Omit<EvmExecutorActivation, "flashloanProviderId" | "flashloanName" | "feePpm" | "feePct" | "flashPool" | "v3LoanPct" | "ammLoanPct">> = [
  {
    chainId: "ethereum",
    evmChainId: 1,
    label: "Ethereum",
    nativeSymbol: "ETH",
    envKeys: ["NEXT_PUBLIC_ETHEREUM_ARBITRAGE_EXECUTOR", "ETHEREUM_BALANCER_FLASH_ARB", "BALANCER_FLASH_ARB_ETHEREUM"],
    fallbackAddress: ETHEREUM_BALANCER_FLASH_ARB,
  },
  {
    chainId: "optimism",
    evmChainId: 10,
    label: "Optimism",
    nativeSymbol: "ETH",
    envKeys: ["NEXT_PUBLIC_OPTIMISM_ARBITRAGE_EXECUTOR", "OPTIMISM_ARBITRAGE_EXECUTOR"],
    fallbackAddress: "",
  },
  {
    chainId: "polygon",
    evmChainId: 137,
    label: "Polygon",
    nativeSymbol: "POL",
    envKeys: ["NEXT_PUBLIC_POLYGON_ARBITRAGE_EXECUTOR", "POLYGON_BALANCER_FLASH_ARB", "BALANCER_FLASH_ARB_POLYGON"],
    fallbackAddress: "",
  },
  {
    chainId: "base",
    evmChainId: 8453,
    label: "Base",
    nativeSymbol: "ETH",
    envKeys: ["NEXT_PUBLIC_BASE_ARBITRAGE_EXECUTOR", "BASE_ARBITRAGE_EXECUTOR"],
    fallbackAddress: "",
  },
  {
    chainId: "bsc",
    evmChainId: 56,
    label: "BNB Chain",
    nativeSymbol: "BNB",
    envKeys: [
      "NEXT_PUBLIC_BSC_ARBITRAGE_EXECUTOR",
      "NEXT_PUBLIC_BSC_VAULT_CONTRACT",
      "CONTRACT_ADDRESS",
      "NEXT_PUBLIC_CONTRACT_ADDRESS",
    ],
    fallbackAddress: "0x564abBC67F07C7621F86EABe25346eb5C5c81c7c",
  },
  {
    chainId: "avalanche",
    evmChainId: 43114,
    label: "Avalanche",
    nativeSymbol: "AVAX",
    envKeys: ["NEXT_PUBLIC_AVALANCHE_ARBITRAGE_EXECUTOR", "AVALANCHE_ARBITRAGE_EXECUTOR"],
    fallbackAddress: "",
  },
  {
    chainId: "fantom",
    evmChainId: 250,
    label: "Fantom",
    nativeSymbol: "FTM",
    envKeys: ["NEXT_PUBLIC_FANTOM_ARBITRAGE_EXECUTOR", "FANTOM_ARBITRAGE_EXECUTOR"],
    fallbackAddress: "",
  },
  {
    chainId: "linea",
    evmChainId: 59144,
    label: "Linea",
    nativeSymbol: "ETH",
    envKeys: ["NEXT_PUBLIC_LINEA_ARBITRAGE_EXECUTOR", "LINEA_ARBITRAGE_EXECUTOR"],
    fallbackAddress: "",
  },
  {
    chainId: "arbitrum",
    evmChainId: 42161,
    label: "Arbitrum",
    nativeSymbol: "ETH",
    envKeys: ["NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR", "NEXT_PUBLIC_BALANCER_FLASH_ARB", "BALANCER_FLASH_ARB"],
    fallbackAddress: ARBITRUM_BALANCER_FLASH_ARB,
  },
];

function usableExecutor(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  return lower !== ZERO_ADDRESS && lower !== BALANCER_V2_VAULT.toLowerCase();
}

function flashFields(chainId: TradingChainId): Pick<
  EvmExecutorActivation,
  "flashloanProviderId" | "flashloanName" | "feePpm" | "feePct" | "flashPool"
> {
  const best = bestFlashloanForTradingChain(chainId);
  const id = best?.id ?? "";
  const pool = id === "balancer-v2" && CANONICAL_BALANCER_CHAINS.has(chainId) ? BALANCER_V2_VAULT : "";
  return {
    flashloanProviderId: id,
    flashloanName: best?.name ?? "",
    feePpm: best?.feePpm ?? 0,
    feePct: best ? feePpmToPct(best.feePpm) : 0,
    flashPool: pool,
  };
}

export function evmExecutorActivations(): EvmExecutorActivation[] {
  return EVM_ROWS.map((row) => ({
    ...row,
    ...flashFields(row.chainId),
    v3LoanPct: V3_LOAN_OF_POOL_RATIO * 100,
    ammLoanPct: AMM_LOAN_OF_POOL_RATIO * 100,
  }));
}

export function evmExecutorActivation(chainId: string | undefined): EvmExecutorActivation | null {
  const key = (chainId || "").trim().toLowerCase();
  return evmExecutorActivations().find((row) => row.chainId === key) ?? null;
}

export function resolveEvmExecutorAddress(chainId: string | undefined): string {
  const row = evmExecutorActivation(chainId);
  if (!row) return "";
  for (const key of row.envKeys) {
    const value = process.env[key]?.trim() ?? "";
    if (usableExecutor(value)) return value;
  }
  return usableExecutor(row.fallbackAddress) ? row.fallbackAddress : "";
}

export function resolveEvmFlashPool(chainId: string | undefined): string {
  const row = evmExecutorActivation(chainId);
  if (!row) return "";
  const override = process.env[`${row.chainId.toUpperCase()}_FLASH_LOAN_POOL`]?.trim() ?? "";
  if (/^0x[0-9a-fA-F]{40}$/.test(override)) return override;
  return row.flashPool;
}

export const SOLANA_PROGRAM_CHECK = {
  chainId: "solana" as const,
  programId: KAMINO_KLEND_PROGRAM_ID,
  provider: "Kamino K-Lend",
  feePct: KAMINO_FLASH_FEE_PCT,
  /** Quote Jupiter mencampur CLMM dan AMM, jadi loan mengikuti rasio V3. */
  loanPct: V3_LOAN_OF_POOL_RATIO * 100,
  loanReason: "Venue Jupiter (Raydium/Orca/Meteora) mencampur CLMM dan AMM. Rasio V3 2% dipakai agar kaki terkonsentrasi tidak kebesaran.",
};
