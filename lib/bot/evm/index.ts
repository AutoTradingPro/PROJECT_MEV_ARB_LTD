/**
 * Modul EVM (cadangan) — jalur Ethereum / L2 tetap di sini agar tidak bercampur Solana.
 * Implementasi inti masih di lib/bot/*; barrel ini mengekspor API EVM secara tegas.
 * @module lib/bot/evm
 */
export { simulateThenSubmit, simulateOpportunity } from "@/lib/bot/executor";
export { executeOpportunityAutonomous } from "@/lib/bot/autonomousExecute";
export {
  autonomousSignerStatus,
  formatAutonomousSignerLine,
  sendAutonomousContractTx,
} from "@/lib/bot/privateSigner";
export { submitPrivateRawTx } from "@/lib/bot/privateSubmit";
export { buildExecuteCalldata } from "@/lib/bot/encodeArb";
export { preflightExecuteCall, simulateEncodedCall } from "@/lib/bot/simulate";
export {
  makeWriteProvider,
  privateExecutorRpcUrl,
  requireExecutorRpcUrl,
  resolveWriteRpcUrl,
  describeExecutorPath,
} from "@/lib/bot/dualProvider";
export { runEvmWorker, describeEvmWorker, isEvmChainId } from "@/lib/bot/evm/worker";
