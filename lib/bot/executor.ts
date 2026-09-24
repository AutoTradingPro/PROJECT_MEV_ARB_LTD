import { simulateFlashArb } from "./simulate";
import { submitPrivateRawTx } from "./privateSubmit";
import { buildExecuteCalldata } from "./encodeArb";
import { contractAddressFromEnv } from "./constants";
import { appendTrade, readBotState } from "./store";
import type { Opportunity } from "./types";

export async function simulateThenSubmit(input: {
  contract: string;
  owner: string;
  pair: string;
  amount0Out: bigint;
  amount1Out: bigint;
  callbackData: string;
  signedRawTx?: string;
  useBundle?: boolean;
}): Promise<{ simulated: boolean; txHash?: string; reason?: string }> {
  const sim = await simulateFlashArb(input);
  if (!sim.ok) return { simulated: false, reason: sim.reason };
  if (!input.signedRawTx) {
    return { simulated: true, reason: "Simulasi lolos. Raw tx belum ditandatangani." };
  }
  const chainId = (await readBotState()).config.chainId;
  const txHash = await submitPrivateRawTx(input.signedRawTx, {
    useBundle: input.useBundle,
    chainId: chainId === "polygon" || chainId === "ethereum" || chainId === "arbitrum" ? chainId : "arbitrum",
  });
  return { simulated: true, txHash };
}

export async function simulateOpportunity(
  opportunityId?: string,
  withdrawTo?: string
): Promise<{
  simulated: boolean;
  reason?: string;
  opportunity?: Opportunity;
}> {
  const state = await readBotState();
  const opp =
    state.opportunities.find((item) => item.id === opportunityId) ??
    state.opportunities.find((item) => item.status === "ready");

  if (!opp) {
    return { simulated: false, reason: "Tidak ada peluang siap. Jalankan Scan dulu." };
  }
  if (state.killed) {
    return { simulated: false, reason: "Bot dalam status DIMATIKAN." };
  }

  const contractAddress = contractAddressFromEnv(state.config.chainId);
  if (!contractAddress) {
    await appendTrade({
      id: `${Date.now()}`,
      at: new Date().toISOString(),
      pair: opp.tokenPair,
      route: `${opp.buyExchange} → ${opp.sellExchange}`,
      netProfitWei: opp.netProfitWei,
      outcome: "skipped",
    });
    return {
      simulated: false,
      reason:
        "Set NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR / NEXT_PUBLIC_BALANCER_FLASH_ARB (atau executor BSC) di .env.local.",
      opportunity: opp,
    };
  }

  const payoutAddress = withdrawTo || process.env.OWNER_ADDRESS || "";
  if (!payoutAddress) {
    return {
      simulated: false,
      reason: "Hubungkan dompet MetaMask agar alamat withdraw tersedia.",
      opportunity: opp,
    };
  }

  const built = buildExecuteCalldata(opp, state.config, payoutAddress);
  if (!built) {
    return { simulated: false, reason: "Calldata tidak bisa disusun (pair flash kosong / DEX tidak valid)." };
  }

  const owner = process.env.OWNER_ADDRESS || payoutAddress;
  const result = await simulateThenSubmit({
    contract: built.to,
    owner,
    pair: built.pair,
    amount0Out: BigInt(opp.amount0Out || "0"),
    amount1Out: BigInt(opp.amount1Out || "0"),
    callbackData: built.callback,
    useBundle: state.config.useBundle,
  });

  await appendTrade({
    id: `${Date.now()}`,
    at: new Date().toISOString(),
    pair: opp.tokenPair,
    route: `${opp.buyExchange} → ${opp.sellExchange}`,
    netProfitWei: opp.netProfitWei,
    txHash: result.txHash,
    outcome: result.simulated ? "skipped" : "reverted",
  });

  return { ...result, opportunity: opp };
}
