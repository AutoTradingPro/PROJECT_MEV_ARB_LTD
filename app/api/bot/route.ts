import { ensureLiveHub } from "@/lib/bot/liveHub";
import { scanOpportunities, peekScanSignerBalances } from "@/lib/bot/scanner";
import { simulateOpportunity } from "@/lib/bot/executor";
import { executeOpportunityAutonomous } from "@/lib/bot/autonomousExecute";
import { autonomousSignerStatus, formatAutonomousSignerLine } from "@/lib/bot/privateSigner";
import { requireExecutorRpcUrl } from "@/lib/bot/dualProvider";
import { fetchSignerLiveBalances, assertSufficientExecFunds } from "@/lib/bot/signerBalances";
import { getGasPriceWei, peekMemoizedGasWei } from "@/lib/bot/rpc";
import { noteMevExecutorRedeployHold, pickLiveGasWei } from "@/lib/bot/autoExecute";
import { buildExecuteCalldata } from "@/lib/bot/encodeArb";
import { contractAddressFromEnv, vaultContractFromEnv } from "@/lib/bot/constants";
import { defaultTradingChainId, isTradingChainId, normalizeTradingChainId } from "@/config/networks";
import { readLiveChain, writeLiveChain, type LiveChainRecord } from "@/lib/bot/liveChain";
import { defaultPairForChain } from "@/lib/chain/tokenPairs";
import { defaultDexIdsForChain } from "@/lib/bot/dexRegistry";
import { isOwnerNodeChainId } from "@/lib/owner/ownerNodeChains";
import { hydrateChainQuotaFromDisk, patchChainQuotaPersistent } from "@/lib/owner/chainQuotaPersist";
import { hardAdoptScanChain } from "@/lib/bot/scanRuntime";
import { tokenWeiToUsd } from "@/lib/bot/configUnits";
import { preflightDiagFromOpportunity, preflightExecuteCall } from "@/lib/bot/simulate";
import { noteEmptySelectorRevert, routeBlacklistKey } from "@/lib/bot/routeBlacklist";
import { readBotState, setKilled, updateConfig, appendTrade } from "@/lib/bot/store";
import { recordProHeartbeatPing } from "@/lib/bot/heartbeat";
import { notifySkipOrFailProfitHtml, notifyTxFailure, scheduleProTradeSuccessNotify } from "@/lib/bot/telegram";
import type { BotConfig, TradeTraceSnapshot } from "@/lib/bot/types";
import { isUserSuspended } from "@/lib/db";
import { Interface, ZeroAddress } from "ethers";
import { scanOnlyExecutionBlockedResponse } from "@/lib/scanOnly/mode";
import { emptyPlanMessage, planWithdraw, vaultChainOf } from "@/lib/vault/withdrawPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KILL_IFACE = new Interface(["function setKilled(bool value)"]);

function redeployHoldResponse(chainId: string): Response | null {
  const hold = noteMevExecutorRedeployHold(chainId);
  if (!hold) return null;
  notifySkipOrFailProfitHtml({
    text: hold,
    dedupeKey: `mev-executor-redeploy:${chainId}`,
  });
  return Response.json({ error: hold }, { status: 409 });
}

function authorityChainId(): ReturnType<typeof normalizeTradingChainId> {
  const live = readLiveChain();
  if (live?.locked && live.source === "manual" && isTradingChainId(live.chainId)) return live.chainId;
  return "arbitrum";
}

async function vaultForChain(chainId: ReturnType<typeof normalizeTradingChainId>) {
  const pair = defaultPairForChain(chainId);
  const quote = pair.quoteSymbol;
  const empty = {
    chainId,
    amount: "—",
    symbol: quote,
    pair: `${pair.baseSymbol} / ${quote}`,
  };
  try {
    const live = await fetchSignerLiveBalances({
      chainId,
      quoteSymbol: quote,
      baseSymbol: pair.baseSymbol,
    });
    if (!live) return empty;
    const upper = quote.toUpperCase();
    const stableAmount =
      upper === "USDT" ? live.vaultUsdtFormatted : upper === "USDC" || upper === "USDBC" ? live.vaultUsdcFormatted : undefined;
    const nativeAmount = upper === "SOL" || upper === live.nativeSymbol ? live.vaultEthFormatted : undefined;
    return {
      chainId,
      amount: stableAmount || nativeAmount || live.vaultFormatted || "0.00",
      symbol: stableAmount || nativeAmount ? quote : live.tokenSymbol || quote,
      pair: `${pair.baseSymbol} / ${quote}`,
    };
  } catch {
    return empty;
  }
}

export async function GET() {
  ensureLiveHub();
  try {
    const state = await readBotState();
    const gasChain = authorityChainId();
    const liveChain: LiveChainRecord = readLiveChain() ?? {
      chainId: gasChain,
      transport: "none",
      connected: false,
      locked: true,
      source: "manual",
      updatedAt: "",
    };
    return Response.json(
      {
        ...state,
        chainId: gasChain,
        config: { ...state.config, chainId: gasChain },
        liveChain,
        gasPriceWei: pickLiveGasWei(state.gasPriceWei, peekMemoizedGasWei(gasChain).toString()),
        autonomousSigner: autonomousSignerStatus(gasChain),
        autonomousSignerLine: formatAutonomousSignerLine(gasChain),
        signerBalances: peekScanSignerBalances(),
        vault: await vaultForChain(gasChain),
      },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "bot state unavailable";
    return Response.json(
      {
        killed: false,
        running: false,
        lastBlock: 0,
        gasPriceWei: "0",
        opportunities: [],
        trades: [],
        realizedProfitWei: "0",
        lastError: message,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  }
}

export async function POST(request: Request) {
  let body: {
    action?: "scan" | "kill" | "resume" | "config" | "adopt-chain" | "withdraw-calldata" | "simulate" | "execute-calldata" | "record-trade" | "execute-autonomous" | "report-exec-error" | "heartbeat-ping";
    manual?: boolean;
    config?: Partial<BotConfig>;
    pairIds?: string[];
    scanMode?: "single" | "full";
    token?: string;
    to?: string;
    opportunityId?: string;
    opportunityIds?: string[];
    pair?: string;
    route?: string;
    netProfitWei?: string;
    txHash?: string;
    trace?: TradeTraceSnapshot;
    extremeApproved?: boolean;
    message?: string;
    source?: string;
    isPro?: boolean;
    telegramId?: string;
    username?: string;
    email?: string;
    wallet?: string;
    sandbox?: boolean;
    chainId?: string;
    quoteDecimals?: number;
    quoteUsd?: number;
    minProfitUsd?: number;
    minerTipPct?: number;
    wssEnabled?: boolean;
    rpcFallbackEnabled?: boolean;
    botMode?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Body request kosong atau bukan JSON." }, { status: 400 });
  }

  if (body.action === "scan") {
    const scanMode = body.scanMode === "full" ? "full" : "single";
    const scanChain = authorityChainId();
    hardAdoptScanChain(scanChain, "scan-post");
    await updateConfig({
      ...(body.config?.loanAmountUsd !== undefined ? { loanAmountUsd: body.config.loanAmountUsd } : {}),
      ...(body.config?.aaveFeePct !== undefined ? { aaveFeePct: body.config.aaveFeePct } : {}),
      ...(body.config?.flashLoanProvider ? { flashLoanProvider: body.config.flashLoanProvider } : {}),
      ...(body.config?.flashLoanPlatforms ? { flashLoanPlatforms: body.config.flashLoanPlatforms } : {}),
      scanMode,
    });
    const stateBefore = await readBotState();
    // Solana: router worker mandiri (lib/bot/solana) — bypass latensi jalur EVM.
    const opportunities =
      scanChain === "solana"
        ? (
            await (
              await import("@/lib/bot/router")
            ).runBotWorker({
              chainId: "solana",
              config: { ...stateBefore.config, scanMode },
              pairIds: scanMode === "full" ? undefined : body.pairIds,
              scanMode,
              persist: true,
            })
          ).opportunities
        : await scanOpportunities({
            scanMode,
            pairIds: scanMode === "full" ? undefined : body.pairIds,
            chainId: scanChain,
          });
    const state = await readBotState();
    if (state.killed) {
      return Response.json({
        opportunities: [],
        lastError: "Kill switch global aktif.",
        killed: true,
      });
    }
    const gasChain = scanChain;
    const stateChain = normalizeTradingChainId(state.config.chainId);
    let signerBalances = peekScanSignerBalances();
    if (gasChain === "solana" && (!signerBalances || signerBalances.nativeSymbol !== "SOL")) {
      signerBalances = await fetchSignerLiveBalances({
        chainId: "solana",
        quoteSymbol: "USDC",
        baseSymbol: "SOL",
      }).catch(() => null);
      if (signerBalances) {
        const { rememberScanSignerBalances } = await import("@/lib/bot/signerBalances");
        rememberScanSignerBalances(signerBalances);
      }
    }
    return Response.json({
      opportunities,
      lastError: state.lastError,
      killed: false,
      chainId: gasChain,
      lastBlock: stateChain === gasChain ? state.lastBlock : 0,
      gasPriceWei:
        stateChain === gasChain
          ? pickLiveGasWei(state.gasPriceWei, peekMemoizedGasWei(gasChain).toString())
          : peekMemoizedGasWei(gasChain).toString(),
      autonomousSigner: autonomousSignerStatus(gasChain),
      autonomousSignerLine: formatAutonomousSignerLine(gasChain),
      signerBalances,
    });
  }

  if (body.action === "adopt-chain") {
    if (body.manual !== true) {
      const chainId = authorityChainId();
      return Response.json({
        ok: true,
        ignored: true,
        chainId,
        liveChain: readLiveChain(),
        vault: await vaultForChain(chainId),
      });
    }
    const chainId = normalizeTradingChainId(body.config?.chainId);
    writeLiveChain({ chainId, locked: true, connected: false, transport: "none", source: "manual" });
    if (isOwnerNodeChainId(chainId)) {
      const quota = hydrateChainQuotaFromDisk();
      const endpointOff = quota.rpcPrimary[chainId] !== true && quota.rpcBackup[chainId] !== true;
      patchChainQuotaPersistent({
        chains: { [chainId]: true },
        ...(endpointOff ? { rpcBackup: { [chainId]: true } } : {}),
      });
    }
    hardAdoptScanChain(chainId, "ui-tab");
    const state = await updateConfig({
      chainId,
      pairId: body.config?.pairId || defaultPairForChain(chainId).id,
      activeDexIds: body.config?.activeDexIds?.length ? body.config.activeDexIds : defaultDexIdsForChain(chainId),
    });
    return Response.json({
      ok: true,
      chainId,
      liveChain: readLiveChain(),
      vault: await vaultForChain(chainId),
      opportunities: [],
      lastError: undefined,
      killed: state.killed,
      lastBlock: 0,
      gasPriceWei: "0",
    });
  }

  if (body.action === "heartbeat-ping") {
    try {
      recordProHeartbeatPing({
        isPro: body.isPro,
        telegramId: body.telegramId,
        username: body.username,
        email: body.email,
        wallet: body.wallet,
        sandbox: body.sandbox,
        wssEnabled: body.wssEnabled,
        rpcFallbackEnabled: body.rpcFallbackEnabled,
      });
    } catch (error) {
      console.warn("[bot] heartbeat-ping", error instanceof Error ? error.message : error);
    }
    return Response.json({ ok: true });
  }

  if (body.action === "simulate") {
    const held = redeployHoldResponse(normalizeTradingChainId((await readBotState()).config.chainId));
    if (held) return held;
    const result = await simulateOpportunity(body.opportunityId, body.to);
    return Response.json(result);
  }

  if (body.action === "execute-calldata") {
    const blocked = scanOnlyExecutionBlockedResponse(body.botMode);
    if (blocked) {
      return Response.json(blocked, { status: 403 });
    }
    const state = await readBotState();
    if (state.killed) {
      return Response.json({ error: "Kill switch global aktif." }, { status: 423 });
    }
    const to = body.to;
    if (!to) {
      return Response.json({ error: "Hubungkan dompet MetaMask terlebih dahulu." }, { status: 400 });
    }
    if (
      isUserSuspended({
        username: body.username,
        email: body.email,
        wallet: body.wallet || to,
        telegramId: body.telegramId,
      })
    ) {
      return Response.json({ error: "Akun di-suspend oleh owner." }, { status: 403 });
    }
    if (!to) {
      return Response.json({ error: "Hubungkan dompet MetaMask terlebih dahulu." }, { status: 400 });
    }
    const execConfig = body.config ? { ...state.config, ...body.config } : state.config;
    const chainId = normalizeTradingChainId(execConfig.chainId);
    const held = redeployHoldResponse(chainId);
    if (held) return held;
    const contractAddress = contractAddressFromEnv(chainId);
    if (!contractAddress) {
      return Response.json(
        { error: "Set alamat executor (NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR / NEXT_PUBLIC_BSC_ARBITRAGE_EXECUTOR) di .env.local." },
        { status: 400 }
      );
    }
    const opp =
      state.opportunities.find((item) => item.id === body.opportunityId) ??
      state.opportunities.find((item) => item.status === "ready");
    if (!opp) {
      return Response.json({ error: "Peluang arbitrase tidak ditemukan." }, { status: 404 });
    }
    const built = buildExecuteCalldata(opp, execConfig, to);
    if (!built) {
      return Response.json({ error: "Calldata tidak bisa disusun untuk peluang ini." }, { status: 400 });
    }
    try {
      const balances = await fetchSignerLiveBalances({
        chainId,
        quoteSymbol: opp.tokenIn,
        baseSymbol: opp.tokenOut,
      });
      const gasPriceWei = await getGasPriceWei(undefined, chainId);
      await assertSufficientExecFunds({
        chainId,
        balances,
        config: execConfig,
        opportunity: opp,
        gasPriceWei,
        checkSignerGas: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dana tidak cukup.";
      return Response.json({ error: message }, { status: 400 });
    }
    const execRpc = chainId === "bsc" ? undefined : requireExecutorRpcUrl(chainId);
    const preflight = await preflightExecuteCall({
      from: to,
      to: built.to,
      data: built.data,
      chainId,
      fallbackGasLimit: execConfig.gasLimit,
      rpcUrl: execRpc,
      diag: preflightDiagFromOpportunity(
        opp,
        execConfig.gasLimit,
        tokenWeiToUsd(opp.amountInWei || "0", opp.quoteDecimals ?? 18, opp.quoteUsd ?? 1)
      ),
    });
    if (!preflight.ok) {
      if (preflight.emptySelector) {
        const ban = noteEmptySelectorRevert(routeBlacklistKey(opp), opp.detectedBlock || 0, chainId);
        if (ban.blacklisted) {
          console.warn(
            `[BLACKLIST] rute ${opp.tokenPair} ${opp.buyExchange}→${opp.sellExchange} · selector kosong ${ban.streak}x · jeda sampai blok #${ban.untilBlock}`
          );
        }
      }
      return Response.json({ error: preflight.reason || "staticCall reverted" }, { status: 400 });
    }
    return Response.json({
      to: built.to,
      data: built.data,
      gasLimit: preflight.gasLimit,
      opportunity: opp,
    });
  }

  if (body.action === "execute-autonomous") {
    const blocked = scanOnlyExecutionBlockedResponse(body.botMode);
    if (blocked) {
      return Response.json(blocked, { status: 403 });
    }
    try {
      const result = await executeOpportunityAutonomous({
        opportunityId: body.opportunityId,
        opportunityIds: body.opportunityIds,
        extremeApproved: body.extremeApproved,
        config: body.config,
        botMode: body.botMode,
      });
      return Response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Eksekusi otonom gagal.";
      const skipped = (error as { skipped?: Array<{ rank: number; id: string; reason: string }> }).skipped;
      return Response.json({ error: message, skipped }, { status: 400 });
    }
  }

  if (body.action === "report-exec-error") {
    notifyTxFailure({
      message: body.message || "Eksekusi gagal.",
      pair: body.pair,
      route: body.route,
      source: body.source || "manual",
    });
    return Response.json({ ok: true });
  }

  if (body.action === "record-trade") {
    const state = await appendTrade({
      id: `${Date.now()}`,
      at: new Date().toISOString(),
      pair: body.pair || "—",
      route: body.route || "—",
      netProfitWei: body.netProfitWei || "0",
      txHash: body.txHash,
      outcome: "success",
      trace: body.trace,
    });
    if (body.txHash && body.isPro) {
      try {
        scheduleProTradeSuccessNotify({
          isPro: true,
          sandbox: false,
          source: body.source || "mainnet-pro",
          txHash: body.txHash,
          pair: body.pair,
          route: body.route,
          netProfitWei: body.netProfitWei,
          trace: body.trace,
          loanAmountUsd: body.config?.loanAmountUsd,
          chainId: body.chainId || body.config?.chainId,
          quoteDecimals: body.quoteDecimals,
          quoteUsd: body.quoteUsd,
          minProfitUsd: body.minProfitUsd ?? body.config?.minProfitUsd,
          minerTipPct: body.minerTipPct ?? body.config?.minerTipPct ?? body.config?.dynamicBribePercent,
          telegramId: body.telegramId,
          username: body.username,
          email: body.email,
          wallet: body.wallet || body.to,
        });
      } catch (error) {
        console.warn(
          "[bot] telegram Pro notify",
          error instanceof Error ? error.message : error
        );
      }
    }
    return Response.json(state);
  }

  const contractAddress = contractAddressFromEnv(defaultTradingChainId());
  const vaultAddress = vaultContractFromEnv(defaultTradingChainId()) || contractAddress;

  if (body.action === "kill") {
    const state = await setKilled(true);
    const killData = contractAddress
      ? KILL_IFACE.encodeFunctionData("setKilled", [true])
      : undefined;
    return Response.json({ ...state, killData, to: contractAddress || undefined });
  }

  if (body.action === "resume") {
    const state = await setKilled(false);
    const killData = contractAddress
      ? KILL_IFACE.encodeFunctionData("setKilled", [false])
      : undefined;
    return Response.json({ ...state, killData, to: contractAddress || undefined });
  }

  if (body.action === "config" && body.config) {
    const nextConfig = { ...body.config };
    if (body.manual !== true) delete nextConfig.chainId;
    const state = await updateConfig(nextConfig);
    const chainId = authorityChainId();
    return Response.json({ ...state, chainId, config: { ...state.config, chainId }, liveChain: readLiveChain() });
  }

  if (body.action === "withdraw-calldata") {
    const state = await readBotState();
    const to = body.to;
    if (!to) {
      return Response.json({ error: "Hubungkan dompet MetaMask terlebih dahulu." }, { status: 400 });
    }
    const chain = vaultChainOf(state.config.chainId);
    const vault = contractAddressFromEnv(chain) || vaultAddress;
    if (!vault) {
      return Response.json(
        { error: `Alamat executor ${chain} belum di-set di environment.` },
        { status: 400 }
      );
    }
    const token = body.token || ZeroAddress;
    const native = token === ZeroAddress;
    const plan = planWithdraw({
      selectors: null,
      chain,
      native,
      pullAll: true,
      token,
      amount: 0n,
      available: 0n,
      dest: to,
    });
    if (plan.length === 0) {
      return Response.json(
        { error: emptyPlanMessage({ native, pullAll: true, selectors: null, chain }) },
        { status: 400 }
      );
    }
    const killData = KILL_IFACE.encodeFunctionData("setKilled", [true]);
    await setKilled(true);
    return Response.json({
      to: vault,
      data: plan[0].data,
      method: plan[0].method,
      killData,
      killed: true,
    });
  }

  return Response.json({ error: "Aksi tidak dikenal" }, { status: 400 });
}
