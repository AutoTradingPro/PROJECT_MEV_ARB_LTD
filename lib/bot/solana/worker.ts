/**
 * Worker Solana mandiri — Live Scan Ankr + exec QuickNode + Kamino 0.001%.
 */
import { formatRuntimeScanLine, scanPairHighlights, featuredScanRoute, readyOpportunityCount, minSpreadBpsFromConfig, describeSolanaNotReadyDetail } from "@/lib/bot/autoExecute";
import { orderOpportunitiesByPairList } from "@/lib/bot/opportunityOrder";
import { writeBotState, readBotState } from "@/lib/bot/store";
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import { redactEndpoint } from "@/lib/bot/rpc";
import { fetchSignerLiveBalances, rememberScanSignerBalances } from "@/lib/bot/signerBalances";
import {
  describeSolanaExecutor,
  pingSolanaExecutor,
  requireSolanaExecutorRpcUrl,
} from "@/lib/bot/solana/executor";
import { kaminoFlashLoanEndpoint, resolveKaminoFlashLoanRoute } from "@/lib/bot/solana/kamino";
import { defaultSolanaPairIds, SOLANA_POPULAR_PAIR_IDS } from "@/lib/bot/solana/pairs";
import { scanSolanaOpportunities, solanaScannerEndpoints } from "@/lib/bot/solana/scanner";
import { ensureSolanaLiveSlotMonitor } from "@/lib/bot/solana/liveSlot";

export interface SolanaWorkerResult {
  chainId: "solana";
  opportunities: Opportunity[];
  slot: number;
  executorSlot: number;
  elapsedMs: number;
  scanner: ReturnType<typeof solanaScannerEndpoints>;
  executor: ReturnType<typeof describeSolanaExecutor>;
  kamino: ReturnType<typeof resolveKaminoFlashLoanRoute>;
  liveFeed: "ws" | "http" | "offline";
  execArmed: boolean;
  signerBalances: Awaited<ReturnType<typeof fetchSignerLiveBalances>>;
}

function armQuickNodeExecutor(readyCount: number): boolean {
  try {
    const url = requireSolanaExecutorRpcUrl();
    if (readyCount > 0) {
      console.log(
        `[SOLANA-EXEC] ${readyCount} peluang valid · jalur QuickNode armed ${redactEndpoint(url)}`
      );
    } else {
      console.log(`[SOLANA-EXEC] QuickNode siap · menunggu spread ≥ min · ${redactEndpoint(url)}`);
    }
    return true;
  } catch (error) {
    console.warn(
      `[SOLANA-EXEC] belum armed: ${error instanceof Error ? error.message : "executor RPC kosong"}`
    );
    return false;
  }
}

/**
 * Jalankan satu siklus Live Scan Solana (independen dari EVM).
 */
export async function runSolanaWorker(input?: {
  config?: BotConfig;
  pairIds?: string[];
  scanMode?: "single" | "full";
  persist?: boolean;
}): Promise<SolanaWorkerResult> {
  const started = Date.now();
  const live = await ensureSolanaLiveSlotMonitor();
  const state = await readBotState().catch(() => null);
  const scanMode: "single" | "full" =
    input?.scanMode === "single" || input?.scanMode === "full"
      ? input.scanMode
      : input?.config?.scanMode === "single"
        ? "single"
        : "full";
  const config: BotConfig = {
    ...(state?.config as BotConfig),
    ...input?.config,
    chainId: "solana",
    scanMode,
    activeDexIds: input?.config?.activeDexIds?.length
      ? input.config.activeDexIds
      : ["raydium", "orca", "meteora"],
    flashLoanProvider:
      input?.config?.flashLoanProvider || state?.config?.flashLoanProvider || "kamino",
  };

  const pairIds =
    scanMode === "full"
      ? defaultSolanaPairIds(undefined)
      : defaultSolanaPairIds(input?.pairIds?.length ? input.pairIds : [config.pairId].filter(Boolean));

  const [{ opportunities, slot, scanner }, executorHealth] = await Promise.all([
    scanSolanaOpportunities({
      config,
      pairIds,
      fullCoverage: scanMode === "full",
    }),
    pingSolanaExecutor().catch(() => ({ ok: false as const, slot: 0, error: "ping gagal" })),
  ]);

  const ordered = orderOpportunitiesByPairList(opportunities, pairIds);
  const executor = describeSolanaExecutor();
  const kamino = resolveKaminoFlashLoanRoute();
  const readyCount = readyOpportunityCount(ordered);
  const execArmed = armQuickNodeExecutor(readyCount) && executorHealth.ok;
  const executorSlot = executorHealth.ok ? executorHealth.slot : 0;
  const elapsedMs = Date.now() - started;
  const highlights = scanPairHighlights(ordered);
  const highlight = highlights[0] ?? featuredScanRoute(ordered);
  const balances = await fetchSignerLiveBalances({
    chainId: "solana",
    quoteSymbol: highlight?.quoteSymbol || "USDC",
    baseSymbol: highlight?.baseSymbol || "SOL",
  }).catch(() => null);
  rememberScanSignerBalances(balances);

  if (!executorHealth.ok) {
    console.warn(
      `[SOLANA-EXEC] health check gagal: ${"error" in executorHealth ? executorHealth.error : "unknown"}`
    );
  }

  const minBps = minSpreadBpsFromConfig(config);
  const notReadyDetail =
    readyCount > 0 ? undefined : describeSolanaNotReadyDetail(ordered, minBps);

  console.log(
    formatRuntimeScanLine({
      sandbox: false,
      chainId: "solana",
      block: slot > 0 ? slot : live.slot,
      routes: ordered.length,
      ready: readyCount,
      maxSpreadBps: highlight?.spreadBps ?? 0,
      pair: highlight?.pair,
      dexIn: highlight?.dexIn,
      dexOut: highlight?.dexOut,
      pairHighlights: highlights,
      scannedPairLabels: ordered.map((o) => o.tokenPair),
      minSpreadBps: minBps,
      minPoolLiquidityUsd: config.minPoolLiquidityUsd,
      nativeSymbol: "SOL",
      nativeBalance: balances?.nativeFormatted,
      vaultEth: balances?.vaultEthFormatted,
      vaultUsdc: balances?.vaultUsdcFormatted,
      vaultUsdt: balances?.vaultUsdtFormatted,
      provider: `Kamino ${kamino.feePct}%`,
      notReadyDetail,
    })
  );

  console.log(
    `[SOLANA-WORKER] ${ordered.length}/${SOLANA_POPULAR_PAIR_IDS.length} pair · slot #${slot}` +
      ` · feed=${live.transport}` +
      (executorSlot > 0 ? ` · execSlot #${executorSlot}` : "") +
      ` · ${elapsedMs}ms · scan=${scanner.via} · exec=${executor.via}` +
      ` · Kamino ${kamino.feePct}% · execArmed=${execArmed}`
  );

  if (input?.persist !== false && state) {
    let gasPriceWei = state.gasPriceWei || "0";
    try {
      const { resolveSolanaGasPriceWei } = await import("@/lib/bot/solana/priorityFee");
      gasPriceWei = await resolveSolanaGasPriceWei();
    } catch {
      const { SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS } = await import(
        "@/lib/bot/solana/priorityFee"
      );
      gasPriceWei = SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS.toString();
    }
    await writeBotState({
      ...state,
      // Jangan paksa running:true — scan saja tidak mengaktifkan bot.
      lastBlock: slot > 0 ? slot : state.lastBlock,
      gasPriceWei,
      opportunities: ordered,
      lastError: execArmed ? undefined : state.lastError,
      config: {
        ...config,
        chainId: "solana",
        activeDexIds: ["raydium", "orca", "meteora"],
        flashLoanProvider: "kamino",
        scanMode,
      },
    });
  }

  return {
    chainId: "solana",
    opportunities: ordered,
    slot,
    executorSlot,
    elapsedMs,
    scanner,
    executor,
    kamino,
    liveFeed: live.transport,
    execArmed,
    signerBalances: balances,
  };
}

export function describeSolanaWorker(): {
  module: "solana";
  pairs: readonly string[];
  scanner: ReturnType<typeof solanaScannerEndpoints>;
  executor: ReturnType<typeof describeSolanaExecutor>;
  flash: ReturnType<typeof kaminoFlashLoanEndpoint>;
} {
  return {
    module: "solana",
    pairs: SOLANA_POPULAR_PAIR_IDS,
    scanner: solanaScannerEndpoints(),
    executor: describeSolanaExecutor(),
    flash: kaminoFlashLoanEndpoint(),
  };
}
