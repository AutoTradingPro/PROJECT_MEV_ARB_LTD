"use client";

import type { FeedBadge, FeedRow } from "@/components/mev-core/types";
import { netProfitUsdFromSpread } from "@/lib/bot/feedNet";

const BADGE: Record<FeedBadge, string> = {
  validated: "border-emerald-400/70 bg-emerald-400/15 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.35)]",
  ready: "border-yellow-300/70 bg-yellow-300/10 text-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.25)]",
  queued: "border-sky-300/80 bg-sky-300/20 text-sky-100 shadow-[0_0_12px_rgba(125,211,252,0.45)]",
  executed: "border-cyan-300/70 bg-cyan-400/10 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.3)]",
  reverted: "border-slate-600 bg-slate-800/80 text-slate-400",
  skipped: "border-slate-700 bg-slate-900 text-slate-500",
};

function money(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function usdDigits(value: number): number {
  const abs = Math.abs(value);
  if (abs !== 0 && abs < 0.01) return 6;
  if (abs < 1) return 4;
  return 2;
}

function rowEconomics(row: FeedRow): { netUsd: number; netEth: number } | null {
  if (typeof row.loanUsd !== "number" || !Number.isFinite(row.loanUsd)) return null;
  const netUsd = netProfitUsdFromSpread({
    loanUsd: row.loanUsd,
    spreadPct: row.spreadPct,
    gasUsd: row.gasUsd,
    bribeUsd: row.bribeUsd,
  });
  const ethPerUsd = row.gasUsd && row.gasUsd > 0 ? row.gasEth / row.gasUsd : 0;
  return { netUsd, netEth: netUsd * ethPerUsd };
}

function tone(value: number): string {
  if (value < 0) return "text-rose-300";
  if (value > 0) return "text-emerald-300";
  return "text-slate-400";
}

const LABEL: Record<FeedBadge, string> = {
  validated: "Validated",
  ready: "Ready",
  queued: "Queued",
  executed: "Executed",
  reverted: "Reverted",
  skipped: "Skipped",
};

export default function MevCoreFeed({ rows }: { rows: FeedRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950/55 backdrop-blur-md">
      <div className="border-b border-white/5 bg-[linear-gradient(90deg,#0E3A2D_0%,#123231_45%,#142632_100%)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B2C7C0]">
        Live Arbitrage Feed
      </div>
      <div className="space-y-2 p-3 md:hidden">
        {rows.map((row) => {
          const net = rowEconomics(row);
          return (
          <article key={row.id} className="rounded-xl border border-emerald-400/15 bg-slate-950/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-100">{row.pair}</p>
                <p className="text-xs text-slate-400">{row.route}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${BADGE[row.status]}`}>
                {LABEL[row.status]}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Spread</dt>
                <dd className={`font-mono ${tone(row.spreadPct)}`}>{money(row.spreadPct, 4)}%</dd>
              </div>
              <div>
                <dt className="text-slate-500">Gas</dt>
                <dd className="font-mono text-slate-300">{money(row.gasEth, 6)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Net</dt>
                <dd className={`font-mono ${tone(net?.netUsd ?? 0)}`}>
                  {net ? `${money(net.netEth, 6)} ETH` : "—"}
                </dd>
              </div>
            </dl>
          </article>
          );
        })}
        {rows.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-slate-500">
            Menunggu event Sync/Swap. Feed terisi saat scanner menghitung spread di memori.
          </p>
        ) : null}
      </div>
      <div className="touch-scroll hidden md:block">
        <table className="w-full min-w-[640px] text-left text-xs sm:text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Pair Token</th>
              <th className="px-4 py-2 font-medium">DEX Route</th>
              <th className="px-4 py-2 font-medium">Est. Spread</th>
              <th className="px-4 py-2 font-medium">Gas Fee</th>
              <th className="px-4 py-2 font-medium">Net Profit</th>
              <th className="px-4 py-2 font-medium">Status Badge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const net = rowEconomics(row);
              return (
              <tr key={row.id} className="border-t border-emerald-400/10">
                <td className="px-4 py-3 font-semibold text-slate-100">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-cyan-300" />
                  {row.pair}
                </td>
                <td className="px-4 py-3 text-slate-300">{row.route}</td>
                <td className={`px-4 py-3 font-mono ${tone(row.spreadPct)}`}>{money(row.spreadPct, 4)}%</td>
                <td className="px-4 py-3 font-mono text-slate-300">{money(row.gasEth, 6)} ETH</td>
                <td className={`px-4 py-3 font-mono ${tone(net?.netUsd ?? 0)}`}>
                  {net ? (
                    <>
                      {money(net.netEth, 6)} ETH
                      <span className="text-slate-500"> / ${money(net.netUsd, usdDigits(net.netUsd))}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${BADGE[row.status]}`}>
                    {LABEL[row.status]}
                  </span>
                </td>
              </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Menunggu event Sync/Swap. Feed terisi saat scanner menghitung spread di memori.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
