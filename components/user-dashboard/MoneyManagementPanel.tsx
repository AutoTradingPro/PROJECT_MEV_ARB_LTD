"use client";

import AdminView from "@/components/admin/AdminView";
import NetworkModeToggle from "@/components/settings/NetworkModeToggle";
import OperationalConfigBar from "@/components/tier/OperationalConfigBar";
import { useBotConfig } from "@/context/BotConfigContext";
import { useSandbox } from "@/context/SandboxContext";

export default function MoneyManagementPanel() {
  const { config, setConfig } = useBotConfig();
  const { isSandbox } = useSandbox();

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Pengaturan modal, pinjaman kilat, gas, notifikasi, dan vault. Slippage dihitung
        otomatis di server. Standar global: minAmountOut = repay + gas + tip + loan × 0.05%. Slippage adaptif 0.5%–1.0%. Toggle jaringan memakai status yang sama
        dengan <span className="text-slate-200 font-semibold">Mode Jaringan MEV</span> di
        menu kanan. Input Dynamic Bribe dan loan amount tersinkron dengan Konfigurasi
        Operasional.
      </p>

      <section className="theme-panel rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold tracking-wide text-slate-100">Jaringan eksekusi</h3>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              isSandbox
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {isSandbox ? "Testnet" : "Mainnet"}
          </span>
        </div>
        <NetworkModeToggle variant="dark" />
      </section>

      <OperationalConfigBar config={config} onChange={setConfig} />
      <AdminView embedded />
    </div>
  );
}
