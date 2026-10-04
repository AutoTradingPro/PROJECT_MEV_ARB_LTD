"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatPct, formatUsd } from "@/lib/bot/configUnits";
import { formatGasGweiLabel, formatScanTimestamp, scanLogBelongsToActiveChain } from "@/lib/bot/autoExecute";
import { AUTO_EXECUTE } from "@/lib/bot/constants";
import { flashLoanProviderLabel } from "@/lib/bot/flashLoanProviders";
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import type { DumpToken } from "@/lib/sandbox/hardhatTxDump";

export type TerminalLevel = "info" | "scan" | "match" | "exec" | "profit" | "warn" | "error" | "dump";

export type TerminalTokenTone = DumpToken["tone"];
export type TerminalToken = DumpToken;

export interface TerminalEntry {
  id: string;
  at: string;
  level: TerminalLevel;
  message: string;
  href?: string;
  hrefLabel?: string;
  tokens?: TerminalToken[];
  dump?: boolean;
}

interface UseBotTerminalOptions {
  config: BotConfig;
  opportunities: Opportunity[];
  scannerEnabled: boolean;
  killed: boolean;
  scanPhase: "idle" | "loading" | "success" | "error";
  liveBlock: number;
  gasPriceWei?: string;
  suppressScanCycleLogs?: boolean;
  activeChainId?: string;
}

function ts(): string {
  return formatScanTimestamp();
}

function levelClass(level: TerminalLevel): string {
  switch (level) {
    case "scan":
      return "text-cyan-400";
    case "match":
      return "text-emerald-400";
    case "exec":
      return "text-amber-300";
    case "profit":
      return "text-emerald-300 font-bold";
    case "warn":
      return "text-amber-400";
    case "error":
      return "text-red-400";
    case "dump":
      return "text-slate-300";
    default:
      return "text-slate-300";
  }
}

export { levelClass };

export function useBotTerminal({
  config,
  opportunities,
  scannerEnabled,
  killed,
  scanPhase,
  liveBlock,
  gasPriceWei,
  suppressScanCycleLogs = false,
  activeChainId,
}: UseBotTerminalOptions) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [sessionProfitWei, setSessionProfitWei] = useState(0n);
  const [sessionTrades, setSessionTrades] = useState(0);
  const lastScanPhase = useRef(scanPhase);
  const lastBlock = useRef(0);
  const chainRef = useRef(activeChainId);
  chainRef.current = activeChainId;

  const push = useCallback(
    (
      level: TerminalLevel,
      message: string,
      link?: { href?: string; label?: string; tokens?: TerminalToken[]; dump?: boolean }
    ) => {
      if (!scanLogBelongsToActiveChain(message, chainRef.current)) return;
      setEntries((prev) => {
        const next = [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            at: ts(),
            level,
            message,
            href: link?.href,
            hrefLabel: link?.label,
            tokens: link?.tokens,
            dump: link?.dump,
          },
        ];
        return next.slice(-220);
      });
    },
    []
  );

  useEffect(() => {
    setEntries((prev) => {
      const kept = prev.filter((entry) => scanLogBelongsToActiveChain(entry.message, activeChainId));
      return kept.length === prev.length ? prev : kept;
    });
  }, [activeChainId]);

  useEffect(() => {
    if (!scannerEnabled) return;
    push(
      "info",
      `Bot Pro aktif · ${flashLoanProviderLabel(config.flashLoanProvider)} · ${config.gasStrategyMode === "extreme" ? "EXTREME" : "SLOW"} · auto-exec · gas live jaringan (tanpa plafon) · cooldown ${AUTO_EXECUTE.cooldownMs / 1000}s→${AUTO_EXECUTE.hotCooldownMs / 1000}s near target · loan 2% likuiditas pool · min profit loan×0.10% · spread ≥ ${formatPct(config.minSpreadPct)}`
    );
  }, [scannerEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (killed && scannerEnabled) {
      push("warn", "Emergency kill switch AKTIF — eksekusi otomatis dijeda.");
    }
  }, [killed, scannerEnabled, push]);

  useEffect(() => {
    if (suppressScanCycleLogs) return;
    if (!scannerEnabled || killed) return;
    if (scanPhase === "loading" && lastScanPhase.current !== "loading") {
      push("scan", `[SCAN] Memindai matrix DEX · blok #${liveBlock || "—"} · gas: ${formatGasGweiLabel(gasPriceWei)}…`);
    }
    if (scanPhase === "success" && lastScanPhase.current === "loading") {
      const ready = opportunities.filter((o) => o.status === "ready");
      push(
        "scan",
        `[SCAN] Selesai · ${opportunities.length} baris · ${ready.length} lolos filter operasional · gas: ${formatGasGweiLabel(gasPriceWei)}`
      );
    }
    lastScanPhase.current = scanPhase;
  }, [scanPhase, scannerEnabled, killed, opportunities, liveBlock, gasPriceWei, push, suppressScanCycleLogs]);

  useEffect(() => {
    if (!scannerEnabled || killed) return;
    if (liveBlock > 0 && liveBlock !== lastBlock.current) {
      lastBlock.current = liveBlock;
    }
  }, [liveBlock, scannerEnabled, killed]);

  const recordSessionTrade = useCallback((netProfitWei: string) => {
    try {
      const profit = BigInt(netProfitWei || "0");
      if (profit <= 0n) return;
      setSessionProfitWei((p) => p + profit);
      setSessionTrades((t) => t + 1);
    } catch {
      /* ignore */
    }
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  const resetSession = useCallback(() => {
    setEntries([]);
    setSessionProfitWei(0n);
    setSessionTrades(0);
  }, []);

  const sessionProfitUsd = Number(sessionProfitWei) / 1e18;

  return {
    entries,
    sessionProfitWei: sessionProfitWei.toString(),
    sessionProfitUsd,
    sessionTrades,
    clear,
    resetSession,
    push,
    recordSessionTrade,
  };
}
