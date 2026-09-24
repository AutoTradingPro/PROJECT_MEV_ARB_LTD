"use client";

import { useSandbox } from "@/context/SandboxContext";

interface NetworkModeToggleProps {
  variant?: "light" | "dark";
}

export default function NetworkModeToggle({ variant = "light" }: NetworkModeToggleProps) {
  const { isSandbox, setMode } = useSandbox();
  const isDark = variant === "dark";

  return (
    <div className={isDark ? "px-0 py-0 space-y-2" : "px-4 py-3 space-y-2"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-700"}`}>
            Mode Jaringan MEV
          </p>
          <p
            className={`text-[11px] font-semibold mt-0.5 ${
              isSandbox ? (isDark ? "text-cyan-300" : "text-cyan-600") : isDark ? "text-emerald-400" : "text-emerald-600"
            }`}
          >
            {isSandbox ? "Testnet (Sandbox)" : "Mainnet"}
          </p>
          <p className={`text-[10px] mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            {isSandbox ? "Virtual pool · tanpa saldo on-chain" : "Live on-chain"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isSandbox}
          aria-label="Mode Jaringan MEV"
          onClick={() => setMode(isSandbox ? "mainnet" : "sandbox")}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
            isSandbox ? "bg-cyan-500" : isDark ? "bg-slate-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              isSandbox ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
