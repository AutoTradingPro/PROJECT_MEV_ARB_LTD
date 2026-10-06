/**
 * Worker EVM (cadangan) — scan/exec jalur Ethereum & L2, independen dari Solana.
 */
import { scanOpportunities } from "@/lib/bot/scanner";
import { updateConfig } from "@/lib/bot/store";
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import { describeExecutorPath, requireExecutorRpcUrl } from "@/lib/bot/dualProvider";
import type { ChainId } from "@/lib/chain/networks";

const EVM_CHAINS = new Set<ChainId>([
  "ethereum",
  "arbitrum",
  "polygon",
  "optimism",
  "avalanche",
  "base",
  "bsc",
  "monad",
]);

export function isEvmChainId(chainId: string | undefined | null): boolean {
  return Boolean(chainId && EVM_CHAINS.has(chainId as ChainId));
}

export interface EvmWorkerResult {
  chainId: ChainId;
  opportunities: Opportunity[];
  elapsedMs: number;
  executor: ReturnType<typeof describeExecutorPath>;
}

/**
 * Jalankan siklus scan EVM. Menolak chain Solana agar tidak bentrok dengan worker Solana.
 */
export async function runEvmWorker(input?: {
  chainId?: ChainId;
  config?: Partial<BotConfig>;
  pairIds?: string[];
  scanMode?: "single" | "full";
}): Promise<EvmWorkerResult> {
  const started = Date.now();
  const chainId = (input?.chainId || input?.config?.chainId || "arbitrum") as ChainId;
  if (chainId === "solana" || !isEvmChainId(chainId)) {
    throw new Error(
      `[EVM-WORKER] chain=${chainId} bukan EVM — gunakan runSolanaWorker / lib/bot/solana.`
    );
  }

  if (input?.config || chainId) {
    await updateConfig({ ...input?.config, chainId });
  }

  const opportunities = await scanOpportunities({
    pairIds: input?.pairIds,
    scanMode: input?.scanMode,
  });

  const elapsedMs = Date.now() - started;
  const executor = describeExecutorPath(chainId);
  console.log(
    `[EVM-WORKER] ${chainId} · ${opportunities.length} opp · ${elapsedMs}ms · write=${executor.privateWrite ? "QuickNode" : "public"}`
  );

  return { chainId, opportunities, elapsedMs, executor };
}

export function describeEvmWorker(chainId: ChainId = "arbitrum"): {
  module: "evm";
  chainId: ChainId;
  executorRpc: string;
  path: ReturnType<typeof describeExecutorPath>;
} {
  let executorRpc = "";
  try {
    executorRpc = requireExecutorRpcUrl(chainId);
  } catch {
    executorRpc = "";
  }
  return {
    module: "evm",
    chainId,
    executorRpc,
    path: describeExecutorPath(chainId),
  };
}
