"use client";

import { Gauge } from "lucide-react";
import { useBotConfig } from "@/context/BotConfigContext";
import { gasPriceToGwei } from "@/lib/bot/autoExecute";
import { normalizeGasStrategyMode, type GasStrategyMode } from "@/lib/bot/gasStrategy";
import { useEffect, useState } from "react";
import { shortenAddress } from "@/lib/wallet/provider";

interface GasStrategyPanelProps {
  liveGasWei?: string;
}

export default function GasStrategyPanel({ liveGasWei = "0" }: GasStrategyPanelProps) {
  const { config, patchConfig } = useBotConfig();
  const mode = normalizeGasStrategyMode(config.gasStrategyMode);
  const liveGwei = gasPriceToGwei(liveGasWei);
  const [signer, setSigner] = useState<{
    ready: boolean;
    address?: string;
    matchesOwner?: boolean;
    source?: string;
  }>({ ready: false });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/bot?t=${Date.now()}`, { cache: "no-store" });
        const json = (await res.json()) as {
          autonomousSigner?: { ready?: boolean; address?: string; matchesOwner?: boolean; source?: string };
        };
        if (!cancelled && json.autonomousSigner) {
          setSigner({
            ready: Boolean(json.autonomousSigner.ready),
            address: json.autonomousSigner.address,
            matchesOwner: json.autonomousSigner.matchesOwner,
            source: json.autonomousSigner.source,
          });
        }
      } catch {
        /* ignore */
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = (next: GasStrategyMode) => {
    patchConfig({ gasStrategyMode: next });
  };

  return (
    <section className="theme-panel rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Gauge className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide">Gas Strategy & Autonomous Control</h2>
          <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
            Gas mengikuti harga live tiap jaringan (tanpa plafon gwei). Eksekusi tetap ditolak jika laba
            bersih tidak mencapai 0.05% dari loan. Mode Extreme hanya menambah bump prioritas, bukan cap.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("slow")}
          className={`rounded-xl border px-3 py-3 text-left cursor-pointer ${
            mode === "slow"
              ? "border-emerald-500/50 bg-emerald-500/10"
              : "border-slate-700 bg-slate-950/40 hover:border-slate-500"
          }`}
        >
          <p className="text-xs font-bold text-emerald-300">Mode Slow</p>
          <p className="mt-1 text-[10px] text-slate-400 leading-snug">
            Eksekusi otonom, gas live jaringan, tanpa MetaMask.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setMode("extreme")}
          className={`rounded-xl border px-3 py-3 text-left cursor-pointer ${
            mode === "extreme"
              ? "border-red-500/50 bg-red-500/10"
              : "border-slate-700 bg-slate-950/40 hover:border-slate-500"
          }`}
        >
          <p className="text-xs font-bold text-red-300">Mode Extreme</p>
          <p className="mt-1 text-[10px] text-slate-400 leading-snug">
            Bump prioritas lebih agresif; filter tetap loan × 0.05%.
          </p>
        </button>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-3 text-[11px] text-slate-400 leading-relaxed">
        Plafon Max Gas Slow/Extreme tidak dipakai. Bid gas = fee jaringan saat ini
        {liveGwei > 0 ? ` (${liveGwei.toFixed(4)} gwei)` : ""}.
      </div>

      <dl className="grid gap-2 sm:grid-cols-2 text-[11px] font-mono">
        <div className="theme-panel-muted rounded-lg px-3 py-2">
          <dt className="text-slate-500 uppercase text-[9px]">Gas jaringan</dt>
          <dd className="mt-0.5 text-amber-300">{liveGwei > 0 ? `${liveGwei.toFixed(2)} gwei` : "—"}</dd>
        </div>
        <div className="theme-panel-muted rounded-lg px-3 py-2">
          <dt className="text-slate-500 uppercase text-[9px]">Signer otonom</dt>
          <dd
            className={`mt-0.5 ${
              signer.ready && signer.matchesOwner !== false ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            {signer.ready
              ? `${shortenAddress(signer.address || "")}${signer.matchesOwner === false ? " · bukan owner" : ""}`
              : config.chainId === "polygon"
                ? "PRIVATE_KEY_POLYGON belum siap"
                : config.chainId === "arbitrum"
                ? "PRIVATE_KEY_ARBITRUM belum siap"
                : "PRIVATE_KEY_BSC belum siap"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
