"use client";

import { Radar } from "lucide-react";
import { SCAN_IDLE_INTERVAL_MS } from "@/lib/bot/constants";

interface ScannerToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  sandboxMode?: boolean;
  scanPaceMs?: number;
}

export default function ScannerToggle({
  enabled,
  onChange,
  disabled,
  sandboxMode,
  scanPaceMs = SCAN_IDLE_INTERVAL_MS,
}: ScannerToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
            enabled
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-slate-950 border-slate-800 text-slate-500"
          }`}
        >
          <Radar className={`w-5 h-5 ${enabled ? "animate-pulse" : ""}`} />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-wide">Scanner DEX Otomatis</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {sandboxMode
              ? enabled
                ? `Testnet Pro · scan runtime tiap ${scanPaceMs} ms (tanpa klik Scan Matrix) · auto-exec mengikuti Gas Strategy`
                : "Harga Testnet tetap berdetak; aktifkan scanner untuk auto-execute"
              : enabled
                ? `Memindai & blok live tiap ${scanPaceMs} ms · auto-exec mengikuti Gas Strategy Admin (Slow otonom / Extreme + approval)`
                : "Scanner dimatikan — aktifkan untuk auto-scan dan auto-execute"}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={`relative w-14 h-7 rounded-full transition-colors cursor-pointer disabled:opacity-40 ${
          enabled ? "bg-emerald-500" : "bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-7" : "translate-x-0"
          }`}
        />
        <span className="sr-only">{enabled ? "ON" : "OFF"}</span>
      </button>
    </div>
  );
}
