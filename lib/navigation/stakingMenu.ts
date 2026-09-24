import { Coins, History, Landmark, Lock, Percent, Sprout } from "lucide-react";
import type { MegaMenuItemDef } from "@/lib/navigation/megaMenuTypes";
import { findListItemLabel, flattenListSlugs } from "@/lib/navigation/megaMenuTypes";

export const STAKING_MENU_ITEMS: MegaMenuItemDef[] = [
  {
    slug: "overview",
    label: "Overview",
    icon: Landmark,
    iconBg: "bg-amber-500",
  },
  {
    slug: "stake",
    label: "Stake",
    icon: Coins,
    iconBg: "bg-emerald-500",
  },
  {
    slug: "unstake",
    label: "Unstake",
    icon: Sprout,
    iconBg: "bg-sky-500",
  },
  {
    slug: "yield",
    label: "Yield",
    icon: Percent,
    iconBg: "bg-violet-500",
  },
  {
    slug: "lock",
    label: "Lock Period",
    icon: Lock,
    iconBg: "bg-orange-500",
  },
  {
    slug: "history",
    label: "History",
    icon: History,
    iconBg: "bg-slate-500",
  },
];

export const STAKING_MENU_SLUGS = flattenListSlugs(STAKING_MENU_ITEMS);

export function stakingItemHref(slug: string): string {
  return `/staking/${slug}`;
}

export function stakingItemLabel(slug: string): string | undefined {
  return findListItemLabel(STAKING_MENU_ITEMS, slug);
}

export function isStakingMenuSlug(value: string): boolean {
  return STAKING_MENU_SLUGS.includes(value);
}
