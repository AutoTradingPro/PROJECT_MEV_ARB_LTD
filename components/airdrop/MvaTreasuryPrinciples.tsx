import { Infinity, Lock, Search, Shield } from "lucide-react";

const PRINCIPLES = [
  {
    id: "transparency",
    title: "Treasury Transparency",
    icon: Search,
    iconClass: "text-amber-300",
    iconWrap: "border-amber-500/30 bg-black",
    body: "Selected ecosystem wallets are publicly visible on-chain. Community members can verify activity independently with full transparency.",
    badge: "On-Chain Proof",
    featured: false,
  },
  {
    id: "allocation",
    title: "Strategic Allocation",
    icon: Shield,
    iconClass: "text-amber-300",
    iconWrap: "border-amber-500/30 bg-black",
    body: "Disciplined resource allocation across ecosystem development, liquidity frameworks, and long-term infrastructure planning.",
    badge: "Strategic Allocation",
    featured: false,
  },
  {
    id: "security",
    title: "Ecosystem Security",
    icon: Lock,
    iconClass: "text-amber-300",
    iconWrap: "border-amber-500/30 bg-black",
    body: "Smart contracts audited and secured for long-term community trust. Infrastructure built with institutional-grade security protocols.",
    badge: "Audited Security",
    featured: false,
  },
  {
    id: "long-term",
    title: "Long-Term Development",
    icon: Infinity,
    iconClass: "text-violet-200",
    iconWrap: "border-violet-400/40 bg-violet-600/80",
    body: "Ecosystem resources managed for long-term digital infrastructure development. Every decision aligned with multi-year community vision.",
    badge: "Long-Term Development",
    featured: true,
  },
] as const;

export default function MvaTreasuryPrinciples() {
  return (
    <section className="relative mt-14 overflow-hidden rounded-[28px] border border-amber-500/15 bg-black px-4 py-12 sm:px-8 sm:py-16">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 35% at 50% 0%, rgba(245,197,24,0.12), transparent 58%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.42em] text-zinc-500">
          — The Code
        </p>
        <h2 className="mt-3 text-center text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
          <span className="text-white">TREASURY </span>
          <span className="text-[#F5C400]">PRINCIPLES</span>
        </h2>
        <div className="relative mx-auto mt-4 h-px w-full max-w-xl bg-gradient-to-r from-transparent via-amber-400/70 to-transparent">
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400" />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PRINCIPLES.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.id}
                className={`flex h-full flex-col items-center rounded-[22px] border bg-[#080808]/90 px-5 py-7 text-center transition-all duration-300 hover:-translate-y-1 ${
                  item.featured
                    ? "border-amber-400/55 shadow-[0_0_28px_rgba(245,196,0,0.12)] hover:border-amber-300 hover:shadow-[0_0_36px_rgba(245,196,0,0.22)]"
                    : "border-amber-500/20 hover:border-amber-400/40 hover:shadow-[0_0_24px_rgba(245,196,0,0.12)]"
                }`}
              >
                <span
                  className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full border ${item.iconWrap}`}
                >
                  <Icon className={`h-6 w-6 ${item.iconClass}`} strokeWidth={1.75} />
                </span>
                <h3 className="max-w-[11rem] text-[13px] font-black uppercase leading-snug tracking-[0.08em] text-[#E8B40C]">
                  {item.title}
                </h3>
                <div className="mx-auto mt-3 h-px w-10 bg-amber-500/35" />
                <p className="mt-4 flex-1 text-[12px] leading-relaxed text-zinc-400">{item.body}</p>
                <span className="mt-6 inline-flex items-center rounded-full border border-emerald-400/35 bg-emerald-500/5 px-3.5 py-1 text-[11px] font-semibold text-emerald-300">
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {item.badge}
                </span>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
