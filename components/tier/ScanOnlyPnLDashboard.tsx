"use client";

import { Activity, ShieldCheck } from "lucide-react";
import type { ScanOnlyReport } from "@/lib/scanOnly/types";
import { MIN_NET_PROFIT_USD } from "@/lib/scanOnly/config.js";

function usd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "$0.00";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(2)}`;
}

function pct(bps: number): string {
  if (!Number.isFinite(bps)) return "—";
  return `${(bps / 100).toFixed(2)}%`;
}

function statusClass(status: string): string {
  if (status === "layak") return "text-emerald-400";
  if (status === "tipis") return "text-amber-300";
  return "text-slate-500";
}

interface ScanOnlyPnLDashboardProps {
  report: ScanOnlyReport | null;
  scanning?: boolean;
}

export default function ScanOnlyPnLDashboard({ report, scanning }: ScanOnlyPnLDashboardProps) {
  const rows = report?.rows ?? [];
  const minSpread = report?.minSpreadPct ?? 0.5;
  const maxSpread = report?.maxSpotSpreadPct ?? 5;
  const maxImpact = report?.maxPriceImpactPct ?? 1;
  const bribePct = report?.bribePct ?? 0.5;
  const minNet = report?.minNetProfitUsd ?? MIN_NET_PROFIT_USD;

  return (
    <div className="w-full bg-slate-900 border border-cyan-500/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold tracking-wide flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-300" />
            P&amp;L Analytics Dashboard
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border text-cyan-300 border-cyan-500/40 bg-cyan-500/10">
              SCAN_ONLY
            </span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            Filter operasional: spread {minSpread.toFixed(2)}%–{maxSpread.toFixed(1)}% · impact ≤{" "}
            {maxImpact.toFixed(2)}% · bribe {bribePct.toFixed(2)}% dari Gross · lantai net ${minNet}. Tanpa tx
            on-chain.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
          <Activity className="w-3 h-3" />
          {scanning ? "Memindai…" : report ? `Blok #${report.blockNumber || "—"}` : "Menunggu siklus"}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] uppercase text-slate-500">Layak</span>
          <p className="font-mono text-emerald-400 font-bold mt-1">{report?.layakCount ?? 0}</p>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] uppercase text-slate-500">Tipis / Rawan</span>
          <p className="font-mono text-amber-300 font-bold mt-1">{report?.tipisCount ?? 0}</p>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] uppercase text-slate-500">Skip</span>
          <p className="font-mono text-slate-400 font-bold mt-1">{report?.skipCount ?? 0}</p>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] uppercase text-slate-500">Best net</span>
          <p className="font-mono text-cyan-300 font-bold mt-1">{usd(report?.bestNetUsd ?? 0)}</p>
        </div>
      </div>

      <div className="touch-scroll">
        <table className="w-full text-left text-[11px] font-mono">
          <thead>
            <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
              <th className="py-2 pr-2">No</th>
              <th className="py-2 pr-3">Pair</th>
              <th className="py-2 pr-3">Route</th>
              <th className="py-2 pr-3 text-right">Spread</th>
              <th className="py-2 pr-3 text-right">Pool TVL (Est)</th>
              <th className="py-2 pr-3 text-right">Max Safe Loan</th>
              <th className="py-2 pr-3 text-right">Gross</th>
              <th className="py-2 pr-3 text-right">Fee DEX</th>
              <th className="py-2 pr-3 text-right">Bribe</th>
              <th className="py-2 pr-3 text-right">Gas</th>
              <th className="py-2 pr-3 text-right">Est. Net</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-4 text-slate-500">
                  Aktifkan Scanner DEX atau tekan Scan Matrix untuk memindai 10 pair jaringan aktif.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.pairId}-${row.route}`} className="border-b border-slate-800/60">
                  <td className="py-2 pr-2 text-slate-500">{row.no}</td>
                  <td className="py-2 pr-3 text-slate-200 whitespace-nowrap">{row.pair}</td>
                  <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{row.route}</td>
                  <td className="py-2 pr-3 text-right text-slate-400">{pct(row.spreadBps)}</td>
                  <td className="py-2 pr-3 text-right text-slate-400">{usd(row.poolTvlUsd)}</td>
                  <td className="py-2 pr-3 text-right text-slate-200">{usd(row.maxSafeLoanUsd)}</td>
                  <td className="py-2 pr-3 text-right text-slate-400">{usd(row.grossUsd)}</td>
                  <td className="py-2 pr-3 text-right text-slate-400">{usd(row.dexFeeUsd)}</td>
                  <td className="py-2 pr-3 text-right text-slate-400">{usd(row.bribeUsd)}</td>
                  <td className="py-2 pr-3 text-right text-slate-400">{usd(row.gasUsd)}</td>
                  <td
                    className={`py-2 pr-3 text-right font-bold ${
                      row.status === "layak"
                        ? "text-emerald-400"
                        : row.status === "tipis"
                          ? "text-amber-300"
                          : "text-slate-500"
                    }`}
                  >
                    {usd(row.netUsd)}
                  </td>
                  <td className={`py-2 max-w-[14rem] ${statusClass(row.status)}`} title={row.reason}>
                    {row.statusLabel}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
