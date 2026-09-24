import Link from "next/link";
import { CheckCircle2, Gift, History, Sparkles, Trophy, Wallet } from "lucide-react";
import MvaAirdropPortal from "@/components/airdrop/MvaAirdropPortal";
import MvaCoinHero from "@/components/airdrop/MvaCoinHero";
import MvaCommunityHub from "@/components/airdrop/MvaCommunityHub";
import MvaTokenomics from "@/components/airdrop/MvaTokenomics";
import MvaTreasuryPrinciples from "@/components/airdrop/MvaTreasuryPrinciples";
import { AIRDROP_MENU_COLUMNS, airdropItemHref } from "@/lib/navigation/airdropMenu";

const COPY: Record<string, string> = {
  eligibility: "Cek syarat wallet, volume, dan status operator sebelum klaim.",
  tasks: "Selesaikan tugas kampanye untuk menaikkan alokasi.",
  claim: "Klaim reward ke wallet terhubung setelah syarat terpenuhi.",
  leaderboard: "Peringkat kontribusi dan alokasi kampanye.",
  wallet: "Hubungkan wallet yang akan menerima drop.",
  history: "Riwayat klaim dan distribusi sebelumnya.",
};

const ICONS = {
  eligibility: CheckCircle2,
  tasks: Sparkles,
  claim: Gift,
  leaderboard: Trophy,
  wallet: Wallet,
  history: History,
} as const;

export default function AirdropLanding() {
  const items = AIRDROP_MENU_COLUMNS.flatMap((col) =>
    col.sections.flatMap((section) => section.items)
  );

  return (
    <div className="relative w-full overflow-hidden">
      <MvaCoinHero />

      <section className="relative mx-auto mt-10 w-full max-w-6xl px-1 pb-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-400/80">
          Campaign
        </p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
          Operator rewards &amp; claim
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = ICONS[item.slug as keyof typeof ICONS] ?? Gift;
            return (
              <Link
                key={item.slug}
                href={airdropItemHref(item.slug)}
                className="group rounded-2xl border border-amber-500/15 bg-slate-950/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-amber-400/40 hover:bg-slate-900/80"
              >
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-sm font-bold text-slate-100 group-hover:text-white">{item.label}</h3>
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">
                  {COPY[item.slug] ?? "Modul sedang disusun."}
                </p>
              </Link>
            );
          })}
        </div>

        <MvaTokenomics />
        <MvaAirdropPortal />
        <MvaTreasuryPrinciples />
        <MvaCommunityHub />
      </section>
    </div>
  );
}
