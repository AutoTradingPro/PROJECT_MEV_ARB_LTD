"use client";

import { ShieldAlert } from "lucide-react";
import { useBotMode } from "@/context/BotModeContext";

interface ScanOnlyModeToggleProps {
  killed?: boolean;
  pending?: boolean;
  onKillToggle?: () => void;
}

export default function ScanOnlyModeToggle({
  killed = false,
  pending = false,
  onKillToggle,
}: ScanOnlyModeToggleProps) {
  const { botMode, isScanOnly, setBotMode } = useBotMode();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-cyan-500/25 rounded-2xl px-5 py-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
            isScanOnly
              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
              : "bg-amber-500/10 border-amber-500/30 text-amber-300"
          }`}
        >
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-wide">Scan &amp; Analysis Mode</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isScanOnly
              ? "BOT_MODE=SCAN_ONLY · memindai 10 pair + P&L tanpa transaksi / flash loan"
              : "BOT_MODE=EXECUTE · eksekusi on-chain diizinkan (risiko gas & modal aktif)"}
          </p>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <span
          className={`whitespace-nowrap text-[10px] font-bold uppercase tracking-wide sm:text-[11px] ${
            isScanOnly ? "text-slate-500" : "text-amber-300"
          }`}
        >
          Bot Aktif
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isScanOnly}
          onClick={() => setBotMode(isScanOnly ? "EXECUTE" : "SCAN_ONLY")}
          className={`relative h-7 w-14 shrink-0 cursor-pointer rounded-full transition-colors ${
            isScanOnly ? "bg-cyan-500" : "bg-amber-500"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              isScanOnly ? "translate-x-7" : "translate-x-0"
            }`}
          />
          <span className="sr-only">{botMode}</span>
        </button>
        <span
          className={`whitespace-nowrap text-[10px] font-bold uppercase tracking-wide sm:text-[11px] ${
            isScanOnly ? "text-cyan-300" : "text-slate-500"
          }`}
        >
          Scan Only
        </span>
        {onKillToggle ? (
          <button
            type="button"
            onClick={onKillToggle}
            disabled={pending}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose-500/70 bg-rose-950/40 px-3 text-[10px] font-black uppercase tracking-wider text-rose-200 shadow-[0_0_18px_rgba(244,63,94,0.25)] transition hover:bg-rose-900/50 disabled:cursor-wait disabled:opacity-60 sm:text-xs"
          >
            <ShieldAlert className="h-4 w-4" />
            {pending ? "Working…" : killed ? "Resume Engine" : "Emergency Kill Switch"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
