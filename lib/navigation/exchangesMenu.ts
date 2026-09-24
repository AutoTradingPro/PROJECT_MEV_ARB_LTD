import { ChevronsUp, Diamond, LayoutGrid, Triangle } from "lucide-react";
import type { MegaMenuSectionDef } from "@/lib/navigation/megaMenuTypes";
import { findSectionGroupLabel, flattenSectionSlugs } from "@/lib/navigation/megaMenuTypes";

export const EXCHANGES_MENU_SECTIONS: MegaMenuSectionDef[] = [
  {
    title: "Centralized Exchanges",
    items: [
      {
        slug: "cex-spot",
        label: "Spot",
        icon: Diamond,
        iconBg: "bg-blue-500",
      },
      {
        slug: "cex-derivatives",
        label: "Derivatives",
        icon: Triangle,
        iconBg: "bg-blue-500",
      },
    ],
  },
  {
    title: "Decentralized Exchanges",
    items: [
      {
        slug: "dex-spot",
        label: "Spot",
        icon: LayoutGrid,
        iconBg: "bg-emerald-500",
      },
      {
        slug: "dex-derivatives",
        label: "Derivatives",
        icon: ChevronsUp,
        iconBg: "bg-blue-800",
      },
    ],
  },
];

export const EXCHANGES_MENU_SLUGS = flattenSectionSlugs(EXCHANGES_MENU_SECTIONS);

export function exchangesItemHref(slug: string): string {
  return `/swap/${slug}`;
}

export function exchangesItemLabel(slug: string): string | undefined {
  return findSectionGroupLabel(EXCHANGES_MENU_SECTIONS, slug);
}

export function isExchangesMenuSlug(value: string): boolean {
  return EXCHANGES_MENU_SLUGS.includes(value);
}

export function exchangesSectionTitle(slug: string): string | undefined {
  for (const section of EXCHANGES_MENU_SECTIONS) {
    if (section.items.some((item) => item.slug === slug)) {
      return section.title;
    }
  }
  return undefined;
}
