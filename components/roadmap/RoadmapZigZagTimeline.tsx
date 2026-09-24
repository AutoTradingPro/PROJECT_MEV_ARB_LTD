import Link from "next/link";
import { ChevronsDown, Crown } from "lucide-react";

type PhaseSide = "left" | "right";

interface PhaseCard {
  code: string;
  title: string;
  body: string;
  href?: string;
}

interface RoadmapPhase {
  n: number;
  side: PhaseSide;
  month: string;
  dates: string;
  headline: string;
  cards: [PhaseCard, PhaseCard];
}

const PHASES: RoadmapPhase[] = [
  {
    n: 1,
    side: "left",
    month: "Month 1",
    dates: "7 Aug 2026 – 6 Sep 2026",
    headline: "Web App Core & Arbitrum Flashloan Arbitrage Bot",
    cards: [
      {
        code: "1.1",
        title: "Web App Core",
        body: "Operator control portal, institutional desk UI, and live bot configuration for the MEV ARB flashloan desk.",
      },
      {
        code: "1.2",
        title: "Arbitrum Flashloan Bot",
        body: "Atomic flashloan arbitrage on Arbitrum — spread scan, adaptive min-profit, and Balancer executor.",
        href: "/mev-arb",
      },
    ],
  },
  {
    n: 2,
    side: "right",
    month: "Month 2",
    dates: "7 Sep 2026 – 6 Oct 2026",
    headline: "Web Development & 5-Network Flashloan Arbitrage Bots",
    cards: [
      {
        code: "2.1",
        title: "Web Development",
        body: "Harden dashboards, vault gates, kill-switch controls, and multi-venue desk workflows.",
      },
      {
        code: "2.2",
        title: "5-Network Flashloan Bots",
        body: "Expand atomic flashloan routes across five networks with RPC failover and denser DEX coverage.",
      },
    ],
  },
  {
    n: 3,
    side: "left",
    month: "Month 3",
    dates: "7 Oct 2026 – 6 Nov 2026",
    headline: "12-Network Arbitrage Expansion & MVA Token Development",
    cards: [
      {
        code: "3.1",
        title: "12-Network Expansion",
        body: "Scale arbitrage coverage to twelve networks with tighter venue routing and failover.",
      },
      {
        code: "3.2",
        title: "MVA Token Development",
        body: "Token infrastructure, bot-ecosystem utility, and MVA branding across the platform.",
        href: "/roadmap/mva-coin",
      },
    ],
  },
  {
    n: 4,
    side: "right",
    month: "Month 4",
    dates: "7 Nov 2026 – 6 Dec 2026",
    headline: "Platform Official Launch & Airdrop Campaign",
    cards: [
      {
        code: "4.1",
        title: "Official Launch",
        body: "Public launch of the MEV ARB desk, operator program, and release documentation.",
        href: "/roadmap/q4-launch",
      },
      {
        code: "4.2",
        title: "Airdrop Campaign",
        body: "MVA operator airdrop — eligibility, campaign tasks, and on-chain claim flow.",
        href: "/airdrop",
      },
    ],
  },
  {
    n: 5,
    side: "left",
    month: "Month 5",
    dates: "7 Dec 2026 – 6 Jan 2027",
    headline: "CoinMarketCap & CoinGecko Listing + Front-Running / Back-Running MEV Bots",
    cards: [
      {
        code: "5.1",
        title: "CMC & CoinGecko",
        body: "List MVA on CoinMarketCap and CoinGecko and establish public market-data presence.",
      },
      {
        code: "5.2",
        title: "Front / Back-Running",
        body: "Mempool latency desk — front-running and back-running MEV bot modules.",
        href: "/dashboards",
      },
    ],
  },
  {
    n: 6,
    side: "right",
    month: "Month 6",
    dates: "7 Jan 2027 – 6 Feb 2027",
    headline: "Liquidation Bot",
    cards: [
      {
        code: "6.1",
        title: "Liquidation Bot",
        body: "Automate capture of undercollateralized lending positions across venues.",
        href: "/dashboards",
      },
      {
        code: "6.2",
        title: "Risk & Exposure Guards",
        body: "Protocol hooks, exposure limits, and kill-switch policy for liquidation flow.",
      },
    ],
  },
  {
    n: 7,
    side: "left",
    month: "Month 6",
    dates: "7 Jan 2027 – 6 Feb 2027",
    headline: "DEX Sniper Bot Integration",
    cards: [
      {
        code: "7.1",
        title: "DEX Sniper Bot",
        body: "New-pool discovery and sniper execution on DEX listings for the operator desk.",
        href: "/dashboards",
      },
      {
        code: "7.2",
        title: "Launch Guardrails",
        body: "Liquidity filters and price-impact guards before the sniper module goes live.",
      },
    ],
  },
];

const PATH_D =
  "M 52 8 C 52 26 28 32 28 50 C 28 78 76 122 76 150 C 76 178 28 222 28 250 C 28 278 76 322 76 350 C 76 378 28 422 28 450 C 28 478 76 522 76 550 C 76 578 28 622 28 650 C 28 670 52 680 52 696";

function PhaseCards({ phase }: { phase: RoadmapPhase }) {
  const towardPath = phase.side === "left" ? "md:items-end" : "md:items-start";
  const kickerAlign = phase.side === "left" ? "md:text-right" : "md:text-left";
  const radius =
    phase.side === "left"
      ? "rounded-l-xl rounded-r-[1.65rem]"
      : "rounded-r-xl rounded-l-[1.65rem]";

  return (
    <div className={`flex w-full min-w-0 flex-col gap-2.5 ${towardPath}`}>
      <p
        className={`px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/85 md:max-w-sm ${kickerAlign}`}
      >
        {phase.month}
        <span className="mx-1.5 text-amber-500/50">·</span>
        <span className="font-semibold tracking-[0.08em] text-amber-200/70">{phase.dates}</span>
      </p>
      <p className="sr-only">{phase.headline}</p>
      {phase.cards.map((card) => {
        const inner = (
          <>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-950/70">
              Phase {card.code}
            </p>
            <h3 className="mt-1 text-[15px] font-black leading-snug tracking-tight text-slate-950 sm:text-base">
              {card.title}
            </h3>
            <p className="mt-1.5 line-clamp-2 break-words text-[12px] font-semibold leading-relaxed text-slate-900/80">
              {card.body}
            </p>
          </>
        );

        const className = [
          "block w-full min-w-0 max-w-[min(28rem,calc(100vw-7.5rem))] overflow-hidden border border-amber-200/40 bg-gradient-to-br from-amber-300 via-orange-400 to-amber-500 p-3 text-left shadow-[0_14px_36px_rgba(245,158,11,0.38)] transition-all duration-200 sm:p-3.5",
          radius,
          "hover:-translate-y-0.5 hover:from-amber-200 hover:via-orange-300 hover:to-amber-400 hover:shadow-[0_18px_44px_rgba(251,191,36,0.55)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200",
        ].join(" ");

        if (card.href) {
          return (
            <Link key={card.code} href={card.href} className={className}>
              {inner}
            </Link>
          );
        }

        return (
          <article key={card.code} className={className}>
            {inner}
          </article>
        );
      })}
    </div>
  );
}

function PhaseNode({ n, side }: { n: number; side: PhaseSide }) {
  const offset = side === "left" ? "md:-translate-x-[1.5rem]" : "md:translate-x-[1.5rem]";

  return (
    <div
      className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-slate-950 shadow-[0_0_0_3px_#f5c400,0_10px_28px_rgba(245,196,0,0.45)] transition-transform duration-200 group-hover:scale-110 sm:h-14 sm:w-14 sm:text-xl ${offset}`}
      aria-hidden
    >
      {n}
    </div>
  );
}

function WindingPath() {
  return (
    <svg
      className="pointer-events-none absolute top-0 bottom-0 left-1/2 hidden h-full w-[6.5rem] -translate-x-1/2 md:block"
      viewBox="0 0 104 700"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="roadmap-gold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="45%" stopColor="#F5C400" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
        <filter id="roadmap-glow" x="-20%" y="-4%" width="140%" height="108%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={PATH_D}
        fill="none"
        stroke="url(#roadmap-gold)"
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0.18"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="roadmap-path-dash animate-roadmap-dash"
        d={PATH_D}
        fill="none"
        stroke="url(#roadmap-gold)"
        strokeWidth="2.6"
        strokeDasharray="8 11"
        strokeLinecap="round"
        filter="url(#roadmap-glow)"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function RocketMark({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <svg width="108" height="118" viewBox="0 0 108 118" fill="none">
        <g opacity="0.9">
          <circle cx="86" cy="22" r="2.2" fill="#FDE68A" />
          <circle cx="98" cy="48" r="1.6" fill="#F5C400" />
          <circle cx="74" cy="8" r="1.4" fill="#FDBA74" />
          <path d="M78 70 L96 52" stroke="#F5C400" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
          <path d="M70 78 L90 62" stroke="#F97316" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
        </g>
        <path
          d="M42 86 C38 62 52 28 70 14 C78 28 86 52 78 78 C68 86 52 90 42 86Z"
          fill="url(#rocket-body)"
          stroke="#FDE68A"
          strokeWidth="1.4"
        />
        <circle cx="64" cy="48" r="7" fill="#0B1220" stroke="#F5C400" strokeWidth="1.6" />
        <circle cx="64" cy="48" r="3.2" fill="#7DD3FC" opacity="0.85" />
        <path d="M42 78 L22 92 L40 88 Z" fill="#F97316" />
        <path d="M58 88 L48 108 L66 92 Z" fill="#EA580C" />
        <path d="M70 14 L74 4 L78 16" fill="#FDE68A" />
        <path d="M48 90 C46 100 52 110 58 96" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <path d="M54 92 C54 104 62 112 64 98" stroke="#F5C400" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        <defs>
          <linearGradient id="rocket-body" x1="40" y1="90" x2="82" y2="12">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="55%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#FDE68A" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function RoadmapZigZagTimeline() {
  return (
    <section className="relative w-full max-w-full overflow-hidden rounded-[28px] border border-amber-500/20 bg-[#07060e] px-3 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:px-6 sm:py-8 md:px-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 32% at 8% 0%, rgba(245,196,0,0.16), transparent 55%), radial-gradient(ellipse 50% 40% at 92% 100%, rgba(249,115,22,0.12), transparent 58%), radial-gradient(ellipse 80% 50% at 50% 50%, rgba(88,28,135,0.16), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(245,196,0,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(245,196,0,0.45) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <header className="relative mb-4 flex flex-col items-start gap-3 sm:mb-6 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-400/35 bg-black/80 text-amber-300 shadow-[0_0_24px_rgba(245,196,0,0.28)] sm:h-14 sm:w-14">
          <Crown className="h-5 w-5 sm:h-7 sm:w-7" strokeWidth={2.1} />
        </div>
        <div className="min-w-0 md:text-right">
          <h1 className="text-3xl font-black tracking-[0.14em] text-white sm:text-4xl sm:tracking-[0.18em] md:text-5xl md:tracking-[0.22em]">
            ROADMAP
          </h1>
          <p className="mt-1.5 text-[10px] font-semibold uppercase leading-relaxed tracking-[0.12em] text-amber-300/80 sm:text-[11px] sm:tracking-[0.18em]">
            6-month path
            <span className="mx-1.5 hidden sm:inline">·</span>
            <span className="mt-0.5 block sm:mt-0 sm:inline">7 Aug 2026 → 6 Feb 2027</span>
          </p>
        </div>
      </header>

      <div className="relative mx-auto max-w-5xl pb-16 pt-2 md:pb-20">
        <div
          className="pointer-events-none absolute bottom-20 left-6 top-8 w-px border-l-2 border-dashed border-amber-400/55 md:hidden"
          aria-hidden
        />

        <div className="relative mb-1 hidden justify-center md:flex" aria-hidden>
          <ChevronsDown className="h-7 w-7 text-amber-400 drop-shadow-[0_0_10px_rgba(245,196,0,0.65)]" />
        </div>

        <div className="relative">
          <WindingPath />
          <ol className="relative flex flex-col gap-8 md:gap-0">
            {PHASES.map((phase) => (
              <li
                key={phase.n}
                className="group relative grid min-w-0 grid-cols-1 items-center gap-3 pl-14 md:h-[252px] md:grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,1fr)] md:gap-0 md:pl-0"
              >
                <div
                  className={
                    phase.side === "left"
                      ? "min-w-0 md:col-start-1 md:row-start-1 md:pr-3"
                      : "min-w-0 md:col-start-3 md:row-start-1 md:pl-3"
                  }
                >
                  <PhaseCards phase={phase} />
                </div>

                <div className="absolute left-0 top-1 md:static md:col-start-2 md:row-start-1 md:flex md:justify-center">
                  <PhaseNode n={phase.n} side={phase.side} />
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative mt-1 hidden justify-center md:flex" aria-hidden>
          <ChevronsDown className="h-7 w-7 text-amber-400 drop-shadow-[0_0_10px_rgba(245,196,0,0.65)]" />
        </div>

        <RocketMark className="mt-8 flex justify-center md:pointer-events-none md:absolute md:bottom-3 md:right-6 md:mt-0 lg:right-10" />
      </div>
    </section>
  );
}
