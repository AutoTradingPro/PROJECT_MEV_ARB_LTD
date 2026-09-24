import Link from "next/link";
import { Coins, Flag, Layers, Map, Rocket, Shield } from "lucide-react";
import RoadmapZigZagTimeline from "@/components/roadmap/RoadmapZigZagTimeline";
import { ROADMAP_MENU_ITEMS, roadmapItemHref } from "@/lib/navigation/roadmapMenu";

const MILESTONES = [
  {
    slug: "q1-foundation",
    kicker: "Now",
    body: "Executor Balancer, adaptive min-profit, dan control portal institusional.",
  },
  {
    slug: "q2-multichain",
    kicker: "Next",
    body: "Perluasan rute L2, failover RPC, dan desk multi-venue yang lebih rapat.",
  },
  {
    slug: "q3-vault",
    kicker: "Risk",
    body: "Vault, kill switch, dan kebijakan dana yang lebih ketat untuk operator.",
  },
  {
    slug: "q4-launch",
    kicker: "Public",
    body: "Peluncuran publik, program operator, dan dokumentasi rilis.",
  },
  {
    slug: "mva-coin",
    kicker: "Horizon",
    body: "MVA (MVA Coin) — infrastruktur token, utilitas di ekosistem bot arbitrase, dan branding di platform. Jaringan: menyusul / fleksibel (multi-chain compatible).",
  },
] as const;

const ICONS = {
  overview: Map,
  "q1-foundation": Flag,
  "q2-multichain": Layers,
  "q3-vault": Shield,
  "q4-launch": Rocket,
  "mva-coin": Coins,
} as const;

export default function RoadmapLanding() {
  return (
    <div className="relative w-full max-w-[calc(100vw-1.5rem)] overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 12% -8%, rgba(251,191,36,0.12), transparent 55%), radial-gradient(ellipse 50% 35% at 90% 12%, rgba(249,115,22,0.08), transparent 50%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-1 pb-4 pt-2 sm:px-2 sm:pt-4">
        <RoadmapZigZagTimeline />
      </div>

      <section className="relative mx-auto w-full max-w-6xl px-4 pb-12 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-400/80">
          Milestones
        </p>
        <h2 className="mt-2 text-lg font-black tracking-tight text-white sm:text-xl">
          Overview, quarters &amp; MVA Coin
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ROADMAP_MENU_ITEMS.map((item) => {
            const Icon = ICONS[item.slug as keyof typeof ICONS] ?? Map;
            const extra = MILESTONES.find((row) => row.slug === item.slug);
            return (
              <Link
                key={item.slug}
                href={roadmapItemHref(item.slug)}
                className="group rounded-2xl border border-amber-500/15 bg-slate-950/70 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-amber-400/40 hover:bg-slate-900/80"
              >
                <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                  {extra?.kicker ?? "Milestone"}
                </p>
                <h3 className="mt-0.5 text-[12px] font-bold leading-snug text-slate-100 group-hover:text-white">
                  {item.label}
                </h3>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
