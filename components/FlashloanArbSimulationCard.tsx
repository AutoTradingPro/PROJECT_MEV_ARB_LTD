"use client";

import { useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";

type LiquidityTier = "stables" | "medium" | "exotics";

const FLASH_FEE_PCT = 0.09; // 0.09%

const TIER_DEFAULTS: Record<
  LiquidityTier,
  { loan: number; depth: number; spreadPct: number; gasUsd: number }
> = {
  stables: { loan: 10_000, depth: 3_500_000, spreadPct: 0.5, gasUsd: 5 },
  medium: { loan: 8_000, depth: 1_200_000, spreadPct: 0.65, gasUsd: 8 },
  exotics: { loan: 4_000, depth: 280_000, spreadPct: 0.9, gasUsd: 12 },
};

const LOAN_MIN = 1_000;
const LOAN_MAX = 50_000;
const DEPTH_MIN = 100_000;
const DEPTH_MAX = 10_000_000;
const SPREAD_MIN = 0.05;
const SPREAD_MAX = 2;
const GAS_MIN = 1;
const GAS_MAX = 40;

function formatUsd(value: number, digits = 2): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatLoan(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} USDC`;
}

function formatDepth(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M USDC`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K USDC`;
  }
  return `${Math.round(value)} USDC`;
}

function computeSim(loan: number, depth: number, spreadPct: number, gasUsd: number) {
  const gross = loan * (spreadPct / 100);
  const premium = loan * (FLASH_FEE_PCT / 100);
  const impactPct = depth > 0 ? (loan / depth) * 100 : 0;
  // Round-trip slip ≈ half of naive impact (matches reference card: $28.25 total)
  const slipCost = loan * (impactPct / 100) * 0.5;
  const totalCost = premium + slipCost + gasUsd;
  const net = gross - totalCost;
  const lowPrice = 1;
  const highPrice = 1 + spreadPct / 100;
  return { gross, premium, impactPct, slipCost, totalCost, net, lowPrice, highPrice };
}

const sliderClass =
  "w-full cursor-pointer appearance-none bg-transparent " +
  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-sky-500/80 " +
  "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-sky-500/80 " +
  "[&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-300 " +
  "[&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(56,189,248,0.7)] " +
  "[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-sky-300";

export default function FlashloanArbSimulationCard({ className = "" }: { className?: string }) {
  const defaults = TIER_DEFAULTS.stables;
  const [tier, setTier] = useState<LiquidityTier>("stables");
  const [loan, setLoan] = useState(defaults.loan);
  const [depth, setDepth] = useState(defaults.depth);
  const [spreadPct, setSpreadPct] = useState(defaults.spreadPct);
  const [gasUsd, setGasUsd] = useState(defaults.gasUsd);
  const [animating, setAnimating] = useState(true);

  const sim = useMemo(
    () => computeSim(loan, depth, spreadPct, gasUsd),
    [loan, depth, spreadPct, gasUsd]
  );

  const profitable = sim.net > 0;

  function applyTier(next: LiquidityTier) {
    const d = TIER_DEFAULTS[next];
    setTier(next);
    setLoan(d.loan);
    setDepth(d.depth);
    setSpreadPct(d.spreadPct);
    setGasUsd(d.gasUsd);
  }

  return (
    <section
      className={`theme-panel flex h-full min-h-0 w-full flex-col rounded-2xl border border-slate-800/80 p-3 sm:p-3.5 transition-colors duration-200 ${className}`}
    >
      {/* Status + diagram */}
      <div className="shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              USDC-WETH Multi-Pool Route
            </span>
            <span
              className={`inline-flex items-center gap-1.5 ${
                profitable ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  profitable ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
              {profitable ? "Arb Menguntungkan" : "Arb Tidak Menguntungkan"}
            </span>
          </div>
          <button
            type="button"
            aria-label={animating ? "Jeda animasi" : "Putar animasi"}
            onClick={() => setAnimating((v) => !v)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 text-slate-300 hover:border-sky-500/50 hover:text-sky-300 cursor-pointer"
          >
            {animating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
        </div>

        <svg
          viewBox="0 0 460 148"
          className="mt-1 h-[112px] w-full"
          role="img"
          aria-label="Alur simulasi flashloan arbitrage"
        >
          <defs>
            <linearGradient id="fl-sim-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="40%" stopColor="#34d399" />
              <stop offset="70%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
          </defs>

          {/* Loop: Provider → Pool A → Searcher → Pool B → Provider */}
          <path
            d="M64 74 C110 74 140 28 230 28 C320 28 350 74 396 74 C350 74 320 120 230 120 C140 120 110 74 64 74"
            fill="none"
            stroke="url(#fl-sim-line)"
            strokeWidth="1.6"
            strokeDasharray="6 5"
            opacity="0.9"
          >
            {animating ? (
              <animate attributeName="stroke-dashoffset" from="0" to="-88" dur="2.6s" repeatCount="indefinite" />
            ) : null}
          </path>

          {/* Provider (left) */}
          <circle cx="52" cy="74" r="17" fill="#0b1220" stroke="#a78bfa" strokeWidth="2" />
          <text x="52" y="78" textAnchor="middle" fill="#c4b5fd" fontSize="9" fontWeight="700">
            FL
          </text>
          <text x="52" y="104" textAnchor="middle" fill="#94a3b8" fontSize="8">
            Provider Kilat
          </text>
          <text x="52" y="115" textAnchor="middle" fill="#64748b" fontSize="7">
            Lending Protocol
          </text>

          {/* Pool A (top) */}
          <rect x="158" y="8" width="144" height="34" rx="6" fill="#0b1220" stroke="#34d399" strokeWidth="1.4" />
          <text x="230" y="21" textAnchor="middle" fill="#6ee7b7" fontSize="8" fontWeight="700">
            DEX Pool A (Beli Rendah)
          </text>
          <text x="230" y="34" textAnchor="middle" fill="#94a3b8" fontSize="8">
            {`Harga Rendah: $${sim.lowPrice.toFixed(2)}`}
          </text>

          {/* Pool B (bottom) */}
          <rect x="158" y="106" width="144" height="34" rx="6" fill="#0b1220" stroke="#38bdf8" strokeWidth="1.4" />
          <text x="230" y="119" textAnchor="middle" fill="#7dd3fc" fontSize="8" fontWeight="700">
            DEX Pool B (Jual Tinggi)
          </text>
          <text x="230" y="132" textAnchor="middle" fill="#94a3b8" fontSize="8">
            {`Harga Tinggi: $${sim.highPrice.toFixed(4)}`}
          </text>

          {/* Searcher (right) */}
          <circle cx="408" cy="74" r="17" fill="#0b1220" stroke="#fbbf24" strokeWidth="2" />
          <text x="408" y="78" textAnchor="middle" fill="#fcd34d" fontSize="9" fontWeight="700">
            SC
          </text>
          <text x="408" y="104" textAnchor="middle" fill="#94a3b8" fontSize="8">
            Searcher Contract
          </text>
          <text x="408" y="115" textAnchor="middle" fill="#64748b" fontSize="7">
            Dompet Eksekusi
          </text>
        </svg>
      </div>

      {/* Metrics */}
      <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-slate-800/80 pt-2">
        <div className="min-w-0">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">
            Pendapatan Kotor
          </p>
          <p className="mt-0.5 truncate font-mono text-sm font-bold tabular-nums text-slate-100">
            {formatUsd(sim.gross)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">
            Total Biaya & Slip
          </p>
          <p className="mt-0.5 truncate font-mono text-sm font-bold tabular-nums text-rose-400">
            {formatUsd(sim.totalCost)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">
            Keuntungan Bersih
          </p>
          <p
            className={`mt-0.5 truncate font-mono text-sm font-bold tabular-nums ${
              profitable ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatUsd(sim.net)}
          </p>
        </div>
      </div>

      {/* Liquidity tier */}
      <div className="mt-2 space-y-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          Likuiditas Pool Pasangan
        </p>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["stables", "Stables/High Depth (USDC/USDT)"],
              ["medium", "Medium Layer (WETH/WBTC)"],
              ["exotics", "Low Depth Exotics / Baru"],
            ] as const
          ).map(([id, label]) => {
            const active = tier === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => applyTier(id)}
                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold transition-colors cursor-pointer ${
                  active
                    ? "bg-slate-700 text-white ring-1 ring-slate-500"
                    : "bg-slate-900/80 text-slate-400 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders 2x2 */}
      <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
        <label className="min-w-0 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-slate-300">Jumlah Pinjaman Flashloan</p>
              <p className="text-[8px] text-slate-500">
                Premium: {formatUsd(sim.premium, 0)} ({FLASH_FEE_PCT.toFixed(2)}%)
              </p>
            </div>
            <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-sky-300">
              {formatLoan(loan)}
            </span>
          </div>
          <input
            type="range"
            min={LOAN_MIN}
            max={LOAN_MAX}
            step={500}
            value={loan}
            aria-label="Jumlah pinjaman flashloan"
            onChange={(e) => setLoan(Number(e.target.value))}
            className={sliderClass}
          />
        </label>

        <label className="min-w-0 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-slate-300">Kedalaman Likuiditas Pasangan</p>
              <p className="text-[8px] text-slate-500">
                Dampak Harga: {sim.impactPct.toFixed(1)}%
              </p>
            </div>
            <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-sky-300">
              {formatDepth(depth)}
            </span>
          </div>
          <input
            type="range"
            min={DEPTH_MIN}
            max={DEPTH_MAX}
            step={50_000}
            value={depth}
            aria-label="Kedalaman likuiditas pasangan"
            onChange={(e) => setDepth(Number(e.target.value))}
            className={sliderClass}
          />
        </label>

        <label className="min-w-0 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-[9px] font-semibold text-slate-300">
              Selisih Discrepancy Harga Antar Pool
            </p>
            <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-sky-300">
              {spreadPct.toFixed(2)}%
            </span>
          </div>
          <input
            type="range"
            min={SPREAD_MIN}
            max={SPREAD_MAX}
            step={0.05}
            value={spreadPct}
            aria-label="Selisih harga antar pool"
            onChange={(e) => setSpreadPct(Number(e.target.value))}
            className={sliderClass}
          />
        </label>

        <label className="min-w-0 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-[9px] font-semibold text-slate-300">
              Estimasi Biaya Gas Blockchain (L1/L2)
            </p>
            <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-sky-300">
              ${gasUsd.toFixed(0)} USD
            </span>
          </div>
          <input
            type="range"
            min={GAS_MIN}
            max={GAS_MAX}
            step={1}
            value={gasUsd}
            aria-label="Estimasi biaya gas"
            onChange={(e) => setGasUsd(Number(e.target.value))}
            className={sliderClass}
          />
        </label>
      </div>
    </section>
  );
}
