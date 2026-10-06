"use client";

import { LogOut, Radio, ShieldAlert } from "lucide-react";
import MevArbHeaderLogo from "@/components/brand/MevArbHeaderLogo";

interface MevCoreHeaderProps {
  live: boolean;
  killed: boolean;
  rpcMs: number | null;
  pending: boolean;
  username?: string;
  onLogout?: () => void;
  onKillToggle: () => void;
}

export default function MevCoreHeader({
  live,
  killed,
  rpcMs,
  pending,
  username,
  onLogout,
  onKillToggle,
}: MevCoreHeaderProps) {
  const healthy = rpcMs != null && rpcMs < 250 && !killed;
  return (
    <header className="flex flex-col gap-3 rounded-2xl border border-cyan-400/25 bg-slate-950/70 p-3 shadow-[0_0_40px_rgba(16,185,129,0.08)] backdrop-blur-md lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <MevArbHeaderLogo className="h-16 w-auto max-w-[7.5rem] shrink-0 rounded-md object-contain object-left sm:h-[4.75rem] sm:max-w-[9.5rem]" />
        <h1 className="bg-[linear-gradient(90deg,#00FF9D_0%,#2EE6A6_32%,#22D3EE_100%)] bg-clip-text text-xl font-black leading-tight tracking-[0.04em] text-transparent sm:text-3xl lg:text-[2.25rem] lg:leading-none lg:tracking-[0.06em]">
          MEV CORE ENGINE
        </h1>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase leading-none tracking-wider ${
            killed
              ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
              : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.28)]"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${killed ? "bg-rose-400" : "animate-pulse bg-emerald-400"}`} />
          {killed ? "Halted" : live ? "Live / Active Multi-Chain" : "Standby"}
        </span>
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-end lg:w-auto">
        <div className="inline-flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-cyan-400/30 bg-slate-900/80 px-3 py-2 text-sm">
          <Radio className={`h-4 w-4 ${healthy ? "text-emerald-400" : "text-amber-300"}`} />
          <span className="text-slate-400">RPC Health</span>
          <span className="font-mono text-cyan-200">
            {rpcMs == null ? "—" : `${rpcMs}ms`}
          </span>
          <span className={healthy ? "text-emerald-400" : "text-amber-300"}>
            {healthy ? "Optimal" : killed ? "Paused" : "Degraded"}
          </span>
        </div>
        <button
          type="button"
          onClick={onKillToggle}
          disabled={pending}
          className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose-500/70 bg-rose-950/40 px-3 text-xs font-black uppercase tracking-wider text-rose-200 shadow-[0_0_18px_rgba(244,63,94,0.25)] transition hover:bg-rose-900/50 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          <ShieldAlert className="h-4 w-4" />
          {pending ? "Working…" : killed ? "Resume Engine" : "Emergency Kill Switch"}
        </button>
        {onLogout || username ? (
          <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-700 px-3 text-sm font-bold text-slate-300 sm:w-auto"
              >
                <LogOut className="h-3.5 w-3.5" />
                Keluar
              </button>
            ) : null}
            {username ? (
              <p className="max-w-56 truncate text-right text-sm font-semibold text-cyan-200">{username}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
