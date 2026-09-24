"use client";

import { Crown, Hand } from "lucide-react";
import { useTier, type TierMode } from "@/context/TierContext";

export default function TierModeSwitcher() {
  const { mode, setMode } = useTier();

  const options: { id: TierMode; label: string; hint: string; icon: typeof Hand }[] = [
    { id: "free", label: "Free", hint: "Manual", icon: Hand },
    { id: "pro", label: "Pro", hint: "Auto Bot", icon: Crown },
  ];

  return (
    <div
      className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-0.5 shadow-inner"
      role="tablist"
      aria-label="Mode tier"
    >
      {options.map(({ id, label, hint, icon: Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMode(id)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              active
                ? id === "pro"
                  ? "bg-gradient-to-r from-amber-500/25 to-amber-400/15 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10"
                  : "bg-slate-800 text-emerald-300 border border-emerald-500/30"
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
