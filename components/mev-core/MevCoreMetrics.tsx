"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CORE_CHAINS } from "@/components/mev-core/chains";
import { getChain, type ChainId } from "@/lib/chain/networks";

const LINEA_LOGO =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/linea/info/logo.png";

const TOP_CHAINS = CORE_CHAINS.slice(0, 5);
const BOTTOM_CHAINS = CORE_CHAINS.slice(5);

function chainLogo(id: string): string {
  if (id === "linea") return LINEA_LOGO;
  return getChain(id as ChainId).logoUrl;
}

interface MevCoreMetricsProps {
  profitEth: number;
  profitUsd: number;
  pools: number;
  rpcMs: number | null;
  activeChainId: string;
  pendingChainId?: string | null;
  vaultAmount: string;
  vaultSymbol: string;
  vaultPair: string;
  liveNote?: string;
  wssConnected?: boolean;
  onSelectChain: (chainId: string) => void;
}

function useAnimatedNumber(value: number, digits: number): string {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const from = shown;
    const start = performance.now();
    const duration = 700;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // shown is the animation start; including it would restart every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return shown.toFixed(digits);
}

function ChainChip({
  id,
  label,
  active,
  pending,
  disabled,
  live,
  onSelect,
}: {
  id: string;
  label: string;
  active: boolean;
  pending: boolean;
  disabled?: boolean;
  live?: boolean;
  onSelect: (chainId: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled || pending}
      title={disabled ? `${label} belum masuk scanner` : `Pilih ${label}`}
      onClick={() => onSelect(id)}
      className={`flex min-h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-[10px] border px-2 text-sm font-semibold transition ${
        active
          ? "border-cyan-300/80 bg-cyan-400/15 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.18)]"
          : "border-slate-700/70 bg-[#0b1220] text-slate-200 hover:border-cyan-400/40"
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      <Image
        src={chainLogo(id)}
        alt=""
        width={16}
        height={16}
        className="h-4 w-4 shrink-0 rounded-full"
        unoptimized
      />
      <span className="min-w-0 truncate">{label}</span>
      {live ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]" />
      ) : null}
    </button>
  );
}

const CARD_FRAME = "rounded-2xl bg-[linear-gradient(135deg,#67e8f9_0%,#2dd4bf_42%,#34d399_100%)] p-px";
const CARD_BODY = "rounded-[15px] bg-slate-950/75 backdrop-blur-md";

function Sparkline({ ms }: { ms: number | null }) {
  const points = [18, 14, 22, 12, 16, 11, 15, ms ?? 14, 13, 12];
  const max = Math.max(...points, 1);
  const d = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 96;
      const y = 28 - (point / max) * 22;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 96 32" className="h-8 w-24 text-cyan-300" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function MevCoreMetrics({
  profitEth,
  profitUsd,
  pools,
  rpcMs,
  activeChainId,
  pendingChainId,
  vaultAmount,
  vaultSymbol,
  vaultPair,
  liveNote,
  wssConnected = false,
  onSelectChain,
}: MevCoreMetricsProps) {
  const eth = useAnimatedNumber(profitEth, 4);
  const usd = useAnimatedNumber(profitUsd, 2);
  const healthy = rpcMs != null && rpcMs < 250;

  return (
    <section className="grid items-stretch gap-3 lg:grid-cols-[minmax(16rem,0.72fr)_minmax(0,1.7fr)]">
      <div className="grid gap-3">
        <article className={CARD_FRAME}>
          <div className={`${CARD_BODY} p-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Total Profit Today
            </p>
            <p className="mt-3 font-mono text-2xl font-semibold text-cyan-200 sm:text-3xl">
              {eth} ETH
              <span className="text-slate-400"> / ${Number(usd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </p>
          </div>
        </article>

        <article className={CARD_FRAME}>
          <div className={`${CARD_BODY} flex items-center justify-between p-4`}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">RPC Latency</p>
              <p className="mt-2 font-mono text-2xl text-emerald-300">
                {rpcMs == null ? "—" : `${rpcMs}ms`}
                <span className="ml-2 text-sm text-emerald-400/80">{healthy ? "Optimal" : "Check"}</span>
              </p>
            </div>
            <Sparkline ms={rpcMs} />
          </div>
        </article>
      </div>

      <article className={`${CARD_FRAME} flex h-full flex-col`}>
        <div className={`${CARD_BODY} flex h-full flex-col p-4`}>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Active Multi-Chain Status
            </p>
            <p className="mt-1 text-xs text-slate-300">
              <span className="font-mono text-sm text-cyan-200">{pools.toLocaleString("en-US")}</span> networks live
            </p>
            {liveNote ? <p className="mt-1 text-[11px] text-emerald-300">{liveNote}</p> : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Saldo vault</p>
            <p className="mt-1 font-mono text-sm text-cyan-200">
              {vaultAmount} {vaultSymbol}
            </p>
            <p className="text-xs text-slate-400">{vaultPair || "—"}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-1 flex-col justify-center gap-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {TOP_CHAINS.map((chain) => (
              <ChainChip
                key={chain.id}
                id={chain.id}
                label={chain.label}
                active={chain.id === activeChainId}
                pending={pendingChainId === chain.id}
                live={wssConnected && chain.id === activeChainId}
                onSelect={onSelectChain}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {BOTTOM_CHAINS.map((chain) => (
              <ChainChip
                key={chain.id}
                id={chain.id}
                label={chain.label}
                active={chain.id === activeChainId}
                pending={pendingChainId === chain.id}
                live={wssConnected && chain.id === activeChainId}
                onSelect={onSelectChain}
              />
            ))}
          </div>
        </div>
        </div>
      </article>
    </section>
  );
}
