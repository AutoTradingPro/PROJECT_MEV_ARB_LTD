import { SANDBOX_PRICE_TICK_MS } from "@/lib/sandbox/constants";
import {
  executeSandboxOpportunity,
  scanSandboxOpportunities,
  simulateSandboxOpportunity,
} from "@/lib/sandbox/engine";
import { scheduleProTradeSuccessNotify } from "@/lib/bot/telegram";
import { featuredScanRoute, formatAutoExecuteQueueLine, formatAutoSpreadWaitLine, formatRuntimeScanLine, noteAutoSpreadWaitPeak, rankAutoExecuteQueue, readyOpportunityCount, scanPairHighlights, takeAutoSpreadWaitPeakIfDue } from "@/lib/bot/autoExecute";
import { DEFAULT_BOT_CONFIG } from "@/lib/bot/constants";
import { flashLoanProviderLabel } from "@/lib/bot/flashLoanProviders";
import { recordHeartbeatScan } from "@/lib/bot/heartbeat";
import { appendServerLog } from "@/lib/bot/serverLog";
import { readBotState } from "@/lib/bot/store";
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import { pairsForChain } from "@/lib/chain/tokenPairs";
import { getChain } from "@/lib/chain/networks";
import { normalizeTradingChainId } from "@/config/networks";
import { hardAdoptScanChain } from "@/lib/bot/scanRuntime";
import { isUserSuspended } from "@/lib/db";
import { scanOnlyExecutionBlockedResponse } from "@/lib/scanOnly/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    action?: "scan" | "simulate" | "execute";
    config?: Partial<BotConfig>;
    pairIds?: string[];
    scanMode?: "single" | "full";
    chainId?: string;
    opportunity?: Opportunity;
    opportunityId?: string;
    opportunities?: Opportunity[];
    isPro?: boolean;
    telegramId?: string;
    username?: string;
    email?: string;
    wallet?: string;
    botMode?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Body sandbox kosong atau bukan JSON." }, { status: 400 });
  }

  const chainId = normalizeTradingChainId(body.chainId || body.config?.chainId);
  hardAdoptScanChain(chainId, "sandbox");
  const allPairs = pairsForChain(chainId);
  const scanMode = body.scanMode === "full" ? "full" : "single";
  const requestedIds =
    body.pairIds?.length && body.pairIds.length > 0
      ? body.pairIds
      : body.config?.pairId
        ? [body.config.pairId]
        : [];
  const pairs =
    scanMode === "full"
      ? allPairs
      : allPairs.filter((p) => requestedIds.includes(p.id)).length > 0
        ? allPairs.filter((p) => requestedIds.includes(p.id))
        : allPairs.slice(0, 1);

  if (body.action === "scan") {
    const bot = await readBotState();
    if (bot.killed) {
      return Response.json({
        opportunities: [],
        lastBlock: 0,
        gasPriceWei: "0",
        lastError: "Kill switch global aktif.",
        sandbox: true,
        killed: true,
      });
    }
    const now = Date.now();
    const opportunities = scanSandboxOpportunities({
      pairs,
      config: (body.config || {}) as BotConfig,
      chainId,
      now,
    });
    const lastBlock = 42_000_000 + Math.floor(now / SANDBOX_PRICE_TICK_MS) % 10_000;
    try {
      recordHeartbeatScan({
        routes: opportunities.length,
        ready: opportunities.filter((item) => item.status === "ready").length,
        block: lastBlock,
        ok: true,
      });
    } catch {
      /* ignore */
    }
    const pairHighlights = scanPairHighlights(opportunities);
    const highlight = pairHighlights[0] ?? featuredScanRoute(opportunities);
    const readyCount = readyOpportunityCount(opportunities);
    const maxSpreadBps = highlight?.spreadBps ?? 0;
    const gasPriceWei = (1n * 10n ** 9n).toString();
    console.log(
      formatRuntimeScanLine({
        sandbox: true,
        block: lastBlock,
        routes: opportunities.length,
        ready: readyCount,
        maxSpreadBps,
        gasPriceWei,
        chainId,
        nativeSymbol: getChain(chainId).nativeSymbol === "POL" ? "POL" : getChain(chainId).nativeSymbol === "BNB" ? "BNB" : "ETH",
        provider: flashLoanProviderLabel(body.config?.flashLoanProvider),
        pair: highlight?.pair,
        dexIn: highlight?.dexIn,
        dexOut: highlight?.dexOut,
        pairHighlights,
        scannedPairLabels: pairs.map((item) => item.label),
      })
    );
    const scanConfig = { ...DEFAULT_BOT_CONFIG, ...(body.config || {}) } as BotConfig;
    const execQueue = rankAutoExecuteQueue(opportunities, scanConfig, { sandbox: true });
    if (execQueue.length > 0) {
      console.log(
        formatAutoExecuteQueueLine(execQueue, scanConfig, { sandbox: true, chainId })
      );
    }
    noteAutoSpreadWaitPeak(maxSpreadBps, "testnet");
    if (readyCount === 0) {
      const peak = takeAutoSpreadWaitPeakIfDue(undefined, undefined, "testnet");
      if (peak !== null) {
        const minSpreadPct = body.config?.minSpreadPct ?? 0.5;
        console.log(
          formatAutoSpreadWaitLine({
            maxSpreadBps: peak,
            minSpreadPct,
            provider: flashLoanProviderLabel(body.config?.flashLoanProvider),
            pair: highlight?.pair,
            dexIn: highlight?.dexIn,
            dexOut: highlight?.dexOut,
            chainId,
            sandbox: true,
          })
        );
      }
    }
    return Response.json({
      opportunities,
      lastBlock,
      gasPriceWei,
      lastError: undefined,
      sandbox: true,
      killed: false,
      chainId,
    });
  }

  if (body.action === "simulate") {
    const list = body.opportunities || [];
    const opp =
      list.find((item) => item.id === body.opportunityId) ??
      list.find((item) => item.status === "ready") ??
      body.opportunity;
    return Response.json({ ...simulateSandboxOpportunity(opp), sandbox: true });
  }

  if (body.action === "execute") {
    const blocked = scanOnlyExecutionBlockedResponse(body.botMode);
    if (blocked) {
      return Response.json(blocked, { status: 403 });
    }
    const opp = body.opportunity;
    if (!opp) {
      return Response.json({ error: "Peluang sandbox tidak ditemukan." }, { status: 404 });
    }
    const bot = await readBotState();
    if (bot.killed) {
      return Response.json({ error: "Kill switch global aktif." }, { status: 423 });
    }
    if (
      isUserSuspended({
        username: body.username,
        email: body.email,
        wallet: body.wallet,
        telegramId: body.telegramId,
      })
    ) {
      return Response.json({ error: "Akun di-suspend oleh owner." }, { status: 403 });
    }
    const lastBlock = 42_000_000 + Math.floor(Date.now() / SANDBOX_PRICE_TICK_MS) % 10_000;
    const result = executeSandboxOpportunity({
      opportunity: opp,
      config: body.config as BotConfig | undefined,
      isPro: body.isPro,
      lastBlock,
    });
    appendServerLog({
      level: "exec",
      source: "sandbox",
      message: `TESTNET ${opp.tokenPair} · ${opp.buyExchange} → ${opp.sellExchange} · ${result.txHash}`,
    });
    if (body.isPro && result.ok && result.trade.outcome === "success") {
      try {
        scheduleProTradeSuccessNotify({
          isPro: true,
          sandbox: true,
          source: "testnet-pro",
          txHash: result.txHash,
          pair: result.trade.pair,
          route: result.trade.route,
          netProfitWei: result.netProfitWei,
          trace: result.trade.trace,
          loanAmountUsd: body.config?.loanAmountUsd,
          telegramId: body.telegramId,
          username: body.username,
          email: body.email,
          wallet: body.wallet,
        });
      } catch (error) {
        console.warn(
          "[sandbox] telegram Pro notify",
          error instanceof Error ? error.message : error
        );
      }
    }
    return Response.json({ ...result, sandbox: true });
  }

  return Response.json({ error: "Aksi sandbox tidak dikenal" }, { status: 400 });
}
