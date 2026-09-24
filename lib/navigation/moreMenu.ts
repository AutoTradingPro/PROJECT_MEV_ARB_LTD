import {
  ArrowLeftRight,
  Brain,
  LayoutGrid,
  Mail,
  Megaphone,
  Rocket,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import type { MegaMenuSectionDef } from "@/lib/navigation/megaMenuTypes";
import { findSectionGroupLabel, flattenSectionSlugs } from "@/lib/navigation/megaMenuTypes";

export const MORE_MENU_SECTIONS: MegaMenuSectionDef[] = [
  {
    title: "Products",
    items: [
      {
        slug: "converter",
        label: "Converter",
        icon: ArrowLeftRight,
        iconBg: "bg-violet-600",
      },
      {
        slug: "newsletter",
        label: "Newsletter",
        icon: Mail,
        iconBg: "bg-blue-700",
      },
      {
        slug: "cmc-launch",
        label: "CMC Launch",
        icon: Rocket,
        iconBg: "bg-orange-500",
      },
      {
        slug: "cmc-labs",
        label: "CMC Labs",
        icon: Search,
        iconBg: "bg-emerald-500",
      },
      {
        slug: "cmc-max",
        label: "CMC Max",
        icon: ShieldCheck,
        iconBg: "bg-amber-500",
      },
      {
        slug: "top-stories",
        label: "Top Stories",
        icon: Brain,
        iconBg: "bg-orange-500",
      },
      {
        slug: "telegram-bot",
        label: "Telegram Bot",
        icon: Send,
        iconBg: "bg-cyan-500",
      },
      {
        slug: "advertise",
        label: "Advertise",
        icon: Megaphone,
        iconBg: "bg-blue-600",
      },
      {
        slug: "site-widgets",
        label: "Site Widgets",
        icon: LayoutGrid,
        iconBg: "bg-slate-400",
      },
    ],
  },
];

export const MORE_MENU_SLUGS = flattenSectionSlugs(MORE_MENU_SECTIONS);

export function moreItemHref(slug: string): string {
  return `/more/${slug}`;
}

export function moreItemLabel(slug: string): string | undefined {
  return findSectionGroupLabel(MORE_MENU_SECTIONS, slug);
}

export function isMoreMenuSlug(value: string): boolean {
  return MORE_MENU_SLUGS.includes(value);
}
