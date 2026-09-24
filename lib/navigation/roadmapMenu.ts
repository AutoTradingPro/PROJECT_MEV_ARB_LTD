import { Coins, Flag, Layers, Map, Rocket, Shield } from "lucide-react";
import type { MegaMenuItemDef } from "@/lib/navigation/megaMenuTypes";
import { findListItemLabel, flattenListSlugs } from "@/lib/navigation/megaMenuTypes";

export const ROADMAP_MENU_ITEMS: MegaMenuItemDef[] = [
  {
    slug: "overview",
    label: "Overview",
    icon: Map,
    iconBg: "bg-sky-600",
  },
  {
    slug: "q1-foundation",
    label: "Q1 Foundation",
    icon: Flag,
    iconBg: "bg-amber-500",
  },
  {
    slug: "q2-multichain",
    label: "Q2 Multi-chain",
    icon: Layers,
    iconBg: "bg-emerald-500",
  },
  {
    slug: "q3-vault",
    label: "Q3 Vault & Risk",
    icon: Shield,
    iconBg: "bg-violet-600",
  },
  {
    slug: "q4-launch",
    label: "Q4 Public Launch",
    icon: Rocket,
    iconBg: "bg-orange-500",
  },
  {
    slug: "mva-coin",
    label: "MVA Coin",
    icon: Coins,
    iconBg: "bg-cyan-500",
    badge: "Horizon",
  },
];

export const ROADMAP_MENU_SLUGS = flattenListSlugs(ROADMAP_MENU_ITEMS);

export function roadmapItemHref(slug: string): string {
  return `/roadmap/${slug}`;
}

export function roadmapItemLabel(slug: string): string | undefined {
  return findListItemLabel(ROADMAP_MENU_ITEMS, slug);
}

export function isRoadmapMenuSlug(value: string): boolean {
  return ROADMAP_MENU_SLUGS.includes(value);
}
