import { formatUnits, Wallet } from "ethers";
import { createJsonRpcProvider, redactEndpoint, withRpcFailover } from "@/lib/bot/rpc";
import { normalizeTradingChainId } from "@/config/networks";
import { getChain, type ChainId } from "@/lib/chain/networks";
import { tokenWeiToUsd } from "@/lib/bot/configUnits";
import { appendServerLog } from "@/lib/bot/serverLog";
import { extractTxHash, explorerTxUrl, failedTxLogLines, formatRevertTxLog, logRevertWithTxHash, attachTxHash } from "@/lib/chain/explorer";
import { ensureFreshBlock } from "@/lib/bot/blockFreshness";
import { isPreflightFailure, preflightDiagFromOpportunity, preflightExecuteCall } from "@/lib/bot/simulate";
import {
  clearRouteBlacklist,
  noteEmptySelectorRevert,
  routeBlacklistKey,
} from "@/lib/bot/routeBlacklist";
import {
  describeExecutorPath,
  makeReadProvider,
  makeWriteProvider,
  publicReadRpcUrl,
  resolveWriteRpcUrl,
} from "@/lib/bot/dualProvider";
import {
  ARBITRUM_GAS_AGGRESSIVENESS,
  calculateAggressiveGasArbitrum,
  FLASH_LOAN_GAS_CEILING,
  formatPriorityGwei,
} from "@/lib/bot/aggressiveGas";
import {
  dynamicTipBudgetEthWei,
  maxPriorityFeeFromTipBudget,
  resolveDynamicBribePercent,
} from "@/lib/bot/dynamicBribe";
import {
  maxFeeFromTxFees,
  SKIP_PROFIT_TOO_SMALL,
  validateAndExecuteArbitrage,
} from "@/lib/bot/profitThreshold";
import type { Opportunity } from "@/lib/bot/types";
import { toExecRevertLog } from "@/lib/bot/revertReason";
import {
  formatSolanaSignerLine,
  solanaAutonomousSignerStatus,
} from "@/lib/bot/solana/signer";

/** Owner/DEPLOYER yang di-hardcode di BalancerFlashArb.sol */
export const BALANCER_ARB_DEPLOYER = "0x05F41c27821793D28788b91161Bd7026027bc387";

const ANVIL_DEFAULT_0 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

function printExecTxHash(hash: string, chainId: ChainId): void {
  console.log(`[TX HASH] ${hash}`);
  console.log(`[EXEC] Tx Hash: ${hash}`);
  console.log(`[EXEC] ${explorerTxUrl(hash, chainId)}`);
}

function firstEnvNamed(keys: string[]): { value: string; source: string } {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return { value, source: key };
  }
  return { value: "", source: "" };
}

function envKeyOrder(chainId?: ChainId): string[] {
  if (chainId === "solana") {
    return ["PRIVATE_KEY_SOLANA", "EXECUTOR_PRIVATE_KEY_SOLANA"];
  }
  if (chainId === "arbitrum") {
    return ["PRIVATE_KEY_ARBITRUM", "EXECUTOR_PRIVATE_KEY_ARBITRUM"];
  }
  if (chainId === "polygon") {
    return ["PRIVATE_KEY_POLYGON", "EXECUTOR_PRIVATE_KEY_POLYGON"];
  }
  if (chainId === "ethereum") {
    return ["PRIVATE_KEY_ETHEREUM", "EXECUTOR_PRIVATE_KEY_ETHEREUM"];
  }
  return ["PRIVATE_KEY_BSC", "EXECUTOR_PRIVATE_KEY_BSC"];
}

/** Kunci hanya dibaca di server. Jangan expose ke client. */
export function readExecutorPrivateKey(chainId?: ChainId): string {
  if (chainId === "solana") {
    const { value } = firstEnvNamed(envKeyOrder("solana"));
    return value;
  }
  const { value } = firstEnvNamed(envKeyOrder(chainId));
  if (!value) return "";
  return value.startsWith("0x") ? value : `0x${value}`;
}

export function readExecutorPrivateKeySource(chainId?: ChainId): string {
  return firstEnvNamed(envKeyOrder(chainId)).source;
}

export function autonomousSignerStatus(chainId?: ChainId): {
  ready: boolean;
  address?: string;
  source?: string;
  expectedOwner?: string;
  matchesOwner?: boolean;
} {
  if (chainId === "solana") {
    const status = solanaAutonomousSignerStatus();
    return {
      ready: status.ready,
      address: status.address,
      source: status.source,
      matchesOwner: status.ready,
    };
  }
  const source = readExecutorPrivateKeySource(chainId);
  const key = readExecutorPrivateKey(chainId);
  if (!key) return { ready: false, source, expectedOwner: BALANCER_ARB_DEPLOYER };
  try {
    const wallet = new Wallet(key);
    const address = wallet.address;
    return {
      ready: true,
      address,
      source,
      expectedOwner: BALANCER_ARB_DEPLOYER,
      matchesOwner: address.toLowerCase() === BALANCER_ARB_DEPLOYER.toLowerCase(),
    };
  } catch {
    return { ready: false, source, expectedOwner: BALANCER_ARB_DEPLOYER };
  }
}

export function formatAutonomousSignerLine(chainId?: ChainId): string {
  if (chainId === "solana") {
    return formatSolanaSignerLine();
  }
  const status = autonomousSignerStatus(chainId);
  if (!status.ready || !status.address) {
    return `[SIGNER] chain=${chainId || "bsc"} · belum siap · isi ${envKeyOrder(chainId).join(" / ")} di .env.local`;
  }
  const anvil = status.address.toLowerCase() === ANVIL_DEFAULT_0.toLowerCase();
  const match = status.matchesOwner ? "cocok owner" : "BUKAN owner";
  const warn = anvil ? " · PERINGATAN=kunci Anvil/Hardhat default" : "";
  return `[SIGNER] chain=${chainId || "bsc"} · env=${status.source} · wallet=${status.address} · kontrak DEPLOYER/owner=${BALANCER_ARB_DEPLOYER} · ${match}${warn}`;
}

export function logAutonomousSigner(chainId?: ChainId): void {
  console.log(formatAutonomousSignerLine(chainId));
}

export async function sendAutonomousContractTx(input: {
  to: string;
  data: string;
  gasLimit: number;
  maxGasGwei: number;
  bumpPct?: number;
  chainId?: ChainId;
  detectedBlock?: number;
  opportunity?: Opportunity;
  minProfitUsd?: number;
  minSpreadBps?: number;
  dynamicBribePercent?: number;
  minerTipPct?: number;
  extreme?: boolean;
  useBundle?: boolean;
}): Promise<string> {
  const chainId = normalizeTradingChainId(input.chainId);
  const useBundle = input.useBundle !== false;
  const key = readExecutorPrivateKey(chainId);
  if (!key) {
    throw new Error(
      chainId === "polygon"
        ? "PRIVATE_KEY_POLYGON belum diisi di .env.local (kunci wallet owner kontrak)."
        : chainId === "arbitrum"
          ? "PRIVATE_KEY_ARBITRUM belum diisi di .env.local (kunci wallet owner kontrak)."
          : chainId === "ethereum"
            ? "PRIVATE_KEY_ETHEREUM belum diisi di .env.local (kunci wallet owner kontrak)."
            : "PRIVATE_KEY_BSC (atau EXECUTOR_PRIVATE_KEY) belum diisi di .env.local."
    );
  }
  const walletPreview = new Wallet(key);
  logAutonomousSigner(chainId);
  if (
    (chainId === "arbitrum" || chainId === "polygon" || chainId === "ethereum") &&
    walletPreview.address.toLowerCase() !== BALANCER_ARB_DEPLOYER.toLowerCase()
  ) {
    throw new Error(
      `NotOwner: signer ${walletPreview.address} bukan DEPLOYER/owner ${BALANCER_ARB_DEPLOYER}. ` +
        `Env yang terbaca: ${readExecutorPrivateKeySource(chainId)}. ` +
        `Isi kunci privat milik 0x05F41c... lalu restart npm run dev.`
    );
  }

  const chain = getChain(chainId);
  const networkId =
    chain.chainId ??
    (chainId === "polygon" ? 137 : chainId === "arbitrum" ? 42161 : chainId === "ethereum" ? 1 : 56);
  const path = describeExecutorPath(chainId, useBundle);
  const live = await withRpcFailover(chainId, async (endpoint) => {
    const provider = createJsonRpcProvider(endpoint, networkId);
    const fee = await provider.getFeeData();
    const networkGas = fee.gasPrice && fee.gasPrice > 0n ? fee.gasPrice : 0n;
    if (networkGas <= 0n) {
      throw new Error("timeout");
    }
    return { endpoint, networkGas };
  }).catch(() => {
    throw new Error("Gas price jaringan belum terbaca.");
  });

  const readProvider = makeReadProvider(chainId, live.endpoint);
  const writeUrl = resolveWriteRpcUrl(chainId, useBundle, publicReadRpcUrl(chainId) || live.endpoint);
  const writeProvider = makeWriteProvider(chainId, writeUrl);
  const wallet = new Wallet(key, writeProvider);
  console.log(useBundle ? "[EXEC MODE] Using Private Bundle" : "[EXEC MODE] Using Standard Queue");
  const networkGas = live.networkGas;
  const capWei =
    Number.isFinite(input.maxGasGwei) && input.maxGasGwei > 0
      ? BigInt(Math.ceil(input.maxGasGwei * 1e9))
      : null;
  if (capWei != null && networkGas > capWei) {
    throw new Error(
      `Gas jaringan ${(Number(networkGas) / 1e9).toFixed(2)} gwei melebihi batas ${input.maxGasGwei} gwei.`
    );
  }

  const bump = Math.max(0, Math.floor(input.bumpPct ?? 0));
  const aggressiveness = Math.max(ARBITRUM_GAS_AGGRESSIVENESS, 1 + bump / 100);

  const detectedBlock = input.detectedBlock ?? 0;
  if (detectedBlock > 0) {
    const latestHeader = await readProvider.getBlock("latest");
    const currentBlock =
      latestHeader && latestHeader.number != null
        ? Number(latestHeader.number)
        : await readProvider.getBlockNumber();
    const freshness = await ensureFreshBlock({
      detectedBlock,
      chainId,
      currentBlock,
      spreadBps: input.opportunity?.spreadBps,
      minSpreadBps: input.minSpreadBps,
      netProfitWei: input.opportunity?.netProfitWei,
      estimatedProfitWei: input.opportunity?.estimatedProfitWei,
    });
    if (!freshness.ok) {
      throw new Error(freshness.reason);
    }
  }

  const preflight = await preflightExecuteCall({
    from: wallet.address,
    to: input.to,
    data: input.data,
    chainId,
    fallbackGasLimit: input.gasLimit,
    rpcUrl: writeUrl,
    diag: input.opportunity
      ? preflightDiagFromOpportunity(
          input.opportunity,
          input.gasLimit,
          tokenWeiToUsd(
            input.opportunity.amountInWei || "0",
            input.opportunity.quoteDecimals ?? 18,
            input.opportunity.quoteUsd ?? 1
          )
        )
      : { gasLimit: input.gasLimit, chainId },
  });
  if (!preflight.ok) {
    if (preflight.emptySelector && input.opportunity) {
      const key = routeBlacklistKey(input.opportunity);
      const block = input.detectedBlock ?? 0;
      const ban = noteEmptySelectorRevert(key, block, chainId);
      if (ban.blacklisted) {
        console.warn(
          `[BLACKLIST] rute ${input.opportunity.tokenPair} ${input.opportunity.buyExchange}→${input.opportunity.sellExchange} · selector kosong ${ban.streak}x · jeda sampai blok #${ban.untilBlock}`
        );
      }
    }
    throw new Error(preflight.reason || "staticCall reverted");
  }
  if (input.opportunity) {
    clearRouteBlacklist(routeBlacklistKey(input.opportunity));
  }
  const gasLimit = Math.min(
    FLASH_LOAN_GAS_CEILING,
    Math.max(21_000, Math.floor(preflight.gasLimit || input.gasLimit))
  );
  const estimateBit =
    preflight.estimatedGas != null ? ` · estimate ${preflight.estimatedGas}` : "";
  console.log(`[PREFLIGHT] staticCall ok via [EXEC] ${redactEndpoint(writeUrl)} · gasLimit ${gasLimit}${estimateBit} · buffer 25%`);
  console.log(
    `[EXEC] dual-provider · readProvider=${redactEndpoint(path.readUrl || live.endpoint)} · writeProvider=${useBundle ? "Private Bundle" : "Standard Queue"} ${redactEndpoint(writeUrl)}`
  );

  let sentHash = "";
  try {
    const nonce = await readProvider.getTransactionCount(wallet.address, "pending");
    const txRequest: {
      to: string;
      data: string;
      gasLimit: number;
      nonce: number;
      chainId: number;
      type?: number;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    } = {
      to: input.to,
      data: input.data,
      gasLimit,
      nonce,
      chainId: networkId,
    };

    if (chainId === "arbitrum") {
      console.log("Peluang arbitrase terdeteksi! Menghitung gas fee kompetitif (EIP-1559 via Ankr WSS)...");
      const bribePct = resolveDynamicBribePercent({
        minerTipPct: input.minerTipPct ?? 0,
        dynamicBribePercent: input.dynamicBribePercent,
      });
      let bribePriority = 0n;
      if (input.opportunity && bribePct > 0) {
        const tipEth = dynamicTipBudgetEthWei(input.opportunity, bribePct);
        bribePriority = maxPriorityFeeFromTipBudget(tipEth, gasLimit);
        console.log(
          `[GAS] Dynamic Profit Sharing Bribe ${bribePct}% · tipBudget ${formatUnits(tipEth, "ether")} ETH` +
            ` · maxPriorityFeePerGas ${formatPriorityGwei(bribePriority)} Gwei · gasLimit ${gasLimit}`
        );
        appendServerLog({
          level: "info",
          source: "BRIBE",
          message: `Miner tip ${bribePct}% · budget ${formatUnits(tipEth, "ether")} ETH · priority ${formatPriorityGwei(bribePriority)} Gwei`,
        });
      }
      const gasSettings = await calculateAggressiveGasArbitrum(
        readProvider,
        aggressiveness,
        capWei != null ? input.maxGasGwei : undefined,
        bribePriority
      );
      console.log(
        `Mengirim dengan Priority Fee: ${formatPriorityGwei(gasSettings.maxPriorityFeePerGas)} Gwei` +
          ` · maxFee ${formatUnits(gasSettings.maxFeePerGas, "gwei")} Gwei`
      );
      txRequest.type = 2;
      txRequest.maxFeePerGas = gasSettings.maxFeePerGas;
      txRequest.maxPriorityFeePerGas = gasSettings.maxPriorityFeePerGas;
    } else {
      let gasPrice = networkGas;
      if (bump > 0) {
        gasPrice = (gasPrice * BigInt(100 + bump)) / 100n;
      }
      if (capWei != null && gasPrice > capWei) gasPrice = capWei;
      txRequest.gasPrice = gasPrice;
    }

    if (input.opportunity) {
      const opp = input.opportunity;
      const loanAmountUsd = tokenWeiToUsd(opp.amountInWei || "0", opp.quoteDecimals ?? 18, opp.quoteUsd ?? 1);
      const check = validateAndExecuteArbitrage({
        opportunity: opp,
        gasLimit: BigInt(gasLimit),
        maxFeePerGas: maxFeeFromTxFees({
          maxFeePerGas: txRequest.maxFeePerGas,
          gasPrice: txRequest.gasPrice,
        }),
        minProfitUsd: input.minProfitUsd,
        minSpreadBps: input.minSpreadBps,
        extreme: input.extreme,
        loanAmountUsd,
        chainId,
      });
      if (!check.ok) {
        throw Object.assign(new Error(check.reason || SKIP_PROFIT_TOO_SMALL), { skipMathLogged: true });
      }
    }

    try {
      const tx = await wallet.sendTransaction(txRequest);
      sentHash = tx.hash;
    } catch (sendError) {
      const maybeHash = extractTxHash(sendError) || sentHash;
      if (maybeHash) {
        sentHash = maybeHash;
        const reason = toExecRevertLog(sendError);
        logRevertWithTxHash(maybeHash, chainId, reason);
        throw attachTxHash(
          new Error(formatRevertTxLog(maybeHash, reason, chainId)),
          maybeHash
        );
      }
      throw sendError;
    }
    printExecTxHash(sentHash, chainId);
    console.log(
      useBundle
        ? `Flash loan dikirim via Private Bundle. Tx Hash: ${sentHash}`
        : `Flash loan dikirim via Standard Queue (JSON-RPC publik). Tx Hash: ${sentHash}`
    );
    let receipt;
    try {
      receipt = await readProvider.waitForTransaction(sentHash, 1, 120_000);
    } catch (waitError) {
      const hash = extractTxHash(waitError) || sentHash;
      const reason = toExecRevertLog(waitError);
      logRevertWithTxHash(hash, chainId, reason);
      throw attachTxHash(new Error(formatRevertTxLog(hash, reason, chainId)), hash);
    }
    if (receipt && receipt.status === 0) {
      let reason = "execution reverted";
      try {
        await writeProvider.call({
          from: wallet.address,
          to: input.to,
          data: input.data,
          gasLimit,
          blockTag: receipt.blockNumber,
        });
      } catch (replay) {
        reason = toExecRevertLog(replay);
      }
      logRevertWithTxHash(sentHash, chainId, reason);
      throw attachTxHash(new Error(formatRevertTxLog(sentHash, reason, chainId)), sentHash);
    }
    if (!receipt) {
      logRevertWithTxHash(sentHash, chainId, "Timeout menunggu konfirmasi");
      throw attachTxHash(
        new Error(`Timeout menunggu konfirmasi transaksi.\n${failedTxLogLines(sentHash, chainId)}`),
        sentHash
      );
    }
    return sentHash;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Gas jaringan|belum terbaca|PRIVATE_KEY|NotOwner|belum diisi|Data basi|Nomor blok|\[SKIP\]|Profit terlalu kecil/i.test(message)) throw error;
    if (isPreflightFailure(message)) throw error;
    if (/\[TX HASH\]|\[EXEC\] Tx Hash:|\[REVERT\] Tx Hash:/i.test(message)) {
      throw error instanceof Error ? error : new Error(message);
    }
    const hash = extractTxHash(error) || sentHash;
    if (hash) {
      const reason = toExecRevertLog(error);
      logRevertWithTxHash(hash, chainId, reason);
      throw attachTxHash(new Error(formatRevertTxLog(hash, reason, chainId)), hash);
    }
    throw new Error(toExecRevertLog(error));
  }
}
