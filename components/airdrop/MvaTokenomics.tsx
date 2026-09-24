"use client";

import { useMemo, useState } from "react";

const ALLOCATIONS = [
  {
    id: "public",
    label: "Public Distribution",
    pct: 20,
    color: "#F6C400",
    desc: "Available for community trading and liquidity.",
  },
  {
    id: "treasury",
    label: "Ecosystem Treasury",
    pct: 35,
    color: "#E0A000",
    desc: "Reserved for long-term ecosystem development and operations.",
  },
  {
    id: "liquidity",
    label: "Liquidity Framework",
    pct: 20,
    color: "#C48A00",
    desc: "Ensuring deep liquidity across trading pairs.",
  },
  {
    id: "community",
    label: "Community Growth",
    pct: 15,
    color: "#A67400",
    desc: "Airdrops, community rewards, and participation incentives.",
  },
  {
    id: "team",
    label: "Team & Founders",
    pct: 10,
    color: "#8A5E00",
    desc: "Locked with vesting schedule for long-term alignment.",
  },
] as const;

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 92;
const STROKE = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 7;

const FOOTER_STATS = [
  { label: "Total Supply", value: "1,000,000,000" },
  { label: "Circulating Supply", value: "Coming Soon" },
  { label: "Buybacks", value: "Coming Soon" },
  { label: "Network", value: "Solana" },
] as const;

function DonutRing({
  glowing,
  activeId,
  onGlow,
  onActive,
}: {
  glowing: boolean;
  activeId: string | null;
  onGlow: (value: boolean) => void;
  onActive: (id: string | null) => void;
}) {
  const segments = useMemo(() => {
    const usable = CIRCUMFERENCE - GAP * ALLOCATIONS.length;
    let offset = 0;
    return ALLOCATIONS.map((row) => {
      const length = (row.pct / 100) * usable;
      const dashOffset = -(offset + GAP / 2);
      offset += length + GAP;
      return { ...row, length, dashOffset };
    });
  }, []);

  return (
    <div className="relative mx-auto h-[260px] w-[260px] sm:h-[280px] sm:w-[280px]">
      <div
        className={`pointer-events-none absolute inset-6 rounded-full transition-all duration-300 ${
          glowing ? "bg-amber-400/35 blur-2xl" : "bg-amber-500/10 blur-xl"
        }`}
        aria-hidden
      />
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={`relative h-full w-full -rotate-90 transition-all duration-300 ${
          glowing
            ? "drop-shadow-[0_0_22px_rgba(245,196,0,0.85)] drop-shadow-[0_0_48px_rgba(255,210,40,0.55)]"
            : "drop-shadow-[0_0_10px_rgba(245,196,0,0.18)]"
        }`}
        aria-label="MVA token allocation chart"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="#1a1404"
          strokeWidth={STROKE + 8}
          className="pointer-events-none"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="transparent"
          strokeWidth={STROKE + 18}
          className="cursor-pointer"
          style={{ pointerEvents: "stroke" }}
          onMouseEnter={() => onGlow(true)}
          onMouseLeave={() => {
            onGlow(false);
            onActive(null);
          }}
        />
        {segments.map((row) => {
          const isActive = activeId === row.id;
          return (
            <circle
              key={row.id}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={row.color}
              strokeWidth={glowing || isActive ? STROKE + 4 : STROKE}
              strokeDasharray={`${row.length} ${CIRCUMFERENCE - row.length}`}
              strokeDashoffset={row.dashOffset}
              strokeLinecap="butt"
              className="cursor-pointer transition-[stroke-width,filter] duration-300"
              style={{
                pointerEvents: "stroke",
                filter:
                  glowing || isActive
                    ? "brightness(1.28) saturate(1.15)"
                    : "brightness(1)",
              }}
              onMouseEnter={() => {
                onGlow(true);
                onActive(row.id);
              }}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Total Supply
        </p>
        <p
          className={`mt-1 text-xl font-black tracking-tight sm:text-2xl ${
            glowing ? "text-[#FFE566]" : "text-[#F5C400]"
          }`}
        >
          1,000,000,000
        </p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/80">
          MVA
        </p>
      </div>
    </div>
  );
}

export default function MvaTokenomics() {
  const [glowing, setGlowing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <section className="relative mt-14 overflow-hidden rounded-[28px] border border-amber-500/15 bg-black px-4 py-12 sm:px-8 sm:py-14">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(245,197,24,0.10), transparent 55%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-5xl">
        <div className="text-center">
          <h2 className="text-4xl font-black tracking-tight text-[#F5C400] sm:text-5xl">
            TOKENOMICS
          </h2>
          <div className="mx-auto mt-3 h-px w-48 bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
          <span className="mx-auto mt-2 block h-1.5 w-1.5 rounded-full bg-amber-400" />
          <p className="mt-4 text-sm italic text-zinc-400">
            1,000,000,000 MVA — Designed for long-term ecosystem sustainability.
          </p>
        </div>

        <div className="mt-10 grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <DonutRing
            glowing={glowing}
            activeId={activeId}
            onGlow={setGlowing}
            onActive={setActiveId}
          />

          <div className="space-y-3">
            {ALLOCATIONS.map((row) => {
              const isActive = activeId === row.id || (glowing && !activeId);
              return (
                <article
                  key={row.id}
                  className={`rounded-2xl border bg-[#0b0b0b] px-4 py-3.5 transition-all duration-300 ${
                    isActive
                      ? "border-amber-400/50 shadow-[0_0_18px_rgba(245,196,0,0.18)]"
                      : "border-amber-500/20"
                  }`}
                  onMouseEnter={() => {
                    setGlowing(true);
                    setActiveId(row.id);
                  }}
                  onMouseLeave={() => {
                    setGlowing(false);
                    setActiveId(null);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: row.color,
                          boxShadow: isActive ? `0 0 10px ${row.color}` : "none",
                        }}
                      />
                      <div className="min-w-0">
                        <h3 className="text-[12px] font-black uppercase tracking-[0.12em] text-amber-100">
                          {row.label}
                        </h3>
                        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{row.desc}</p>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-black text-[#F5C400]">{row.pct}%</p>
                  </div>
                  <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-zinc-800/90">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-700 via-amber-400 to-yellow-200 transition-all duration-500"
                      style={{ width: `${row.pct}%`, opacity: isActive ? 1 : 0.72 }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {FOOTER_STATS.map((row) => (
            <div
              key={row.label}
              className="rounded-2xl border border-amber-500/20 bg-black/70 px-4 py-4 text-center"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {row.label}
              </p>
              <p className="mt-1.5 text-sm font-black text-[#F5C400]">{row.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
