import Image from "next/image";
import Link from "next/link";
import { Crown, Gem } from "lucide-react";
import { MVA_HERO_LINKS, MVA_METRIC_CARDS } from "@/lib/airdrop/mvaHero";

function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export default function MvaCoinHero() {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-amber-500/15 bg-black px-4 py-12 sm:px-8 sm:py-16">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 42% 38% at 50% 12%, rgba(245,197,24,0.18), transparent 58%), radial-gradient(ellipse 70% 50% at 50% 100%, rgba(180,120,20,0.08), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(245,197,24,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(245,197,24,0.35) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-400/80">
          AirDrop · MVA Coin
        </p>

        <div className="relative mb-8 flex h-[220px] w-[220px] items-center justify-center sm:h-[280px] sm:w-[280px]">
          <div
            className="mva-gold-halo-soft pointer-events-none absolute h-[92%] w-[92%] rounded-full bg-[#F5C400]/40 blur-3xl animate-mva-gold-glow-soft"
            aria-hidden
          />
          <div
            className="mva-gold-halo pointer-events-none absolute h-[70%] w-[70%] rounded-full bg-amber-300/55 blur-2xl animate-mva-gold-glow"
            aria-hidden
          />
          <div className="relative z-10 overflow-hidden rounded-full">
            <Image
              src="/images/mva-coin.png"
              alt="MVA Coin"
              width={240}
              height={240}
              priority
              className="h-[176px] w-[176px] object-cover sm:h-[232px] sm:w-[232px]"
            />
          </div>
        </div>

        <h1 className="text-[2.6rem] font-black leading-none tracking-tight text-[#F5C400] sm:text-6xl md:text-7xl">
          MVA COIN
        </h1>
        <p className="mt-4 text-lg font-extrabold uppercase tracking-[0.22em] text-[#E8B40C] sm:text-xl">
          Beyond the limit
        </p>
        <p className="mt-5 max-w-2xl text-sm font-medium leading-relaxed text-white sm:text-[15px]">
          Building a premium digital ecosystem focused on transparency, community participation,
          treasury visibility, and long-term ecosystem development.
        </p>

        <div className="mt-10 w-full rounded-[22px] border border-amber-500/20 bg-[#070707]/80 p-4 sm:p-6">
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href={MVA_HERO_LINKS.exploreMva}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F5C400] px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-black shadow-[0_0_24px_rgba(245,196,0,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffd84a] hover:shadow-[0_0_32px_rgba(245,196,0,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <Gem className="h-3.5 w-3.5" strokeWidth={2.5} />
              Explore MVA
            </Link>
            <Link
              href={MVA_HERO_LINKS.joinCommunity}
              {...(isExternalHref(MVA_HERO_LINKS.joinCommunity)
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-500/45 bg-black/40 px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-amber-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-500/10 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <Crown className="h-3.5 w-3.5" strokeWidth={2.25} />
              Join Community
            </Link>
            <Link
              href={MVA_HERO_LINKS.exploreDashboard}
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-transparent px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/60 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              Explore Dashboard
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {MVA_METRIC_CARDS.map((label) => (
              <div
                key={label}
                className="rounded-2xl border border-amber-500/25 bg-black/70 px-3 py-3.5 text-center shadow-[inset_0_0_0_1px_rgba(0,0,0,0.4)]"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200/85">
                  {label}
                </p>
                <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#F5C400]">
                  Coming Soon
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
