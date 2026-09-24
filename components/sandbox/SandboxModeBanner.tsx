"use client";

import { useEffect, useState } from "react";
import { Landmark, RotateCcw } from "lucide-react";

interface SandboxModeBannerProps {
  vaultUsd: number;
  onReset: () => void;
}

function formatVaultUsd(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function SandboxModeBanner({ vaultUsd, onReset }: SandboxModeBannerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <section className="theme-panel flex h-full min-h-0 flex-col rounded-2xl p-5 border border-cyan-500/30 space-y-4 transition-colors duration-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl border border-cyan-500/30 bg-slate-950 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold uppercase tracking-wide">
              Aave Provider Simulation Testnet
            </h2>
            <p className="mt-1 text-[12px] text-slate-400 leading-relaxed max-w-xl">
              Eksekusi Free & Pro memakai virtual pool. Tidak ada transaksi ke blockchain publik.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-300">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Demo
        </span>
      </div>

      <div className="mt-auto rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 space-y-3">
        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
          Saldo Vault Fiktif
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="font-mono text-xl font-black tabular-nums text-cyan-300 tracking-tight">
            {formatVaultUsd(vaultUsd)}
          </p>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-1.5 shrink-0 rounded-lg border border-cyan-400/40 bg-slate-950/40 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-cyan-100 hover:bg-cyan-500/20 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Sandbox
          </button>
        </div>
      </div>
    </section>
  );
}
