"use client";

import { useState } from "react";
import VideoCreatorBadge from "@/components/markets/VideoCreatorBadge";

export default function FlashloanAnimation() {
  const [useFallback, setUseFallback] = useState(false);

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
      <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950 shadow-[0_0_48px_rgba(56,189,248,0.08)]">
        {useFallback ? (
          <FlashloanFlowFallback />
        ) : (
          <video
            className="aspect-video w-full rounded-xl bg-black object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            onError={() => setUseFallback(true)}
          >
            <source src="/videos/flashloan-animation.mp4" type="video/mp4" />
            Animasi alur flashloan tidak didukung di browser ini.
          </video>
        )}
        <VideoCreatorBadge />
      </div>
    </section>
  );
}

function FlashloanFlowFallback() {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#05070d]">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(56,189,248,0.12), transparent 60%), radial-gradient(ellipse 40% 50% at 80% 80%, rgba(251,191,36,0.08), transparent 55%)",
        }}
      />
      <svg viewBox="0 0 960 540" className="relative h-full w-full" aria-label="Animasi alur flashloan">
        <defs>
          <linearGradient id="fl-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <filter id="fl-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <text x="480" y="48" textAnchor="middle" fill="#7dd3fc" fontSize="13" fontWeight="700" letterSpacing="4">
          FLASHLOAN ARBITRAGE FLOW
        </text>
        <text x="480" y="72" textAnchor="middle" fill="#64748b" fontSize="12">
          Pinjam → Swap DEX A → Swap DEX B → Bayar kembali → Profit
        </text>

        <path
          d="M120 270 H280 C300 270 300 180 340 180 H460 C500 180 500 360 540 360 H660 C700 360 700 270 740 270 H840"
          fill="none"
          stroke="url(#fl-line)"
          strokeWidth="3"
          strokeDasharray="10 8"
          opacity="0.85"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-180" dur="2.8s" repeatCount="indefinite" />
        </path>

        <circle r="7" fill="#fbbf24" filter="url(#fl-glow)">
          <animateMotion
            dur="5.5s"
            repeatCount="indefinite"
            path="M120 270 H280 C300 270 300 180 340 180 H460 C500 180 500 360 540 360 H660 C700 360 700 270 740 270 H840"
          />
        </circle>

        <FlowNode x={120} y={270} label="Vault" sub="USDT" color="#38bdf8" />
        <FlowNode x={340} y={180} label="Flashloan" sub="Pinjam" color="#fbbf24" />
        <FlowNode x={540} y={360} label="DEX A → B" sub="Arbitrage" color="#818cf8" />
        <FlowNode x={840} y={270} label="Repay +" sub="Profit" color="#34d399" />
      </svg>
    </div>
  );
}

function FlowNode({
  x,
  y,
  label,
  sub,
  color,
}: {
  x: number;
  y: number;
  label: string;
  sub: string;
  color: string;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r="28" fill="#0b1220" stroke={color} strokeWidth="2" />
      <circle cx={x} cy={y} r="6" fill={color} />
      <text x={x} y={y + 48} textAnchor="middle" fill="#e2e8f0" fontSize="13" fontWeight="700">
        {label}
      </text>
      <text x={x} y={y + 66} textAnchor="middle" fill="#94a3b8" fontSize="11">
        {sub}
      </text>
    </g>
  );
}
