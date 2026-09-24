/**
 * Kamino Finance (K-Lend) flash loan — modul Solana (server).
 * Fee 0.001% · 10 pair populer di lib/bot/solana/pairs.ts.
 */
import {
  describeSolanaExecutor,
  requireSolanaExecutorRpcUrl,
  solanaExecutorWsUrl,
} from "@/lib/bot/solana/executor";
import {
  KAMINO_FLASH_CHAIN_ID,
  KAMINO_FLASH_FEE_PCT,
  KAMINO_FLASH_LOAN_SOURCE,
  KAMINO_KLEND_PROGRAM_ID,
  isKaminoFlashProvider,
  kaminoFlashFeeUsd,
  kaminoFlashFeeWei,
} from "@/lib/bot/solana/kaminoConstants";
import {
  SOLANA_POPULAR_PAIR_IDS,
  solanaPopularPairs,
} from "@/lib/bot/solana/pairs";

export {
  KAMINO_FLASH_CHAIN_ID,
  KAMINO_FLASH_FEE_PCT,
  KAMINO_FLASH_LOAN_SOURCE,
  KAMINO_KLEND_PROGRAM_ID,
  isKaminoFlashProvider,
  kaminoFlashFeeUsd,
  kaminoFlashFeeWei,
};

export interface KaminoFlashLoanRoute {
  providerId: "kamino";
  chainId: typeof KAMINO_FLASH_CHAIN_ID;
  programId: string;
  source: string;
  feePct: number;
  label: string;
  rpcCluster: "mainnet-beta";
  executorRpcUrl: string;
  executorWsUrl: string;
  popularPairIds: readonly string[];
}

export function resolveKaminoFlashLoanRoute(): KaminoFlashLoanRoute {
  const exec = describeSolanaExecutor();
  return {
    providerId: "kamino",
    chainId: KAMINO_FLASH_CHAIN_ID,
    programId: KAMINO_KLEND_PROGRAM_ID,
    source: KAMINO_FLASH_LOAN_SOURCE,
    feePct: KAMINO_FLASH_FEE_PCT,
    label: "Kamino Finance (K-Lend)",
    rpcCluster: "mainnet-beta",
    executorRpcUrl: exec.rpcUrl,
    executorWsUrl: exec.wsUrl,
    popularPairIds: SOLANA_POPULAR_PAIR_IDS,
  };
}

/**
 * Endpoint flash loan Solana — QuickNode executor (bukan Ankr scanner).
 * Server-only.
 */
export function kaminoFlashLoanEndpoint(): {
  cluster: "mainnet-beta";
  programId: string;
  source: string;
  feePct: number;
  rpcUrl: string;
  wsUrl: string;
  pairs: ReturnType<typeof solanaPopularPairs>;
} {
  const route = resolveKaminoFlashLoanRoute();
  return {
    cluster: route.rpcCluster,
    programId: route.programId,
    source: route.source,
    feePct: route.feePct,
    rpcUrl: route.executorRpcUrl || requireSolanaExecutorRpcUrl(),
    wsUrl: route.executorWsUrl || solanaExecutorWsUrl(),
    pairs: solanaPopularPairs(),
  };
}
