import { CheckCircle2, Gift, History, Sparkles, Trophy, Wallet } from "lucide-react";
import type { MegaMenuColumnDef } from "@/lib/navigation/megaMenuTypes";
import { findItemLabel, flattenColumnSlugs } from "@/lib/navigation/megaMenuTypes";

export const AIRDROP_MENU_COLUMNS: MegaMenuColumnDef[] = [
  {
    sections: [
      {
        title: "Campaign",
        items: [
          { slug: "eligibility", label: "Eligibility", icon: CheckCircle2, iconBg: "bg-emerald-500" },
          { slug: "tasks", label: "Tasks", icon: Sparkles, iconBg: "bg-amber-500" },
          { slug: "claim", label: "Claim", icon: Gift, iconBg: "bg-sky-500" },
        ],
      },
    ],
  },
  {
    sections: [
      {
        title: "Rewards",
        items: [
          { slug: "leaderboard", label: "Leaderboard", icon: Trophy, iconBg: "bg-orange-500" },
          { slug: "wallet", label: "Linked Wallet", icon: Wallet, iconBg: "bg-violet-600" },
          { slug: "history", label: "History", icon: History, iconBg: "bg-slate-600" },
        ],
      },
    ],
  },
];

export const AIRDROP_MENU_SLUGS = flattenColumnSlugs(AIRDROP_MENU_COLUMNS);

export function airdropItemHref(slug: string): string {
  return `/airdrop/${slug}`;
}

export function airdropItemLabel(slug: string): string | undefined {
  return findItemLabel(AIRDROP_MENU_COLUMNS, slug);
}

export function isAirdropMenuSlug(value: string): boolean {
  return AIRDROP_MENU_SLUGS.includes(value);
}
