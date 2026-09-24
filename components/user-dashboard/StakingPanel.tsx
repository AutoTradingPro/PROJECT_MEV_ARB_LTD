"use client";

import { useState } from "react";
import { Landmark, LoaderCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatUsd } from "@/lib/user-dashboard";

export default function StakingPanel() {
  const { user, patchUser } = useAuth();
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState<"stake" | "unstake" | null>(null);

  if (!user) return null;

  const parsed = Number(amount);
  const canStake = Number.isFinite(parsed) && parsed > 0;

  const stake = async () => {
    if (!canStake) return;
    setBusy("stake");
    await new Promise((r) => setTimeout(r, 350));
    const next = user.stakedUsd + parsed;
    patchUser({ stakedUsd: next, stakingActive: next > 0 });
    setBusy(null);
  };

  const unstake = async () => {
    if (user.stakedUsd <= 0) return;
    setBusy("unstake");
    await new Promise((r) => setTimeout(r, 350));
    patchUser({ stakedUsd: 0, stakingActive: false });
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Ringkasan program staking akun ini. Status tersimpan di perangkat sampai backend live.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-500/20 bg-black/40 px-4 py-4">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Dana di-staking</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-amber-300">{formatUsd(user.stakedUsd)}</p>
        </div>
        <div className="theme-panel-muted rounded-xl px-4 py-4">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Status staking</p>
          <p className="mt-2">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                user.stakingActive
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-slate-600 bg-slate-800/80 text-slate-400"
              }`}
            >
              {user.stakingActive ? "Aktif" : "Tidak"}
            </span>
          </p>
        </div>
      </div>

      <div className="theme-panel rounded-2xl p-4 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide">
          <Landmark className="w-4 h-4 text-amber-400" />
          Interaksi staking
        </h3>
        <label className="block space-y-1.5 max-w-sm">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Nominal stake (USD)</span>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500">$</span>
            <input
              type="number"
              min={0}
              step={10}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="theme-input w-full rounded-lg py-2 pl-6 pr-2 font-mono text-sm focus:outline-none focus:border-amber-400/40"
            />
          </div>
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={!canStake || busy !== null}
            onClick={() => void stake()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300 cursor-pointer disabled:opacity-40"
          >
            {busy === "stake" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Stake
          </button>
          <button
            type="button"
            disabled={user.stakedUsd <= 0 || busy !== null}
            onClick={() => void unstake()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-800 cursor-pointer disabled:opacity-40"
          >
            {busy === "unstake" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Unstake semua
          </button>
        </div>
      </div>
    </div>
  );
}
