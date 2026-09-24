import {
  Calendar,
  CircleDot,
  Clock,
  Eye,
  Flame,
  Gauge,
  Globe,
  List,
  ListPlus,
  LockOpen,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { MegaMenuColumnDef } from "@/lib/navigation/megaMenuTypes";
import { flattenColumnSlugs, findItemLabel } from "@/lib/navigation/megaMenuTypes";

export const MARKETS_MENU_COLUMNS: MegaMenuColumnDef[] = [
  {
    sections: [
      {
        title: "Cryptocurrencies",
        items: [
          { slug: "ranking", label: "Ranking", icon: TrendingUp, iconBg: "bg-blue-500" },
          { slug: "categories", label: "Categories", icon: List, iconBg: "bg-orange-400" },
          { slug: "historical-snapshots", label: "Historical Snapshots", icon: Clock, iconBg: "bg-amber-400" },
          { slug: "token-unlocks", label: "Token unlocks", icon: LockOpen, iconBg: "bg-emerald-500" },
          { slug: "yield", label: "Yield", icon: Wallet, iconBg: "bg-blue-700" },
          { slug: "real-world-assets", label: "Real-World Assets", icon: Globe, iconBg: "bg-cyan-500" },
        ],
      },
    ],
  },
  {
    sections: [
      {
        title: "Leaderboards",
        items: [
          { slug: "trending", label: "Trending", icon: Flame, iconBg: "bg-red-500" },
          { slug: "upcoming", label: "Upcoming", icon: Clock, iconBg: "bg-violet-500" },
          { slug: "recently-added", label: "Recently Added", icon: ListPlus, iconBg: "bg-blue-500" },
          { slug: "gainers-losers", label: "Gainers & Losers", icon: TrendingUp, iconBg: "bg-emerald-500" },
          { slug: "most-visited", label: "Most Visited", icon: Eye, iconBg: "bg-cyan-500" },
          { slug: "community-sentiment", label: "Community Sentiment", icon: Gauge, iconBg: "bg-blue-600" },
        ],
      },
    ],
  },
  {
    sections: [
      {
        title: "NFT",
        items: [
          { slug: "overall-nft-stats", label: "Overall NFT Stats", icon: CircleDot, iconBg: "bg-indigo-600" },
          { slug: "upcoming-sales", label: "Upcoming Sales", icon: Calendar, iconBg: "bg-emerald-500" },
        ],
      },
    ],
  },
];

export const MARKETS_MENU_SLUGS = flattenColumnSlugs(MARKETS_MENU_COLUMNS);

export function marketsItemHref(slug: string): string {
  return `/markets/${slug}`;
}

export function marketsItemLabel(slug: string): string | undefined {
  return findItemLabel(MARKETS_MENU_COLUMNS, slug);
}

export function isMarketsMenuSlug(value: string): boolean {
  return MARKETS_MENU_SLUGS.includes(value);
}
