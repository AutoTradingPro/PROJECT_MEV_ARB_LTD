"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LoaderCircle, Power } from "lucide-react";
import { formatUsd } from "@/lib/bot/configUnits";
import { formatUsdAsBnb } from "@/lib/bot/bnbQuote";

interface ResultWithdrawCardProps {
  isPro: boolean;
  killed: boolean;
  running: boolean;
  busy: boolean;
  pending?: "kill" | "resume" | "withdraw" | null;
  todayProfitUsd?: number;
  healthFactor?: number;
  sandbox?: boolean;
  vaultUsd?: number;
  companion?: ReactNode;
  onKill: () => void;
  onWithdraw: (withdrawPct: number) => void;
}

function statusMeta(killed: boolean, running: boolean): { label: string; className: string } {
  if (killed) {
    return { label: "DIMATIKAN", className: "text-red-400" };
  }
  if (running) {
    return { label: "AKTIF", className: "text-emerald-400" };
  }
  return { label: "STANDBY", className: "text-sky-400" };
}

function formatSignedUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "+$0.00";
  const formatted = formatUsd(Math.abs(value));
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

export default function ResultWithdrawCard({
  isPro,
  killed,
  running,
  busy,
  pending = null,
  todayProfitUsd = 0,
  healthFactor = 1.5,
  sandbox = false,
  vaultUsd: _vaultUsd = 0,
  companion,
  onKill,
  onWithdraw,
}: ResultWithdrawCardProps) {
  const [withdrawPct, setWithdrawPct] = useState(0);
  const status = statusMeta(killed, running);
  const thumbLeft = useMemo(() => Math.min(100, Math.max(0, withdrawPct)), [withdrawPct]);
  const availableUsd = Number.isFinite(todayProfitUsd) ? Math.max(0, todayProfitUsd) : 0;
  const sliderAtZero = withdrawPct === 0;
  const resultUsd = sliderAtZero ? 0 : availableUsd;
  const withdrawalUsd = sliderAtZero ? 0 : (availableUsd * withdrawPct) / 100;
  const liquidationSafe = !killed && healthFactor >= 1.2;
  const liquidationLabel = liquidationSafe
    ? `Status Likuidasi Otomatis: Aman (Health Factor: ${healthFactor.toFixed(1)})`
    : "Status Likuidasi Otomatis: Ditangguhkan";

  const combinedCard = (
    <section className="theme-panel flex h-full w-full min-h-0 flex-col rounded-2xl p-3.5 sm:p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-bold tracking-wide">RESULT</h3>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Withdraw</span>
        </div>
        <span className={`text-[10px] font-mono font-bold ${sandbox ? "text-cyan-400" : status.className}`}>
          {sandbox ? "SANDBOX" : status.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex min-w-0 flex-col justify-center rounded-lg border border-slate-800 bg-black px-2.5 py-1.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500">
            {sandbox ? "Vault Fiktif / Profit" : "Result"}
          </span>
          <span className="mt-0.5 truncate font-mono text-sm font-bold tabular-nums text-emerald-400">
            {sandbox ? formatUsdAsBnb(todayProfitUsd) : formatUsd(resultUsd)}
          </span>
        </div>
        <div className="flex min-w-0 flex-col justify-center rounded-lg border border-slate-800 bg-black px-2.5 py-1.5">
          <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Withdrawal Value</span>
          <span className="mt-0.5 truncate font-mono text-sm font-bold tabular-nums text-amber-300">
            {sandbox ? formatUsdAsBnb(withdrawalUsd) : formatUsd(withdrawalUsd)}
          </span>
        </div>
      </div>

      <div>
        <div className="relative mb-0.5 h-3.5">
          <span className="absolute left-0 text-[10px] font-mono text-slate-500">0%</span>
          <span
            className="absolute text-[10px] font-mono font-bold text-slate-300"
            style={{
              left: `${thumbLeft}%`,
              transform:
                thumbLeft <= 4 ? "none" : thumbLeft >= 96 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {withdrawPct}%
          </span>
          <span className="absolute right-0 text-[10px] font-mono text-slate-500">100%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={withdrawPct}
          aria-label="Persentase penarikan dana"
          onChange={(event) => setWithdrawPct(Number(event.target.value))}
          className="w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-emerald-500 [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-emerald-500 [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(239,68,68,0.7)] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-red-500"
        />
      </div>

      <div className="space-y-0.5">
        <p className="text-[10px] font-mono font-semibold text-emerald-400">
          Total Profit Hari Ini: {sandbox ? `+${formatUsdAsBnb(todayProfitUsd)}` : formatSignedUsd(todayProfitUsd)}
        </p>
        <p className="text-[10px] font-mono font-semibold text-sky-400">{liquidationLabel}</p>
      </div>

      <div className="mt-auto space-y-1 pt-0.5">
        <div className="flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => setWithdrawPct(100)}
            className="text-[10px] font-bold uppercase tracking-wide text-amber-300 hover:text-amber-200 cursor-pointer disabled:opacity-40"
          >
            Max
          </button>
        </div>
        <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || killed || !isPro}
          onClick={onKill}
          className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_0_16px_rgba(239,68,68,0.55)] hover:bg-red-500 disabled:opacity-40 cursor-pointer"
        >
          {pending === "kill" ? (
            <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <Power className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{pending === "kill" ? "Stop…" : "Emergency Kill"}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onWithdraw(withdrawPct)}
          className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-40 cursor-pointer"
        >
          {pending === "withdraw" ? "…" : "Tarik Dana"}
        </button>
        </div>
      </div>
    </section>
  );

  if (!companion) {
    return <div className="w-full">{combinedCard}</div>;
  }

  return (
    <div className="grid w-full grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
      <div className="flex h-full min-h-0 min-w-0">{combinedCard}</div>
      <div className="flex h-full min-h-0 min-w-0">{companion}</div>
    </div>
  );
}
