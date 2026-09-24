"use client";

import { useEffect, useRef } from "react";
import { AUTO_EXECUTE } from "@/lib/bot/constants";
import { evaluateGasStrategy } from "@/lib/bot/gasStrategy";
import { formatPct } from "@/lib/bot/configUnits";
import { formatOpportunityNet } from "@/lib/bot/bnbQuote";
import { formatBps } from "@/lib/bot/dexMath";
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import type { TerminalLevel } from "@/hooks/useBotTerminal";
import {
  explainAutoExecuteSkip,
  featuredOpportunity,
  featuredScanRoute,
  formatAutoExecuteQueueLine,
  formatAutoSignalSkipLine,
  formatAutoSpreadWaitLine,
  formatFlashRouteLabel,
  formatQueueRouteLabel,
  networkScanTag,
  gasPriceToGwei,
  isUserRejectedExec,
  maxOpportunitySpreadBps,
  minSpreadBpsFromConfig,
  rankAutoExecuteQueue,
  rotateQueueAfterId,
  spreadMeetsMinimum,
} from "@/lib/bot/autoExecute";
import { flashLoanProviderLabel } from "@/lib/bot/flashLoanProviders";

interface UseProAutoExecuteOptions {
  enabled: boolean;
  killed: boolean;
  executing: boolean;
  opportunities: Opportunity[];
  config: BotConfig;
  gasPriceWei: string;
  execute: (
    opp: Opportunity,
    config: BotConfig,
    queue?: Opportunity[]
  ) => Promise<"ok" | "fail" | "reject">;
  push: (level: TerminalLevel, message: string) => void;
  extremeArmed: boolean;
  onNeedExtremeApproval?: () => void;
  bypassGasGate?: boolean;
}

export function useProAutoExecute({
  enabled,
  killed,
  executing,
  opportunities,
  config,
  gasPriceWei,
  execute,
  push,
  extremeArmed,
  onNeedExtremeApproval,
  bypassGasGate = false,
}: UseProAutoExecuteOptions) {
  const busyRef = useRef(false);
  const lastGlobalAt = useRef(0);
  const haltUntil = useRef(0);
  const consecutiveFails = useRef(0);
  const routeLastAt = useRef<Map<string, number>>(new Map());
  const lastRotateOppId = useRef("");
  const lastSkipReasonRef = useRef("");
  const lastSkipLogAt = useRef(0);
  const lastWaitLogAt = useRef(0);
  const peakSpreadRef = useRef(0);
  const executeRef = useRef(execute);
  const pushRef = useRef(push);
  const configRef = useRef(config);
  const oppsRef = useRef(opportunities);
  const gasRef = useRef(gasPriceWei);
  const armedRef = useRef(extremeArmed);
  const needApprovalRef = useRef(onNeedExtremeApproval);

  executeRef.current = execute;
  pushRef.current = push;
  configRef.current = config;
  oppsRef.current = opportunities;
  gasRef.current = gasPriceWei;
  armedRef.current = extremeArmed;
  needApprovalRef.current = onNeedExtremeApproval;

  const minSpreadPct = config.minSpreadPct;
  const oppCount = opportunities.length;
  const oppTick = maxOpportunitySpreadBps(opportunities);
  const topOppId = opportunities[0]?.id ?? "";

  useEffect(() => {
    if (!enabled) {
      busyRef.current = false;
      consecutiveFails.current = 0;
      haltUntil.current = 0;
      peakSpreadRef.current = 0;
    }
  }, [enabled]);

  const emitSpreadWaitLog = () => {
    const now = Date.now();
    const cfg = configRef.current;
    const tickMax = maxOpportunitySpreadBps(oppsRef.current);
    peakSpreadRef.current = Math.max(peakSpreadRef.current, tickMax);
    const minBps = minSpreadBpsFromConfig(cfg, bypassGasGate);
    if (spreadMeetsMinimum(tickMax, minBps) || spreadMeetsMinimum(peakSpreadRef.current, minBps)) {
      return;
    }
    if (now - lastWaitLogAt.current < AUTO_EXECUTE.spreadWaitLogMs) return;
    lastWaitLogAt.current = now;
    const maxSpread = peakSpreadRef.current;
    peakSpreadRef.current = 0;
    if (!(maxSpread > 0)) return;
    const highlight = featuredScanRoute(oppsRef.current);
    const topReject = [...oppsRef.current]
      .filter((item) => item.status !== "ready")
      .sort((a, b) => (b.spreadBps || 0) - (a.spreadBps || 0))[0];
    pushRef.current(
      "warn",
      formatAutoSpreadWaitLine({
        maxSpreadBps: maxSpread,
        minSpreadPct: cfg.minSpreadPct,
        minSpreadBps: minSpreadBpsFromConfig(cfg, bypassGasGate),
        reason: topReject?.reason,
        provider: flashLoanProviderLabel(cfg.flashLoanProvider),
        pair: highlight?.pair || topReject?.tokenPair,
        dexIn: highlight?.dexIn || topReject?.dexAName || topReject?.buyExchange,
        dexOut: highlight?.dexOut || topReject?.dexBName || topReject?.sellExchange,
        chainId: cfg.chainId,
        sandbox: bypassGasGate,
      })
    );
  };

  useEffect(() => {
    if (!enabled || killed) return;
    emitSpreadWaitLog();
    const timer = window.setInterval(() => {
      emitSpreadWaitLog();
    }, AUTO_EXECUTE.spreadWaitLogMs);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, killed, bypassGasGate, minSpreadPct]);

  useEffect(() => {
    if (!enabled || killed) return;
    const tickMax = maxOpportunitySpreadBps(oppsRef.current);
    peakSpreadRef.current = Math.max(peakSpreadRef.current, tickMax);
    emitSpreadWaitLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, killed, oppCount, oppTick, topOppId, minSpreadPct]);

  useEffect(() => {
    if (!enabled || killed) return;

    const now = Date.now();
    const cfg = configRef.current;
    const opps = oppsRef.current;
    const minBps = minSpreadBpsFromConfig(cfg, bypassGasGate);
    const maxSpread = maxOpportunitySpreadBps(opps);
    const readyCount = opps.filter((item) => item.status === "ready").length;
    // Solana: jangan anggap "sinyal tercapai" dari spot LST saja — butuh status ready (deep net).
    const signaled =
      cfg.chainId === "solana"
        ? readyCount > 0
        : spreadMeetsMinimum(maxSpread, minBps);
    const top = featuredOpportunity(opps);
    const cooldownMs = bypassGasGate
      ? AUTO_EXECUTE.sandboxCooldownMs
      : AUTO_EXECUTE.cooldownMs;
    const routeCooldownMs = bypassGasGate
      ? AUTO_EXECUTE.sandboxRouteCooldownMs
      : AUTO_EXECUTE.routeCooldownMs;

    const logSignalSkip = (reason: string) => {
      if (!signaled) return;
      const line = formatAutoSignalSkipLine({
        maxSpreadBps: maxSpread,
        minSpreadPct: cfg.minSpreadPct,
        minSpreadBps: minBps,
        reason,
        pair: top?.tokenPair,
        dexIn: top?.dexAName || top?.buyExchange,
        dexOut: top?.dexBName || top?.sellExchange,
        chainId: cfg.chainId,
        sandbox: bypassGasGate,
      });
      if (line === lastSkipReasonRef.current && now - lastSkipLogAt.current < AUTO_EXECUTE.signalSkipLogMs) {
        return;
      }
      lastSkipReasonRef.current = line;
      lastSkipLogAt.current = now;
      pushRef.current("warn", line);
    };

    if (executing || busyRef.current) {
      logSignalSkip("transaksi sebelumnya masih berjalan");
      return;
    }
    if (now < haltUntil.current) {
      const waitSec = Math.max(1, Math.ceil((haltUntil.current - now) / 1000));
      logSignalSkip(`jeda pengaman ${waitSec}s setelah gagal/tolak`);
      return;
    }

    const gwei = gasPriceToGwei(gasRef.current);
    const isSolana = cfg.chainId === "solana";
    const gate = bypassGasGate
      ? { ok: true as const, mode: "slow" as const, reason: "sandbox" }
      : evaluateGasStrategy({
          gwei,
          config: cfg,
          extremeArmed: armedRef.current,
          chainId: cfg.chainId,
        });

    // Solana: prioritization fee di-resolve di server (RPC + fallback µLamports).
    // Jangan batalkan auto-exec hanya karena head UI belum sempat terisi.
    if (!bypassGasGate && gwei <= 0 && !isSolana) {
      logSignalSkip("gas price jaringan belum terbaca");
      return;
    }
    if (!gate.ok) {
      if (gate.needApproval) {
        needApprovalRef.current?.();
      }
      logSignalSkip(gate.reason);
      return;
    }

    if (now - lastGlobalAt.current < cooldownMs) {
      const waitSec = Math.max(1, Math.ceil((cooldownMs - (now - lastGlobalAt.current)) / 1000));
      logSignalSkip(`cooldown ${waitSec}s antar transaksi`);
      return;
    }

    const ranked = rankAutoExecuteQueue(opps, cfg, {
      sandbox: bypassGasGate,
    });
    const queue = rotateQueueAfterId(ranked, lastRotateOppId.current);
    if (queue.length === 0) {
      logSignalSkip(explainAutoExecuteSkip({ opportunities: opps, config: cfg, sandbox: bypassGasGate }));
      return;
    }

    const actionable = queue.filter((item) => now - (routeLastAt.current.get(item.id) ?? 0) >= routeCooldownMs);
    if (actionable.length === 0) {
      const head = queue[0];
      const waitSec = Math.max(
        1,
        Math.ceil((routeCooldownMs - (now - (routeLastAt.current.get(head.id) ?? 0))) / 1000)
      );
      logSignalSkip(
        `cooldown rute ${head.buyExchange} → ${head.sellExchange} ${waitSec}s (antrian ${queue.length})`
      );
      return;
    }

    peakSpreadRef.current = 0;
    lastSkipReasonRef.current = "";

    busyRef.current = true;
    lastGlobalAt.current = now;

    const nativeSymbol = cfg.chainId === "bsc" ? "BNB" : cfg.chainId === "polygon" ? "POL" : cfg.chainId === "solana" ? "SOL" : "ETH";
    pushRef.current("match", formatAutoExecuteQueueLine(queue, cfg, { sandbox: bypassGasGate, chainId: cfg.chainId }));

    const applyFailPause = (result: "fail" | "reject") => {
      consecutiveFails.current += 1;
      const fails = consecutiveFails.current;
      const pause =
        result === "reject"
          ? AUTO_EXECUTE.rejectPauseMs
          : fails >= AUTO_EXECUTE.maxConsecutiveFails
            ? AUTO_EXECUTE.haltAfterFailsMs
            : AUTO_EXECUTE.failBackoffMs;
      haltUntil.current = Date.now() + pause;
      if (result === "reject") {
        pushRef.current(
          "warn",
          `[AUTO] MetaMask menolak — jeda ${AUTO_EXECUTE.rejectPauseMs / 1000}s sebelum mencoba lagi.`
        );
      } else if (fails >= AUTO_EXECUTE.maxConsecutiveFails) {
        pushRef.current(
          "warn",
          `[AUTO] ${fails} kegagalan beruntun — jeda ${AUTO_EXECUTE.haltAfterFailsMs / 1000}s agar tidak spam transaksi.`
        );
        consecutiveFails.current = 0;
      } else {
        pushRef.current(
          "warn",
          `[AUTO] Eksekusi gagal (${fails}x) — jeda ${pause / 1000}s (failBackoff ${AUTO_EXECUTE.failBackoffMs / 1000}s). Lihat log [SLIPPAGE] COMPARE expectedOut vs actualOut.`
        );
      }
    };

    void (async () => {
      try {
        if (bypassGasGate) {
          for (let index = 0; index < actionable.length; index += 1) {
            const candidate = actionable[index];
            lastRotateOppId.current = candidate.id;
            const rank = queue.findIndex((item) => item.id === candidate.id) + 1;
            routeLastAt.current.set(candidate.id, Date.now());
            const route = formatFlashRouteLabel({
              provider: flashLoanProviderLabel(cfg.flashLoanProvider),
              pair: candidate.tokenPair,
              dexIn: candidate.buyExchange || candidate.dexAName,
              dexOut: candidate.sellExchange || candidate.dexBName,
            });
            pushRef.current(
              "match",
              `[${networkScanTag(cfg.chainId, true)}] [QUEUE] peringkat ${rank} mencoba ${formatQueueRouteLabel(candidate)} · net ${formatOpportunityNet(candidate, 4, nativeSymbol)}`
            );
            pushRef.current(
              "match",
              `[${networkScanTag(cfg.chainId, true)}] [AUTO] TESTNET · trigger spread ${formatBps(candidate.spreadBps)} ≥ min ${formatPct(cfg.minSpreadPct)} · ${flashLoanProviderLabel(cfg.flashLoanProvider)} · ${route} · net ${formatOpportunityNet(candidate, 4, nativeSymbol)}`
            );
            const result = await executeRef.current(candidate, cfg);
            if (result === "ok") {
              consecutiveFails.current = 0;
              return;
            }
            if (result === "reject") {
              applyFailPause("reject");
              return;
            }
            pushRef.current(
              "warn",
              `[QUEUE] peringkat ${rank} dilewati — sandbox gagal, lanjut kandidat berikutnya`
            );
          }
          applyFailPause("fail");
          return;
        }

        const candidate = actionable[0];
        lastRotateOppId.current = candidate.id;
        routeLastAt.current.set(candidate.id, Date.now());
        const route = formatFlashRouteLabel({
          provider: flashLoanProviderLabel(cfg.flashLoanProvider),
          pair: candidate.tokenPair,
          dexIn: candidate.buyExchange || candidate.dexAName,
          dexOut: candidate.sellExchange || candidate.dexBName,
        });
        pushRef.current(
          "match",
          `[${networkScanTag(cfg.chainId, false)}] [AUTO] ${gate.mode.toUpperCase()} · antrian ${actionable.length} · trigger spread ${formatBps(candidate.spreadBps)} ≥ min ${formatPct(cfg.minSpreadPct)} · ${flashLoanProviderLabel(cfg.flashLoanProvider)} · ${route} · net ${formatOpportunityNet(candidate, 4, nativeSymbol)}`
        );
        const result = await executeRef.current(candidate, cfg, actionable);
        if (result === "ok") {
          consecutiveFails.current = 0;
          return;
        }
        applyFailPause(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        consecutiveFails.current += 1;
        haltUntil.current =
          Date.now() +
          (isUserRejectedExec(message) ? AUTO_EXECUTE.rejectPauseMs : AUTO_EXECUTE.failBackoffMs);
        pushRef.current("error", `[AUTO] ${message}`);
      } finally {
        busyRef.current = false;
      }
    })();
  }, [
    enabled,
    killed,
    executing,
    gasPriceWei,
    extremeArmed,
    bypassGasGate,
    minSpreadPct,
    oppCount,
    oppTick,
    topOppId,
  ]);
}
