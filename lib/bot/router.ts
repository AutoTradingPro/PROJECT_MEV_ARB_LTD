/**
 * Router bot modular — dispatch worker Solana vs EVM secara independen.
 * Solana: latensi rendah (Ankr scan + QuickNode exec), tanpa loop EVM.
 */
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import type { ChainId } from "@/lib/chain/networks";
import {
  describeSolanaWorker,
  runSolanaWorker,
  type SolanaWorkerResult,
} from "@/lib/bot/solana/worker";
import {
  describeEvmWorker,
  isEvmChainId,
  runEvmWorker,
  type EvmWorkerResult,
} from "@/lib/bot/evm/worker";

export type BotWorkerKind = "solana" | "evm";

export type BotWorkerResult =
  | (SolanaWorkerResult & { kind: "solana" })
  | (EvmWorkerResult & { kind: "evm" });

export function resolveWorkerKind(chainId?: string | null): BotWorkerKind {
  if (chainId === "solana") return "solana";
  return "evm";
}

/**
 * Panggil worker sesuai chain. Solana tidak masuk jalur EVM sama sekali.
 */
export async function runBotWorker(input?: {
  chainId?: ChainId | string;
  config?: Partial<BotConfig>;
  pairIds?: string[];
  scanMode?: "single" | "full";
  persist?: boolean;
}): Promise<BotWorkerResult> {
  const chainId = (input?.chainId || input?.config?.chainId || "arbitrum") as string;
  const kind = resolveWorkerKind(chainId);

  if (kind === "solana") {
    const scanMode = input?.scanMode === "single" ? "single" : "full";
    const result = await runSolanaWorker({
      config: {
        ...(input?.config as BotConfig | undefined),
        scanMode,
      },
      pairIds: input?.pairIds,
      scanMode,
      persist: input?.persist,
    });
    return { ...result, kind: "solana" };
  }

  if (!isEvmChainId(chainId)) {
    throw new Error(`[BOT-ROUTER] chain tidak dikenali: ${chainId}`);
  }

  const result = await runEvmWorker({
    chainId: chainId as ChainId,
    config: input?.config,
    pairIds: input?.pairIds,
    scanMode: input?.scanMode,
  });
  return { ...result, kind: "evm" };
}

export function describeBotModules(chainId: ChainId = "arbitrum") {
  return {
    solana: describeSolanaWorker(),
    evm: isEvmChainId(chainId)
      ? describeEvmWorker(chainId)
      : describeEvmWorker("arbitrum"),
  };
}

export type { Opportunity, SolanaWorkerResult, EvmWorkerResult };
