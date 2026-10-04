import { flashloanExecutionBlock } from "@/src/flashloan/globalProviderSelector";
import { noteMevExecutorRedeployHold } from "@/lib/bot/autoExecute";
import { AUTO_EXECUTE, DEFAULT_BOT_CONFIG } from "@/lib/bot/constants";
import { formatNetProfitSkip, minProfitUsdFromLoan } from "@/lib/bot/adaptiveMinProfit";
import {
  formatAutoExecuteQueueLine,
  formatQueueRouteLabel,
  gasPriceToGwei,
  maxOpportunitySpreadBps,
  minSpreadBpsFromConfig,
  orderAutoExecuteQueue,
  resolveAutoExecuteCooldownMs,
} from "@/lib/bot/autoExecute";
import { blockLiveExecutionForScanOnly, SCAN_ONLY_HOLD_MESSAGE } from "@/lib/bot/scanOnlyGate";
import { buildExecuteCalldata } from "@/lib/bot/encodeArb";
import { evaluateGasStrategy, type GasStrategyDecision } from "@/lib/bot/gasStrategy";
import {
  autonomousSignerStatus,
  logAutonomousSigner,
  sendAutonomousContractTx,
} from "@/lib/bot/privateSigner";
import { requireExecutorRpcUrl } from "@/lib/bot/dualProvider";
import { getBlockNumber, getGasPriceWei } from "@/lib/bot/rpc";
import { fetchSignerLiveBalances, assertSufficientExecFunds, nativeSymbolForChain } from "@/lib/bot/signerBalances";
import { formatEstimatedTxGasFromPrice } from "@/lib/bot/gasCostEstimate";
import { runOnChainDryRun } from "@/lib/bot/dryRun";
import { isPreflightFailure, simulateEncodedCall } from "@/lib/bot/simulate";
import { isRouteTemporarilyBlacklisted, routeBlacklistKey } from "@/lib/bot/routeBlacklist";
import { opportunityFailsPoolSafety, formatPoolLiquidityUsd } from "@/lib/bot/poolSafety";
import { appendTrade, readBotState, writeBotState } from "@/lib/bot/store";
import { notifyTxFailure, scheduleProTradeSuccessNotify } from "@/lib/bot/telegram";
import { appendServerLog } from "@/lib/bot/serverLog";
import { noteFeedStatus } from "@/lib/bot/liveHub";
import { buildTradeTraceSnapshot } from "@/lib/bot/transactionTrace";
import { extractTxHash, formatRevertTxLog, logRevertWithTxHash } from "@/lib/chain/explorer";
import {
  extractSlippageAmounts,
  isExecRevertFailure,
  logExecRevertSnapshot,
  toExecRevertLog,
} from "@/lib/bot/revertReason";
import {
  isSlippageLikeRevert,
  logSlippageExceededDetail,
  minAmountOutForExec,
} from "@/lib/bot/dynamicSlippage";
import { resolveOpportunitySwapRouters } from "@/lib/bot/constants";
import { computeSkipProfitBreakdown, logFinancialBreakdown, logSkipProfitBreakdown } from "@/lib/bot/skipProfitBreakdown";
import { isKaminoFlashProvider } from "@/lib/bot/solana/kaminoConstants";
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import { isTradingChainId, normalizeTradingChainId } from "@/config/networks";
import { hydrateChainQuotaFromDisk } from "@/lib/owner/chainQuotaPersist";
import { pinExecChain } from "@/lib/bot/scanRuntime";
import { formatWalletError } from "@/lib/wallet/rpcError";
import type { ChainId } from "@/lib/chain/networks";

export type AutoExecQueueSkip = {
  rank: number;
  id: string;
  reason: string;
};

export type AutonomousExecuteResult = {
  txHash: string;
  opportunity: Opportunity;
  via: string;
  executedRank: number;
  queueSize: number;
  skipped: AutoExecQueueSkip[];
};

function compactExecError(error: unknown): string {
  return formatWalletError(error).replace(/\s+/g, " ").trim().slice(0, 220);
}

/** Gagal preflight/simulasi/likuiditas → coba peringkat berikutnya. Jangan fallback jika tx sudah broadcast atau gerbang global. */
export function isAutoExecFallbackableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    /Kill switch|Signer otonom|Cooldown otonom|melebihi batas|user rejected|ditolak di metamask|rejected the request/i.test(
      msg
    )
  ) {
    return false;
  }
  if (/Saldo (ETH|BNB|POL) gas|Dana tidak cukup/i.test(msg)) return false;
  if (/\[EXEC\] Tx Hash:|\[TX HASH\]|\[REVERT\] Tx Hash:/i.test(msg)) return false;
  return true;
}

class QueueSkipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueSkipError";
  }
}

function announceRedeployHold(chainId: string): string | null {
  const hold = noteMevExecutorRedeployHold(chainId);
  if (!hold) return null;
  void import("@/lib/bot/telegram").then((mod) => {
    mod.notifySkipOrFailProfitHtml({
      text: hold,
      dedupeKey: `mev-executor-redeploy:${chainId}`,
    });
  });
  return hold;
}

export async function executeOpportunityAutonomous(input: {
  opportunityId?: string;
  opportunityIds?: string[];
  extremeApproved?: boolean;
  config?: Partial<BotConfig>;
  botMode?: string;
}): Promise<AutonomousExecuteResult> {
  const state = await readBotState();
  if (state.killed) {
    throw new Error("Kill switch aktif — eksekusi otonom ditahan.");
  }
  if (blockLiveExecutionForScanOnly()) {
    throw new Error(SCAN_ONLY_HOLD_MESSAGE);
  }

  hydrateChainQuotaFromDisk();
  const preferredIds = [
    ...(input.opportunityIds ?? []),
    ...(input.opportunityId ? [input.opportunityId] : []),
  ];
  const preferredOpp = preferredIds
    .map((id) => state.opportunities.find((item) => item.id === id))
    .find((item): item is Opportunity => Boolean(item));
  const chainHint = [preferredOpp?.chainId, input.config?.chainId, state.config.chainId].find((value) =>
    isTradingChainId(value)
  );
  const chainId = normalizeTradingChainId(chainHint || state.config.chainId);
  const redeployHold = announceRedeployHold(chainId);
  if (redeployHold) {
    throw new Error(redeployHold);
  }
  const unpinExec = pinExecChain(chainId);
  const mergedLoan =
    input.config?.loanAmountUsd ?? state.config.loanAmountUsd ?? DEFAULT_BOT_CONFIG.loanAmountUsd;
  const execConfig: BotConfig = {
    ...DEFAULT_BOT_CONFIG,
    ...state.config,
    ...input.config,
    chainId,
    minProfitUsd: minProfitUsdFromLoan(mergedLoan),
    loanAmountUsd: mergedLoan,
  };

  try {
    const signer = autonomousSignerStatus(chainId);
    if (!signer.ready || !signer.address) {
      throw new Error(
        chainId === "solana"
          ? "Signer otonom belum siap. Isi PRIVATE_KEY_SOLANA di .env.local (base58 Phantom / JSON solana-keygen)."
          : chainId === "polygon"
            ? "Signer otonom belum siap. Isi PRIVATE_KEY_POLYGON di .env.local (wallet owner 0x05F41c...)."
            : chainId === "arbitrum"
              ? "Signer otonom belum siap. Isi PRIVATE_KEY_ARBITRUM di .env.local (wallet owner 0x05F41c...)."
              : chainId === "ethereum"
                ? "Signer otonom belum siap. Isi PRIVATE_KEY_ETHEREUM di .env.local (wallet owner 0x05F41c...)."
                : "Signer otonom belum siap. Isi PRIVATE_KEY_BSC di .env.local."
      );
    }
    logAutonomousSigner(chainId);
    const liveGas = await getGasPriceWei(undefined, chainId);
    const gwei = gasPriceToGwei(liveGas.toString());
    const gate = evaluateGasStrategy({
      gwei,
      config: execConfig,
      extremeArmed: Boolean(input.extremeApproved) && execConfig.gasStrategyMode === "extreme",
      chainId,
    });
    if (!gate.ok) {
      throw new Error(gate.reason);
    }

    const now = Date.now();
    const scopedForCooldown = state.opportunities.filter(
      (item) => !item.chainId || item.chainId === chainId
    );
    const cooldownMs = resolveAutoExecuteCooldownMs(
      execConfig.minSpreadPct,
      maxOpportunitySpreadBps(scopedForCooldown)
    );
    if (state.lastAutonomousAt && now - state.lastAutonomousAt < cooldownMs) {
      const remainSec = Math.ceil((cooldownMs - (now - state.lastAutonomousAt)) / 1000);
      throw new Error(
        `Cooldown otonom ${cooldownMs / 1000}s masih berjalan` +
          (cooldownMs <= AUTO_EXECUTE.hotCooldownMs
            ? ` (hot · spread dekat min−0.1%)`
            : "") +
          ` · sisa ~${remainSec}s.`
      );
    }

    const scopedOpps = scopedForCooldown;
    const queue = orderAutoExecuteQueue(scopedOpps, execConfig, {
      preferredIds,
      exclusive: (input.opportunityIds?.length ?? 0) > 0,
      lastRotateOppId: state.lastExecRotateOppId,
    });
    if (queue.length === 0) {
      throw new Error("Tidak ada peluang yang lolos filter spread/profit untuk mode gas saat ini.");
    }

    console.log(formatAutoExecuteQueueLine(queue, execConfig, { chainId }));

    const skipped: AutoExecQueueSkip[] = [];
    let lastError: unknown;

    for (let index = 0; index < queue.length; index += 1) {
      const opp = queue[index];
      const rank = index + 1;
      const label = formatQueueRouteLabel(opp);
      console.log(`[QUEUE] peringkat ${rank} mencoba ${label}`);
      try {
        await writeBotState({
          ...(await readBotState()),
          lastExecRotateOppId: opp.id,
        });
      } catch {
        /* cursor rotasi tidak boleh menahan eksekusi */
      }

      try {
        const txHash = await attemptAutonomousOpportunity({
          opp,
          execConfig,
          chainId,
          signerAddress: signer.address,
          liveGas,
          gate,
          stateLastBlock: state.lastBlock,
          now,
        });
        if (rank > 1) {
          console.log(`[QUEUE] fallback sukses pada peringkat ${rank} · ${label}`);
        }
        return {
          txHash,
          opportunity: opp,
          via: gate.reason,
          executedRank: rank,
          queueSize: queue.length,
          skipped,
        };
      } catch (error) {
        lastError = error;
        const reason = compactExecError(error);
        const fallback = isAutoExecFallbackableError(error) && index < queue.length - 1;
        console.log(`[QUEUE] peringkat ${rank} dilewati — ${reason}`);
        if (reason.startsWith("[SKIP] Eksekusi ditahan: MevExecutor")) {
          skipped.push({ rank, id: opp.id, reason });
          break;
        }
        logSkipProfitBreakdown(
          {
            opp,
            config: execConfig,
            liveGasWei: liveGas,
            chainId,
            headline: reason,
            detailReason: reason,
            decisionStatus: /PREFLIGHT|pre-flight|belum di-broadcast/i.test(reason)
              ? "REVERT_PREFLIGHT"
              : /Net profit di bawah lantai|Profit terlalu kecil|loan×0\.60%|minProfitUsd/i.test(reason)
                ? "SKIP_PROFIT_RENDAH"
                : /execution reverted|Tx Hash|REVERT/i.test(reason)
                  ? "REVERT_ONCHAIN"
                  : undefined,
            phase: /execution reverted|gagal|FAIL|PREFLIGHT|pre-flight/i.test(reason)
              ? "fail"
              : "skip",
          },
          error
        );
        skipped.push({ rank, id: opp.id, reason });
        if (!fallback) {
          break;
        }
      }
    }

    const abort = compactExecError(lastError);
    const lastOpp = queue[Math.max(0, skipped.length - 1)] ?? queue[0];
    notifyTxFailure({
      message: abort,
      pair: lastOpp?.tokenPair,
      route: lastOpp ? `${lastOpp.buyExchange} → ${lastOpp.sellExchange}` : undefined,
      source: "slow-autonomous",
    });
    const fail = lastError instanceof Error ? lastError : new Error(abort);
    (fail as Error & { skipped?: AutoExecQueueSkip[] }).skipped = skipped;
    throw fail;
  } finally {
    unpinExec();
  }
}

async function attemptAutonomousOpportunity(input: {
  opp: Opportunity;
  execConfig: BotConfig;
  chainId: ChainId;
  signerAddress: string;
  liveGas: bigint;
  gate: GasStrategyDecision;
  stateLastBlock: number;
  now: number;
}): Promise<string> {
  const { opp, execConfig, chainId, signerAddress, liveGas, gate, stateLastBlock, now } = input;

  const redeployHold = announceRedeployHold(chainId);
  if (redeployHold) {
    throw new QueueSkipError(redeployHold);
  }

  const blocked = flashloanExecutionBlock(chainId);
  if (blocked) {
    throw new QueueSkipError(`[SKIP] ${blocked}`);
  }

  const routeKey = routeBlacklistKey(opp);
  const ban = isRouteTemporarilyBlacklisted(routeKey, opp.detectedBlock || stateLastBlock || 0);
  if (ban.blocked) {
    throw new QueueSkipError(
      `[BLACKLIST] rute ${opp.tokenPair} ${opp.buyExchange}→${opp.sellExchange} di-jeda sampai blok #${ban.untilBlock} (EVM revert tanpa data ${ban.remainBlocks} blok lagi)`
    );
  }

  const profitMath = computeSkipProfitBreakdown({
    opp,
    config: execConfig,
    liveGasWei: liveGas,
    chainId,
  });
  if (chainId !== "solana" && profitMath.decisionNetUsd + 1e-9 < profitMath.floorUsd) {
    const skip = new QueueSkipError(
      formatNetProfitSkip(profitMath.decisionNetUsd, profitMath.floorUsd)
    );
    logSkipProfitBreakdown(
      {
        opp,
        config: execConfig,
        liveGasWei: liveGas,
        chainId,
        headline: skip.message,
        detailReason: skip.message,
        decisionStatus: "SKIP_PROFIT_RENDAH",
        phase: "skip",
      },
      skip
    );
    throw skip;
  }

  const poolBlock = opportunityFailsPoolSafety(
    opp,
    execConfig.minPoolLiquidityUsd,
    execConfig.maxPriceImpactPct
  );
  if (poolBlock) {
    console.log(
      `[POOL CHECK] Pair: ${opp.tokenPair} · ${opp.buyExchange} → ${opp.sellExchange} | Liquidity: ${formatPoolLiquidityUsd(opp.poolLiquidityUsd ?? 0)} | Price Impact: ${(opp.priceImpactPct ?? 0).toFixed(2)}% | SKIP ${poolBlock}`
    );
    throw new QueueSkipError(`[SKIP] ${poolBlock}`);
  }
  console.log(
    `[POOL CHECK] Pair: ${opp.tokenPair} · ${opp.buyExchange} → ${opp.sellExchange} | Liquidity: ${formatPoolLiquidityUsd(opp.poolLiquidityUsd ?? 0)} | Price Impact: ${(opp.priceImpactPct ?? 0).toFixed(2)}%`
  );

  const gasBalances = await fetchSignerLiveBalances({
    chainId,
    quoteSymbol: opp.tokenIn,
    baseSymbol: opp.tokenOut,
  });
  const gasSymbol = nativeSymbolForChain(chainId);
  const estGas = formatEstimatedTxGasFromPrice(liveGas.toString(), execConfig.gasLimit, chainId);
  const vaultBit =
    ` · ${gasSymbol} (Gas): ${estGas}` +
    ` · Wallet ${gasSymbol} (gas): ${gasBalances?.nativeSymbol === gasSymbol ? gasBalances.nativeFormatted ?? "—" : "—"}` +
    ` · Vault ${gasSymbol}: ${gasBalances?.nativeSymbol === gasSymbol ? gasBalances.vaultEthFormatted ?? "—" : "—"} (bukan sumber gas)` +
    ` · Vault USDC: ${gasBalances?.vaultUsdcFormatted ?? "—"}` +
    ` · Vault USDT: ${gasBalances?.vaultUsdtFormatted ?? "—"}`;
  console.log(`[EXEC] ${opp.tokenPair}${vaultBit}`);
  await assertSufficientExecFunds({
    chainId,
    balances: gasBalances,
    config: execConfig,
    opportunity: opp,
    gasPriceWei: liveGas,
  });

  // Solana / Kamino: jalur live Jupiter dual-swap (bukan calldata EVM).
  if (chainId === "solana" || isKaminoFlashProvider(execConfig.flashLoanProvider)) {
    const { executeSolanaLiveArb } = await import("@/lib/bot/solana/executeLive");
    const { logSolanaSigner } = await import("@/lib/bot/solana/signer");
    logSolanaSigner();
    const live = await executeSolanaLiveArb({ opp, config: execConfig });
    console.log(
      `[SOLANA-EXEC] selesai · sig=${live.signature} · legs=${live.signatures.join(",")}` +
        ` · mode=${live.mode} · kaminoFee=${live.kaminoFeePct}%`
    );
    await writeBotState({
      ...(await readBotState()),
      lastAutonomousAt: now,
      lastError: undefined,
    }).catch(() => null);
    return live.signature;
  }

  const built = buildExecuteCalldata(opp, execConfig, signerAddress);
  if (!built) {
    throw new QueueSkipError("Calldata tidak bisa disusun untuk peluang ini.");
  }

  const detectedBlock = await getBlockNumber(undefined, chainId, { fresh: true });
  if (detectedBlock > 0) {
    opp.detectedBlock = detectedBlock;
  }

  if (opp.status === "ready") {
    const dry = await runOnChainDryRun({
      opportunity: opp,
      from: signerAddress,
      to: built.to,
      data: built.data,
      chainId,
      gasPriceWei: liveGas,
      rpcUrl: requireExecutorRpcUrl(chainId),
      fallbackGasLimit: execConfig.gasLimit,
    });
    try {
      const latest = await readBotState();
      await writeBotState({
        ...latest,
        opportunities: latest.opportunities.map((item) =>
          item.id === dry.opportunity.id ? dry.opportunity : item
        ),
      });
    } catch (persistError) {
      console.warn(
        "[DRY RUN] gagal menyimpan status",
        persistError instanceof Error ? persistError.message : persistError
      );
    }
    Object.assign(opp, dry.opportunity);
    if (!dry.ok) {
      noteFeedStatus(opp.id, dry.outcome === "reverted" ? "reverted" : "skipped");
      throw new QueueSkipError(dry.reason || "[DRY RUN] simulasi tidak lolos.");
    }
    noteFeedStatus(opp.id, "validated");
  }

  let txHash: string;
  try {
    txHash = await sendAutonomousContractTx({
      to: built.to,
      data: built.data,
      gasLimit: execConfig.gasLimit,
      maxGasGwei: gate.maxGasGwei,
      bumpPct: gate.bumpPct,
      chainId,
      detectedBlock: opp.detectedBlock || detectedBlock,
      opportunity: opp,
      minProfitUsd: execConfig.minProfitUsd,
      minSpreadBps: minSpreadBpsFromConfig(execConfig),
      dynamicBribePercent: execConfig.dynamicBribePercent,
      minerTipPct: execConfig.minerTipPct,
      extreme: gate.mode === "extreme",
      useBundle: execConfig.useBundle,
    });
  } catch (error) {
    const abort = error instanceof Error ? error.message : String(error);
    if (/Data basi|Nomor blok/.test(abort)) {
      throw new Error(abort);
    }
    if (/\[SKIP\]|Profit terlalu kecil|tidak menutup biaya gas/i.test(abort)) {
      throw error instanceof Error ? error : new Error(abort);
    }
    if (isPreflightFailure(abort)) {
      console.warn(abort);
      logSkipProfitBreakdown({
        opp,
        config: execConfig,
        liveGasWei: liveGas,
        chainId,
        headline: `[FAIL] pre-flight simulation · ${compactExecError(abort)}`,
        detailReason: abort,
        decisionStatus: "REVERT_PREFLIGHT",
        phase: "fail",
      });
      logExecRevertSnapshot(execConfig);
      if (isSlippageLikeRevert(abort)) {
        const floor = minAmountOutForExec(opp, execConfig);
        const sellRouter = resolveOpportunitySwapRouters(opp)?.sell.router;
        logSlippageExceededDetail({
          expectedOut: BigInt(opp.amountOutWei || "0"),
          amountOutMin: floor.minAmountOut,
          actualOut: null,
          spreadBps: opp.spreadBps,
          slippageBps: floor.slippageBps,
          minProfitBps: floor.minProfitBps,
          quoteDecimals: opp.quoteDecimals,
          quoteSymbol: opp.tokenIn,
          routerSell: sellRouter,
          buyDex: opp.buyExchange || opp.buyDex,
          sellDex: opp.sellExchange || opp.sellDex,
          cooldownMs: AUTO_EXECUTE.failBackoffMs,
        });
      }
      throw Object.assign(error instanceof Error ? error : new Error(abort), {
        skipMathLogged: true,
      });
    }
    const failedHash = extractTxHash(error);
    const replay = await simulateEncodedCall({
      from: signerAddress,
      to: built.to,
      data: built.data,
      chainId,
      rpcUrl: requireExecutorRpcUrl(chainId),
      label: {
        pair: opp.tokenPair,
        route: `${opp.buyExchange || opp.buyDex} → ${opp.sellExchange || opp.sellDex}`,
      },
    });
    let message = /\[TX HASH\]|\[EXEC\] Tx Hash:|\[REVERT\] Tx Hash:/.test(abort)
      ? abort
      : !replay.ok && replay.reason
        ? replay.reason
        : toExecRevertLog(error);
    if (failedHash && !message.includes(failedHash)) {
      message = formatRevertTxLog(failedHash, message, chainId);
    }
    if (isExecRevertFailure(message) || isSlippageLikeRevert(message)) {
      console.warn("[EXEC] execution reverted");
      appendServerLog({
        level: "error",
        source: "REVERTED",
        message: `${opp.tokenPair} · ${compactExecError(message)}`,
      });
      noteFeedStatus(opp.id, "reverted");
      logSkipProfitBreakdown({
        opp,
        config: execConfig,
        liveGasWei: liveGas,
        chainId,
        headline: `[FAIL] ${compactExecError(message)}`,
        detailReason: message,
        decisionStatus: "REVERT_ONCHAIN",
        phase: "fail",
      });
      logExecRevertSnapshot(execConfig);
      const fromRevert = extractSlippageAmounts(error);
      const fromReplay = replay.ok ? {} : extractSlippageAmounts({ message: replay.reason });
      if (
        isSlippageLikeRevert(message) ||
        fromRevert.actualOut != null ||
        fromRevert.amountOutMin != null
      ) {
        const floor = minAmountOutForExec(opp, execConfig);
        const sellRouter = resolveOpportunitySwapRouters(opp)?.sell.router;
        logSlippageExceededDetail({
          expectedOut: BigInt(opp.amountOutWei || "0"),
          amountOutMin: fromRevert.amountOutMin ?? fromReplay.amountOutMin ?? floor.minAmountOut,
          actualOut: fromRevert.actualOut ?? fromReplay.actualOut ?? null,
          spreadBps: opp.spreadBps,
          slippageBps: floor.slippageBps,
          minProfitBps: floor.minProfitBps,
          quoteDecimals: opp.quoteDecimals,
          quoteSymbol: opp.tokenIn,
          routerSell: sellRouter,
          buyDex: opp.buyExchange || opp.buyDex,
          sellDex: opp.sellExchange || opp.sellDex,
          cooldownMs: AUTO_EXECUTE.failBackoffMs,
        });
      }
      if (failedHash) {
        logRevertWithTxHash(failedHash, chainId, compactExecError(message));
      } else {
        console.warn(
          "[REVERT] Tx hash tidak ditemukan pada objek error provider — cek apakah tx sempat di-broadcast"
        );
      }
      const detail = message
        .replace(/^execution reverted\n?/i, "")
        .replace(/\[TX HASH\][\s\S]*$/i, "")
        .replace(/\[EXEC\] Tx Hash:[\s\S]*$/i, "")
        .replace(/\[REVERT\] Tx Hash:[^\n]*/i, "")
        .trim();
      if (detail) console.warn(`[EXEC] ${detail}`);
    } else if (failedHash) {
      logRevertWithTxHash(failedHash, chainId, compactExecError(message));
    }
    if (failedHash) {
      try {
        await appendTrade({
          id: `${Date.now()}`,
          at: new Date().toISOString(),
          pair: opp.tokenPair,
          route: `${opp.buyExchange} → ${opp.sellExchange}`,
          netProfitWei: "0",
          txHash: failedHash,
          outcome: "reverted",
        });
      } catch {
        /* histori revert tidak boleh menahan error asli */
      }
    }
    throw Object.assign(new Error(message), {
      skipMathLogged: isExecRevertFailure(message),
      transactionHash: failedHash || undefined,
    });
  }

  await writeBotState({
    ...(await readBotState()),
    lastAutonomousAt: now,
    lastAutonomousOppId: opp.id,
  });

  logFinancialBreakdown({
    opp,
    config: execConfig,
    liveGasWei: liveGas,
    chainId,
    phase: "exec",
    decisionStatus: "DISEKUSI",
    detailReason: `Tx broadcast sukses · hash ${txHash}`,
    headline: `[EXEC] sukses ${opp.tokenPair} · ${txHash}`,
  });
  appendServerLog({
    level: "exec",
    source: "EXECUTED",
    message: `${opp.tokenPair} · ${opp.buyExchange} → ${opp.sellExchange} · tx ${txHash}`,
  });
  noteFeedStatus(opp.id, "executed");

  const isPro = execConfig.aaveFeePct < 0.09;
  const trace = buildTradeTraceSnapshot({
    opportunity: opp,
    txHash,
    config: execConfig,
    blockNumber: stateLastBlock,
    gasPriceWei: liveGas.toString(),
    isPro,
  });

  await appendTrade({
    id: `${Date.now()}`,
    at: new Date().toISOString(),
    pair: opp.tokenPair,
    route: `${opp.buyExchange} → ${opp.sellExchange}`,
    netProfitWei: opp.netProfitWei,
    txHash,
    outcome: "success",
    trace,
  });

  try {
    scheduleProTradeSuccessNotify({
      isPro,
      sandbox: false,
      source: `otonom ${gate.mode}`,
      txHash,
      pair: opp.tokenPair,
      route: `${opp.buyExchange} → ${opp.sellExchange}`,
      netProfitWei: opp.netProfitWei,
      loanAmountUsd: execConfig.loanAmountUsd,
      chainId: opp.chainId || execConfig.chainId,
      quoteDecimals: opp.quoteDecimals,
      quoteUsd: opp.quoteUsd,
      minProfitUsd: execConfig.minProfitUsd,
      minerTipPct: execConfig.minerTipPct ?? execConfig.dynamicBribePercent,
      trace,
    });
  } catch (error) {
    console.warn(
      "[autonomous] telegram Pro notify",
      error instanceof Error ? error.message : error
    );
  }

  return txHash;
}

let lastAutonomousQueueLog = "";
let lastAutonomousQueueLogAt = 0;

export async function tryServerAutonomousTick(): Promise<void> {
  const state = await readBotState();
  if (state.killed) return;
  const chainId = normalizeTradingChainId(state.config.chainId);
  const queue = orderAutoExecuteQueue(state.opportunities, state.config, {
    lastRotateOppId: state.lastExecRotateOppId,
  });
  const queueLine = `[QUEUE] Memproses antrean otonom. Jumlah rute aktif di RAM: ${queue.length}`;
  const nowLog = Date.now();
  if (
    queueLine !== lastAutonomousQueueLog ||
    nowLog - lastAutonomousQueueLogAt >= AUTO_EXECUTE.signalSkipLogMs
  ) {
    lastAutonomousQueueLog = queueLine;
    lastAutonomousQueueLogAt = nowLog;
    console.log(queueLine);
    appendServerLog({ level: "info", source: "QUEUE", chainId, message: queueLine });
  }
  const signer = autonomousSignerStatus(chainId);
  if (!signer.ready) return;
  if (queue.length === 0) return;
  if (blockLiveExecutionForScanOnly()) return;
  if (state.config.gasStrategyMode !== "slow") return;

  try {
    const result = await executeOpportunityAutonomous({});
    console.log(
      `[searcher] Slow auto-exec #${result.executedRank}/${result.queueSize} ${result.opportunity.tokenPair} ${result.txHash}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "auto-exec gagal";
    if (
      !/Cooldown otonom|tidak ada peluang|ditahan|melebihi batas|Data basi|Nomor blok|Saldo ETH gas|Saldo BNB gas|Saldo POL gas|Dana tidak cukup|\[SKIP\]|Profit terlalu kecil/i.test(
        message
      )
    ) {
      console.warn("[searcher] auto-exec:", message);
    }
  }
}
