"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gift,
  Home,
  Coins,
  LayoutGrid,
  Map,
  Repeat,
  Tag,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  MAIN_NAV_ITEMS,
  resolveActiveNavId,
  sectionHref,
  type MainNavId,
} from "@/lib/navigation/config";

const NAV_ICONS: Record<MainNavId, LucideIcon> = {
  markets: Home,
  dashboards: LayoutGrid,
  "mev-arb": Zap,
  staking: Coins,
  swap: Repeat,
  roadmap: Map,
  airdrop: Gift,
  more: Tag,
};

const ICON_CLASS = "h-3.5 w-3.5 shrink-0 stroke-[2.25]";

function itemTone(id: MainNavId, isActive: boolean): string {
  const idle = "border border-transparent text-slate-400 hover:bg-slate-900/40 hover:text-white";
  if (id === "markets" || id === "roadmap") {
    return isActive
      ? "border border-sky-500/35 bg-sky-500/10 text-sky-200"
      : `${idle} hover:text-sky-100`;
  }
  if (id === "mev-arb") {
    return isActive
      ? "border border-amber-500/30 bg-amber-500/10 text-amber-300"
      : idle;
  }
  if (id === "airdrop") {
    return isActive
      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : `${idle} hover:text-emerald-100`;
  }
  if (id === "staking") {
    return isActive
      ? "border border-amber-400/35 bg-amber-400/10 text-amber-200"
      : `${idle} hover:text-amber-100`;
  }
  if (id === "swap") {
    return isActive
      ? "border border-sky-500/35 bg-sky-500/10 text-sky-200"
      : `${idle} hover:text-sky-100`;
  }
  if (id === "more") {
    return isActive
      ? "border border-yellow-500/35 bg-yellow-500/10 text-yellow-200"
      : `${idle} hover:text-yellow-100`;
  }
  return isActive ? "border border-emerald-500/25 bg-slate-900/80 text-emerald-400" : idle;
}

function underlineClass(id: MainNavId): string {
  if (id === "markets" || id === "roadmap" || id === "swap") return "bg-sky-400";
  if (id === "mev-arb") return "bg-amber-400";
  if (id === "more") return "bg-yellow-400";
  if (id === "staking") return "bg-amber-400";
  return "bg-emerald-400";
}

export default function MainNav() {
  const pathname = usePathname();
  const activeId = resolveActiveNavId(pathname);

  return (
    <nav className="touch-scroll flex w-full items-center gap-1 py-1 scrollbar-none sm:gap-1.5 lg:w-auto">
      {MAIN_NAV_ITEMS.map((item) => {
        const href = item.href ?? sectionHref(item.id);
        const isActive = activeId === item.id;
        const Icon = NAV_ICONS[item.id];

        return (
          <Link
            key={item.id}
            href={href}
            className={`relative inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-all ${itemTone(
              item.id,
              isActive
            )}`}
          >
            <Icon className={ICON_CLASS} aria-hidden />
            {item.label}
            {isActive ? (
              <span className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${underlineClass(item.id)}`} />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
