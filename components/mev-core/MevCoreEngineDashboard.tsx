"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CORE_CHAINS } from "@/components/mev-core/chains";
import MevCoreConsole from "@/components/mev-core/MevCoreConsole";
import MevCoreFeed from "@/components/mev-core/MevCoreFeed";
import MevCoreHeader from "@/components/mev-core/MevCoreHeader";
import MevCoreMetrics from "@/components/mev-core/MevCoreMetrics";
import ScanOnlyModeToggle from "@/components/tier/ScanOnlyModeToggle";
import { useMevCoreLive } from "@/hooks/useMevCoreLive";

const DISPLAY_ETH_USD = 3450;

interface VaultSnapshot {
  chainId?: string;
  amount?: string;
  symbol?: string;
  pair?: string;
}

interface LiveChainSnapshot {
  chainId?: string;
  transport?: "primary" | "backup" | "none";
  connected?: boolean;
  locked?: boolean;
}

interface BotSnapshot {
  killed?: boolean;
  running?: boolean;
  realizedProfitWei?: string;
  lastError?: string;
  chainId?: string;
  vault?: VaultSnapshot;
  liveChain?: LiveChainSnapshot;
}

function weiToEth(wei?: string): number {
  try {
    const value = BigInt(wei || "0");
    const whole = Number(value / 10n ** 14n) / 10_000;
    return Number.isFinite(whole) ? whole : 0;
  } catch {
    return 0;
  }
}

interface MevCoreEngineDashboardProps {
  username?: string;
  onLogout?: () => void;
}

export default function MevCoreEngineDashboard({ username, onLogout }: MevCoreEngineDashboardProps) {
  const [killed, setKilled] = useState(false);
  const [running, setRunning] = useState(false);
  const [profitEth, setProfitEth] = useState(0);
  const [rpcMs, setRpcMs] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [chainId, setChainId] = useState("");
  const live = useMevCoreLive(chainId);
  const [chainPending, setChainPending] = useState<string | null>(null);
  const [vault, setVault] = useState<VaultSnapshot | null>(null);
  const [liveChain, setLiveChain] = useState<LiveChainSnapshot | null>(null);
  const lastErrorRef = useRef("");

  const load = useCallback(async () => {
    const started = performance.now();
    try {
      const res = await fetch(`/api/bot?t=${Date.now()}`, { cache: "no-store" });
      const json = (await res.json()) as BotSnapshot;
      setRpcMs(Math.max(1, Math.round(performance.now() - started)));
      setKilled(Boolean(json.killed));
      setRunning(Boolean(json.running));
      setProfitEth(weiToEth(json.realizedProfitWei));
      if (!chainPending) {
        const authority = json.liveChain?.chainId || json.chainId;
        if (authority) setChainId(authority);
        if (json.liveChain) setLiveChain(json.liveChain);
      }
      if (json.vault?.chainId) setVault(json.vault);
      if (json.lastError && json.lastError !== lastErrorRef.current) {
        lastErrorRef.current = json.lastError;
      }
    } catch {
      setRpcMs(null);
    }
  }, [chainPending]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 4000);
    const installable = process.env.NODE_ENV === "production" || window.location.port === "4100";
    if ("serviceWorker" in navigator && installable) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => window.clearInterval(id);
  }, [load]);

  const onKillToggle = async () => {
    const action = killed ? "resume" : "kill";
    if (action === "kill") {
      const ok = window.confirm("Aktifkan Emergency Kill Switch? Scanner dan eksekusi akan ditahan.");
      if (!ok) return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as BotSnapshot;
      if (!res.ok) throw new Error("Kill switch ditolak.");
      setKilled(Boolean(json.killed));
    } catch {
    } finally {
      setPending(false);
    }
  };

  const onSelectChain = async (nextChainId: string) => {
    if (!nextChainId || chainPending) return;
    setChainPending(nextChainId);
    setChainId(nextChainId);
    setVault(null);
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "adopt-chain", manual: true, config: { chainId: nextChainId } }),
      });
      const json = (await res.json()) as BotSnapshot;
      if (!res.ok) throw new Error("Gagal mengganti jaringan.");
      const nextId = json.chainId || nextChainId;
      setChainId(nextId);
      if (json.liveChain) setLiveChain(json.liveChain);
      if (json.vault?.chainId) setVault(json.vault);
      else setVault(null);
    } catch {
    } finally {
      setChainPending(null);
    }
  };

  const activeChain = CORE_CHAINS.find((chain) => chain.id === chainId);
  const wssConnected = Boolean(liveChain?.connected && liveChain.chainId === chainId);
  const linkLabel = !activeChain
    ? ""
    : wssConnected
      ? `RPC hidup · WSS ${liveChain?.transport === "backup" ? "cadangan" : "primary"}`
      : "RPC/WSS menunggu sambungan";
  const scanLabel =
    chainId === "monad" ? "WMON/USDC · WETH/USDC" : activeChain?.pair || "";
  const routeCount = live.rows.length;
  const liveNote = activeChain
    ? `${activeChain.label} · ${linkLabel} · scan ${scanLabel}${routeCount > 0 ? ` · ${routeCount} rute live` : " · menunggu siklus"}`
    : "";
  const vaultMatches = vault?.chainId === chainId;
  const lines = live.lines;
  const profitUsd = useMemo(() => profitEth * DISPLAY_ETH_USD, [profitEth]);

  return (
    <div className="space-y-3 text-slate-100">
      <MevCoreHeader
        live={running || live.connected}
        killed={killed}
        rpcMs={rpcMs}
        pending={pending}
        username={username}
        onLogout={onLogout}
        onKillToggle={() => void onKillToggle()}
      />
      <ScanOnlyModeToggle />
      <MevCoreMetrics
        profitEth={profitEth}
        profitUsd={profitUsd}
        pools={CORE_CHAINS.length}
        rpcMs={rpcMs}
        activeChainId={chainId}
        pendingChainId={chainPending}
        vaultAmount={vaultMatches ? vault?.amount || "—" : "—"}
        vaultSymbol={vaultMatches ? vault?.symbol || "" : ""}
        vaultPair={vaultMatches && vault?.pair ? vault.pair : activeChain?.pair || ""}
        liveNote={liveNote}
        wssConnected={wssConnected}
        onSelectChain={(next) => void onSelectChain(next)}
      />
      <MevCoreFeed rows={live.rows} />
      <MevCoreConsole lines={lines} connected={live.connected} />
    </div>
  );
}
