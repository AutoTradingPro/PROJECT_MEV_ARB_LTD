import { scanOpportunities, peekScanSignerBalances } from "@/lib/bot/scanner";
import { simulateOpportunity } from "@/lib/bot/executor";
import { executeOpportunityAutonomous } from "@/lib/bot/autonomousExecute";
import { autonomousSignerStatus, formatAutonomousSignerLine } from "@/lib/bot/privateSigner";
import { requireExecutorRpcUrl } from "@/lib/bot/dualProvider";
import { fetchSignerLiveBalances, assertSufficientExecFunds } from "@/lib/bot/signerBalances";
import { getGasPriceWei, peekMemoizedGasWei } from "@/lib/bot/rpc";
import { pickLiveGasWei } from "@/lib/bot/autoExecute";
import { buildExecuteCalldata } from "@/lib/bot/encodeArb";
import { contractAddressFromEnv, vaultContractFromEnv } from "@/lib/bot/constants";
import { defaultTradingChainId, normalizeTradingChainId } from "@/config/networks";
import { hardAdoptScanChain } from "@/lib/bot/scanRuntime";
import { tokenWeiToUsd } from "@/lib/bot/configUnits";
import { preflightDiagFromOpportunity, preflightExecuteCall } from "@/lib/bot/simulate";
import { noteEmptySelectorRevert, routeBlacklistKey } from "@/lib/bot/routeBlacklist";
import { readBotState, setKilled, updateConfig, appendTrade } from "@/lib/bot/store";
import { recordProHeartbeatPing } from "@/lib/bot/heartbeat";
import { notifyTxFailure, scheduleProTradeSuccessNotify } from "@/lib/bot/telegram";
import type { BotConfig, TradeTraceSnapshot } from "@/lib/bot/types";
import { isUserSuspended } from "@/lib/db";
import { Interface } from "ethers";
import { scanOnlyExecutionBlockedResponse } from "@/lib/scanOnly/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KILL_IFACE = new Interface(["function setKilled(bool value)"]);
const WITHDRAW_IFACE = new Interface([
  "function withdraw(uint256 amount)",
  "function withdrawToken(address token, uint256 amount)",
  "function emergencyWithdraw(address token, address to)",
  "function rescueFunds(address tokenAddress)",
  "function rescueFunds(address token, uint256 amount)",
  "function rescueETH()",
]);

export async function GET() {
  try {
    const state = await readBotState();
    const gasChain = normalizeTradingChainId(state.config.chainId);
    return Response.json(
      {
        ...state,
        chainId: gasChain,
        gasPriceWei: pickLiveGasWei(state.gasPriceWei, peekMemoizedGasWei(gasChain).toString()),
        autonomousSigner: autonomousSignerStatus(gasChain),
        autonomousSignerLine: formatAutonomousSignerLine(gasChain),
        signerBalances: peekScanSignerBalances(),
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
    if (body.config?.chainId) {
      hardAdoptScanChain(normalizeTradingChainId(body.config.chainId), "scan-post");
    }
    await updateConfig({
      ...(body.config?.chainId ? { chainId: body.config.chainId } : {}),
      ...(body.config?.pairId ? { pairId: body.config.pairId } : {}),
      ...(body.config?.loanAmountUsd !== undefined ? { loanAmountUsd: body.config.loanAmountUsd } : {}),
      ...(body.config?.aaveFeePct !== undefined ? { aaveFeePct: body.config.aaveFeePct } : {}),
      ...(body.config?.flashLoanProvider ? { flashLoanProvider: body.config.flashLoanProvider } : {}),
      ...(body.config?.flashLoanPlatforms ? { flashLoanPlatforms: body.config.flashLoanPlatforms } : {}),
      ...(body.config?.activeDexIds ? { activeDexIds: body.config.activeDexIds } : {}),
      scanMode,
    });
    const stateBefore = await readBotState();
    const scanChain = normalizeTradingChainId(body.config?.chainId || stateBefore.config.chainId);
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
          });
    const state = await readBotState();
    if (state.killed) {
      return Response.json({
        opportunities: [],
        lastError: "Kill switch global aktif.",
        killed: true,
      });
    }
    const gasChain = normalizeTradingChainId(body.config?.chainId || state.config.chainId);
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
    const chainId = normalizeTradingChainId(body.config?.chainId);
    hardAdoptScanChain(chainId, "ui-tab");
    const state = await updateConfig({
      chainId,
      pairId: body.config?.pairId,
    });
    return Response.json({
      ok: true,
      chainId,
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
    const state = await updateConfig(body.config);
    return Response.json(state);
  }

  if (body.action === "withdraw-calldata") {
    const state = await readBotState();
    const to = body.to;
    if (!to) {
      return Response.json({ error: "Hubungkan dompet MetaMask terlebih dahulu." }, { status: 400 });
    }
    if (!vaultAddress) {
      return Response.json(
        { error: "Set NEXT_PUBLIC_BSC_VAULT_CONTRACT di .env.local ke alamat vault BSC." },
        { status: 400 }
      );
    }
    const data = WITHDRAW_IFACE.encodeFunctionData("rescueFunds", [
      body.token || "0x0000000000000000000000000000000000000000",
    ]);
    const killData = KILL_IFACE.encodeFunctionData("setKilled", [true]);
    await setKilled(true);
    return Response.json({
      to: vaultAddress,
      data,
      killData,
      killed: true,
    });
  }

  return Response.json({ error: "Aksi tidak dikenal" }, { status: 400 });
}
