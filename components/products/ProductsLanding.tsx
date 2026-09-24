"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  BellRing,
  Crosshair,
  Droplets,
  Gauge,
  Layers,
  Lock,
  type LucideIcon,
} from "lucide-react";

type BotStatus = "ready" | "locked";

interface BotProduct {
  id: string;
  icon: LucideIcon;
  title: string;
  english: string;
  kicker: string;
  body: string;
  status: BotStatus;
  href?: string;
  iconWrap: string;
  glow: string;
  ring: string;
}

const BOTS: BotProduct[] = [
  {
    id: "arbitrage",
    icon: ArrowLeftRight,
    title: "Bot Arbitrase",
    english: "Arbitrage Bots",
    kicker: "Atomic flashloan",
    body: "Memindai spread lintas DEX, menyusun rute, dan mengeksekusi peluang dalam satu transaksi atomik dengan kontrol gas dan min-profit yang dikelola sistem.",
    status: "ready",
    href: "/mev-arb",
    iconWrap: "from-amber-400/20 to-yellow-300/5 text-amber-300",
    glow: "group-hover:shadow-[0_0_40px_rgba(251,191,36,0.16)]",
    ring: "hover:border-amber-400/45",
  },
  {
    id: "front-running",
    icon: Gauge,
    title: "Bot Front-Running",
    english: "Front-Running Bots",
    kicker: "Latency desk",
    body: "Modul lanjutan untuk memantau aliran order publik dan kompetisi latensi di mempool. Belum dibuka untuk operator standar.",
    status: "locked",
    iconWrap: "from-sky-400/20 to-cyan-300/5 text-sky-300",
    glow: "group-hover:shadow-[0_0_40px_rgba(56,189,248,0.12)]",
    ring: "hover:border-sky-400/35",
  },
  {
    id: "sandwich",
    icon: Layers,
    title: "Bot Sandwich Attack",
    english: "Sandwich Attack Bots",
    kicker: "MEV sequencing",
    body: "Modul eksekusi MEV berlapis untuk desk yang sudah lolos review risiko. Akses terkunci hingga kebijakan operator dan kuota gas disetujui.",
    status: "locked",
    iconWrap: "from-violet-400/20 to-fuchsia-300/5 text-violet-300",
    glow: "group-hover:shadow-[0_0_40px_rgba(192,132,252,0.12)]",
    ring: "hover:border-violet-400/35",
  },
  {
    id: "liquidation",
    icon: Droplets,
    title: "Bot Likuidasi",
    english: "Liquidation Bots",
    kicker: "Lending markets",
    body: "Otomasi pemantauan posisi undercollateralized di pasar lending. Modul advanced menunggu integrasi protokol dan limit eksposur.",
    status: "locked",
    iconWrap: "from-rose-400/20 to-orange-300/5 text-rose-300",
    glow: "group-hover:shadow-[0_0_40px_rgba(251,113,133,0.12)]",
    ring: "hover:border-rose-400/35",
  },
  {
    id: "dex-sniper",
    icon: Crosshair,
    title: "Bot DEX Sniper",
    english: "Decentralized Exchange",
    kicker: "Pool discovery",
    body: "Modul sniper listing pool DEX untuk operator yang memantau pair baru. Terkunci sampai filter likuiditas dan guardrail dampak harga aktif.",
    status: "locked",
    iconWrap: "from-emerald-400/20 to-teal-300/5 text-emerald-300",
    glow: "group-hover:shadow-[0_0_40px_rgba(52,211,153,0.12)]",
    ring: "hover:border-emerald-400/35",
  },
  {
    id: "cex-listing",
    icon: BellRing,
    title: "Bot CEX Listing",
    english: "Centralized Exchange",
    kicker: "Venue alerts",
    body: "Peringatan dan otomasi listing di bursa terpusat. Modul advanced menunggu konektor API venue dan kebijakan kepatuhan desk.",
    status: "locked",
    iconWrap: "from-cyan-400/20 to-sky-300/5 text-cyan-300",
    glow: "group-hover:shadow-[0_0_40px_rgba(34,211,238,0.12)]",
    ring: "hover:border-cyan-400/35",
  },
];

function StatusBadges({ status }: { status: BotStatus }) {
  if (status === "ready") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
          Active
        </span>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
          Ready
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-full border border-slate-600/70 bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">
        Advanced
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/70 bg-slate-950/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <Lock className="h-2.5 w-2.5" />
        Locked
      </span>
    </div>
  );
}

function ProductAction({ bot }: { bot: BotProduct }) {
  const [notice, setNotice] = useState(false);

  if (bot.status === "ready" && bot.href) {
    return (
      <Link
        href={bot.href}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:from-amber-300 hover:to-yellow-200 sm:text-sm"
      >
        Launch Module
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setNotice((open) => !open)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 sm:text-sm"
      >
        <Lock className="h-3.5 w-3.5 text-slate-400" />
        Configure
      </button>
      {notice ? (
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          Modul Advanced masih terkunci. Hubungi desk untuk meninjau akses.
        </p>
      ) : null}
    </div>
  );
}

export default function ProductsLanding() {
  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 15% -8%, rgba(251,191,36,0.14), transparent 55%), radial-gradient(ellipse 55% 40% at 92% 8%, rgba(56,189,248,0.10), transparent 50%)",
        }}
      />

      <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-8 pt-6 text-center sm:pt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/90">
          Product catalog
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
          Automation bots
          <span className="block bg-gradient-to-r from-amber-300 via-yellow-200 to-sky-300 bg-clip-text text-transparent">
            for institutional desks
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Enam modul otomasi MEV ARB. Bot Arbitrase sudah aktif di control portal; modul lanjutan
          tetap terlihat di katalog dengan status Advanced/Locked.
        </p>
      </section>

      <section className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 pb-14 sm:grid-cols-2 lg:grid-cols-3">
        {BOTS.map((bot) => (
          <article
            key={bot.id}
            className={`group theme-panel relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800/80 p-5 transition-all duration-300 sm:p-6 ${bot.ring} ${bot.glow}`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${bot.iconWrap}`}
              >
                <bot.icon className="h-5 w-5" />
              </div>
              <StatusBadges status={bot.status} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {bot.kicker}
            </p>
            <h2 className="mt-1.5 text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              {bot.title}
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{bot.english}</p>
            <p className="mt-2 flex-1 text-[13px] leading-6 text-[var(--muted)] sm:text-sm sm:leading-7">
              {bot.body}
            </p>
            <ProductAction bot={bot} />
          </article>
        ))}
      </section>
    </div>
  );
}
