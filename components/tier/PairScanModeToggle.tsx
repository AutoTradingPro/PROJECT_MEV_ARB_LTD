"use client";

import { Focus, Layers } from "lucide-react";

export type ProScanMode = "single" | "full";

interface PairScanModeToggleProps {
  mode: ProScanMode;
  onChange: (mode: ProScanMode) => void;
  pairCount: number;
  disabled?: boolean;
}

export default function PairScanModeToggle({
  mode,
  onChange,
  pairCount,
  disabled,
}: PairScanModeToggleProps) {
  const options: { id: ProScanMode; label: string; hint: string; icon: typeof Focus }[] = [
    { id: "single", label: "Single aktif", hint: "Hemat RPC · 1 pair", icon: Focus },
    { id: "full", label: "Full pair Scan", hint: `${pairCount} pair`, icon: Layers },
  ];

  return (
    <div
      className="flex items-center rounded-xl border border-slate-800 bg-slate-950/80 p-0.5"
      role="radiogroup"
      aria-label="Mode pemindaian pair (eksklusif)"
    >
      {options.map(({ id, label, hint, icon: Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 ${
              active
                ? id === "full"
                  ? "bg-gradient-to-r from-violet-500/25 to-indigo-500/20 text-violet-200 border border-violet-500/40 shadow-lg shadow-violet-500/10"
                  : "bg-amber-400/15 text-amber-300 border border-amber-500/40"
                : "text-slate-500 hover:text-slate-300 border border-transparent"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            <span className="hidden sm:inline text-[9px] font-mono font-normal opacity-70">{hint}</span>
          </button>
        );
      })}
    </div>
  );
}
