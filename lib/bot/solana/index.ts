/**
 * Modul Solana — scanner (Ankr), executor (QuickNode), Kamino, worker mandiri.
 * Import bertarget: client hanya dari kaminoConstants / pairs; worker hanya di server.
 * @module lib/bot/solana
 */
export {
  SOLANA_KAMINO_FLASH_FEE_PCT,
  SOLANA_POPULAR_PAIR_IDS,
  defaultSolanaPairIds,
  solanaPopularPairs,
  type SolanaPopularPairId,
} from "@/lib/bot/solana/pairs";

export {
  KAMINO_FLASH_CHAIN_ID,
  KAMINO_FLASH_FEE_PCT,
  KAMINO_FLASH_LOAN_SOURCE,
  KAMINO_KLEND_PROGRAM_ID,
  isKaminoFlashProvider,
  kaminoFlashFeeUsd,
  kaminoFlashFeeWei,
} from "@/lib/bot/solana/kaminoConstants";

export {
  kaminoFlashLoanEndpoint,
  resolveKaminoFlashLoanRoute,
  type KaminoFlashLoanRoute,
} from "@/lib/bot/solana/kamino";

export {
  fetchSolanaSlot,
  scanSolanaOpportunities,
  solanaScannerEndpoints,
} from "@/lib/bot/solana/scanner";

export {
  describeSolanaExecutor,
  fetchSolanaExecutorSlot,
  openSolanaExecutorSlotStream,
  pingSolanaExecutor,
  requireSolanaExecutorRpcUrl,
  solanaExecutorRpc,
  solanaExecutorRpcUrl,
  solanaExecutorWsUrl,
  submitSolanaSignedTx,
} from "@/lib/bot/solana/executor";

export {
  describeSolanaWorker,
  runSolanaWorker,
  type SolanaWorkerResult,
} from "@/lib/bot/solana/worker";

export {
  ensureSolanaLiveSlotMonitor,
  peekSolanaLiveSlot,
} from "@/lib/bot/solana/liveSlot";

export {
  fetchSolUsdPrice,
  jupiterQuote,
  quoteOnVenue,
  SOLANA_DEX_VENUES,
} from "@/lib/bot/solana/quotes";

export {
  fetchSolanaVaultBalances,
  solanaVaultAddress,
  solanaSignerAddress,
} from "@/lib/bot/solana/balances";

export {
  resolveSolanaPriorityFeeMicroLamports,
  resolveSolanaGasPriceWei,
  SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS,
} from "@/lib/bot/solana/priorityFee";

export {
  executeSolanaLiveArb,
  type SolanaLiveExecResult,
} from "@/lib/bot/solana/executeLive";

export {
  solanaAutonomousSignerStatus,
  formatSolanaSignerLine,
  loadSolanaSecretKey,
  solanaPrivateKeyEnvOrder,
} from "@/lib/bot/solana/signer";
