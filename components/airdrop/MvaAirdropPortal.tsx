"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Crown,
  Gift,
  HardHat,
  LayoutDashboard,
  Link2,
  Rocket,
  ShieldCheck,
  Sprout,
  Star,
  Trophy,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const STATS = [
  { label: "Campaign Duration", value: "30 DAYS" },
  { label: "Max Participants", value: "1,000" },
  { label: "Total MVA Pool", value: "25,000,000" },
  { label: "Total Tasks", value: "150" },
] as const;

const TIERS: {
  id: string;
  tier: string;
  title: string;
  body: string;
  reward: string;
  icon: LucideIcon;
  iconClass: string;
}[] = [
  {
    id: "member",
    tier: "Tier 1",
    title: "Community Member",
    body: "Complete basic community tasks and earn entry-level rewards.",
    reward: "1,000 $MVA",
    icon: Sprout,
    iconClass: "text-emerald-400",
  },
  {
    id: "builder",
    tier: "Tier 2",
    title: "Community Builder",
    body: "Actively grow the community and complete engagement tasks.",
    reward: "5,000 $MVA",
    icon: HardHat,
    iconClass: "text-amber-300",
  },
  {
    id: "ambassador",
    tier: "Tier 3",
    title: "MVA Ambassador",
    body: "Lead by example, refer participants, and drive ecosystem growth.",
    reward: "10,000 $MVA",
    icon: Crown,
    iconClass: "text-yellow-300",
  },
  {
    id: "legend",
    tier: "Tier 4",
    title: "Legendary Supporter",
    body: "Top-tier contributors who go above and beyond for the ecosystem.",
    reward: "25,000 $MVA",
    icon: Star,
    iconClass: "text-amber-400",
  },
];

const chipClass =
  "group flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-[#0a0a0a] px-3.5 py-3 text-left text-[13px] font-semibold text-zinc-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/55 hover:bg-amber-500/10 hover:text-amber-100 hover:shadow-[0_0_18px_rgba(245,196,0,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

export default function MvaAirdropPortal() {
  const { user, openModal, openDashboard } = useAuth();

  const openAccount = () => {
    if (user) {
      openDashboard();
      return;
    }
    openModal("login");
  };

  return (
    <section className="relative mt-14 space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-amber-500/15 bg-black px-4 py-12 sm:px-8 sm:py-16">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 48% 36% at 50% 8%, rgba(245,197,24,0.14), transparent 58%)",
          }}
        />
        <p
          className="pointer-events-none absolute left-[-4%] top-[42%] select-none text-[11vw] font-black leading-none tracking-tight text-white/[0.035] sm:text-[5.5rem]"
          aria-hidden
        >
          MVA COMMUNITY
        </p>
        <p
          className="pointer-events-none absolute right-[-2%] top-[48%] select-none text-[14vw] font-black leading-none tracking-tight text-white/[0.03] sm:text-[7rem]"
          aria-hidden
        >
          AIRDROP
        </p>

        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <span className="mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-amber-400/45 bg-black shadow-[0_0_28px_rgba(245,196,0,0.28)]">
            <Rocket className="h-7 w-7 text-amber-300" strokeWidth={1.75} />
          </span>

          <span className="rounded-full border border-amber-500/35 bg-black/60 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/90">
            Coming Soon
          </span>

          <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl">
            MVA COMMUNITY
          </h2>
          <p className="mt-1 text-3xl font-black tracking-tight text-[#F5C400] sm:text-5xl">
            AIRDROP PORTAL
          </p>
          <p className="mt-4 max-w-xl text-sm italic leading-relaxed text-zinc-400">
            Complete tasks, earn points, climb the leaderboard, and qualify for MVA community rewards.
          </p>

          <div className="mt-8 grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-amber-500/20 bg-[#080808]/90 px-3 py-4"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {stat.label}
                </p>
                <p className="mt-1.5 text-sm font-black text-[#F5C400] sm:text-base">{stat.value}</p>
              </div>
            ))}
          </div>

          <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
            Max tier reward:{" "}
            <span className="text-amber-300/90">25,000 $MVA per active participant</span>
          </p>

          <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-2xl border border-amber-500/30 bg-[#0b0b0b] px-4 py-3 sm:px-6">
            <Trophy className="h-4 w-4 shrink-0 text-amber-300" />
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Bonus Pool</p>
              <p className="text-[12px] font-black text-[#F5C400] sm:text-[13px]">
                50,000 $MVA per winner · 5,000,000 $MVA total
              </p>
            </div>
          </div>

          {user ? (
            <Link
              href="/airdrop/claim"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-[#F5C400] px-8 py-2.5 text-[12px] font-black uppercase tracking-[0.16em] text-black shadow-[0_0_24px_rgba(245,196,0,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffd84a] hover:shadow-[0_0_32px_rgba(245,196,0,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <Rocket className="h-4 w-4" strokeWidth={2.4} />
              Claim Rewards
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openModal("register")}
              className="mt-8 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F5C400] px-8 py-2.5 text-[12px] font-black uppercase tracking-[0.16em] text-black shadow-[0_0_24px_rgba(245,196,0,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffd84a] hover:shadow-[0_0_32px_rgba(245,196,0,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <Rocket className="h-4 w-4" strokeWidth={2.4} />
              Sign Up
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <h3 className="text-center text-[13px] font-black uppercase tracking-[0.22em] text-[#F5C400]">
          Reward Tier Structure
        </h3>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            return (
              <article
                key={tier.id}
                className="flex h-full flex-col rounded-[22px] border border-amber-500/20 bg-[#080808]/90 px-5 py-6 transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/45 hover:shadow-[0_0_24px_rgba(245,196,0,0.12)]"
              >
                <Icon className={`h-6 w-6 ${tier.iconClass}`} strokeWidth={1.75} />
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  {tier.tier}
                </p>
                <h4 className="mt-1 text-[13px] font-black uppercase tracking-[0.08em] text-white">
                  {tier.title}
                </h4>
                <p className="mt-3 flex-1 text-[12px] leading-relaxed text-zinc-400">{tier.body}</p>
                <div className="mt-5 border-t border-amber-500/15 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Max Reward
                  </p>
                  <p className="mt-1 text-sm font-black text-[#F5C400]">{tier.reward}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded-[28px] border border-amber-500/15 bg-black px-4 py-8 sm:px-8">
        <h3 className="text-center text-[13px] font-black uppercase tracking-[0.22em] text-[#F5C400]">
          Portal Features Coming Soon
        </h3>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button type="button" onClick={openAccount} className={`${chipClass} cursor-pointer`}>
            <LayoutDashboard className="h-4 w-4 text-sky-400" />
            User Dashboard
          </button>
          <Link href="/airdrop/tasks" className={chipClass}>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Task Center
          </Link>
          <Link href="/airdrop/leaderboard" className={chipClass}>
            <Trophy className="h-4 w-4 text-amber-300" />
            Leaderboard
          </Link>
          <Link href="/airdrop/claim" className={chipClass}>
            <Gift className="h-4 w-4 text-orange-300" />
            Rewards Center
          </Link>
          <Link href="/airdrop/wallet" className={chipClass}>
            <Wallet className="h-4 w-4 text-rose-400" />
            Wallet Center
          </Link>
          <button type="button" onClick={openAccount} className={`${chipClass} cursor-pointer`}>
            <UserRound className="h-4 w-4 text-zinc-300" />
            Profile Management
          </button>
          <Link href="/airdrop/eligibility" className={chipClass}>
            <Link2 className="h-4 w-4 text-zinc-300" />
            Referral Center
          </Link>
          <Link href="/airdrop/eligibility" className={chipClass}>
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            Verification System
          </Link>
        </div>
      </div>
    </section>
  );
}
