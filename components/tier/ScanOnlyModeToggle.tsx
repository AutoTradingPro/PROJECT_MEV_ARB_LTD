"use client";

import { ShieldAlert } from "lucide-react";
import { useBotMode } from "@/context/BotModeContext";

export default function ScanOnlyModeToggle() {
  const { botMode, isScanOnly, setBotMode } = useBotMode();

  return (
    <div className="flex items-center justify-between gap-4 bg-slate-900 border border-cyan-500/25 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
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
      <button
        type="button"
        role="switch"
        aria-checked={isScanOnly}
        onClick={() => setBotMode(isScanOnly ? "EXECUTE" : "SCAN_ONLY")}
        className={`relative w-14 h-7 rounded-full transition-colors cursor-pointer shrink-0 ${
          isScanOnly ? "bg-cyan-500" : "bg-amber-500"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
            isScanOnly ? "translate-x-7" : "translate-x-0"
          }`}
        />
        <span className="sr-only">{botMode}</span>
      </button>
    </div>
  );
}
