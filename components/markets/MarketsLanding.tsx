import Link from "next/link";
import { ArrowRight, Bot, Layers, Shield, Zap } from "lucide-react";
import FlashloanAnimation from "@/components/markets/FlashloanAnimation";
import FlashloanArticle from "@/components/FlashloanArticle";
import FlashLoanAttacksArticle from "@/components/FlashLoanAttacksArticle";
import FlashLoanAttacksVideo from "@/components/FlashLoanAttacksVideo";
import FlashLoanAttacksSection from "@/components/FlashLoanAttacksSection";
import TestimonialsMarquee from "@/components/TestimonialsMarquee";

const HIGHLIGHTS = [
  {
    icon: Zap,
    title: "Real-time Markets",
    body: "Pantau ranking, trending, dan pergerakan aset di satu layar institusional.",
  },
  {
    icon: Bot,
    title: "MEV Flashloan Bot",
    body: "Eksekusi arbitrase lintas DEX dengan kontrol gas, kill switch, dan vault.",
  },
  {
    icon: Shield,
    title: "Risk-aware Ops",
    body: "Status likuidasi, profit harian, dan otorisasi wallet terintegrasi di portal.",
  },
  {
    icon: Layers,
    title: "Multi-venue",
    body: "Uniswap, SushiSwap, Camelot, dan provider flashloan dalam satu stack gelap.",
  },
];

export default function MarketsLanding() {
  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(251,191,36,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(56,189,248,0.08), transparent 50%)",
        }}
      />

      <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-10 pt-5 text-center sm:pt-7 md:pt-8">
        <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
          MEV ARB
          <span className="block bg-gradient-to-r from-amber-300 via-yellow-200 to-sky-300 bg-clip-text text-transparent">
            Institutional Markets Portal
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Landing page pasar aset digital untuk flashloan arbitrage. Gelap, presisi, dan siap eksekusi —
          dari ranking market hingga mesin bot lintas DEX.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/mev-arb"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-400/20 hover:from-amber-300 hover:to-yellow-200"
          >
            Buka Control Bot
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/markets/ranking"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-sky-500/40 hover:text-white"
          >
            Lihat Ranking
          </Link>
        </div>
      </section>

      <section className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 px-4 pb-2 sm:grid-cols-2 lg:grid-cols-4">
        {HIGHLIGHTS.map((item) => (
          <article
            key={item.title}
            className="theme-panel rounded-2xl border border-slate-800/80 p-4 text-left"
          >
            <item.icon className="mb-3 h-5 w-5 text-amber-300" />
            <h2 className="text-sm font-bold text-slate-100">{item.title}</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{item.body}</p>
          </article>
        ))}
      </section>

      <FlashloanAnimation />

      <FlashloanArticle />

      <TestimonialsMarquee />

      <FlashLoanAttacksArticle />

      <FlashLoanAttacksVideo />

      <FlashLoanAttacksSection />
    </div>
  );
}
