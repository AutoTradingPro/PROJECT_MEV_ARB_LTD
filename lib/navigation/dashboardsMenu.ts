import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowUpDown,
  BarChart3,
  CircleDot,
  FileText,
  Gauge,
  Hash,
  LineChart,
  Minus,
  RefreshCw,
  TrendingUp,
  Wallet,
  Waves,
} from "lucide-react";
import type { MegaMenuColumnDef } from "@/lib/navigation/megaMenuTypes";
import { flattenColumnSlugs, findItemLabel } from "@/lib/navigation/megaMenuTypes";

export const DASHBOARDS_MENU_COLUMNS: MegaMenuColumnDef[] = [
  {
    sections: [
      {
        title: "Markets",
        items: [
          { slug: "market-overview", label: "Market Overview", icon: LineChart, iconBg: "bg-violet-500" },
          { slug: "spot-market", label: "Spot Market", icon: CircleDot, iconBg: "bg-blue-500" },
          { slug: "no-of-cryptocurrencies", label: "No. of Cryptocurrencies", icon: Hash, iconBg: "bg-teal-500" },
          { slug: "bitcoin-treasuries", label: "Bitcoin Treasuries", iconText: "₿", iconBg: "bg-orange-500" },
          { slug: "bnb-treasuries", label: "BNB Treasuries", iconText: "◆", iconBg: "bg-yellow-500" },
          { slug: "exchange-inflows-outflows", label: "Exchange Inflows/Outflows", icon: ArrowUpDown, iconBg: "bg-blue-700" },
        ],
      },
    ],
  },
  {
    sections: [
      {
        title: "Indicators",
        items: [
          { slug: "fear-and-greed-index", label: "Fear and Greed Index", icon: Gauge, iconBg: "bg-orange-500" },
          { slug: "altcoin-season-index", label: "Altcoin Season Index", icon: RefreshCw, iconBg: "bg-cyan-500" },
          { slug: "market-cycle-indicators", label: "Market Cycle Indicators", icon: Waves, iconBg: "bg-emerald-500" },
          { slug: "bitcoin-dominance", label: "Bitcoin Dominance", iconText: "₿", iconBg: "bg-orange-500" },
          { slug: "cmc-20-index", label: "CoinMarketCap 20 Index", iconText: "20", iconBg: "bg-blue-700" },
          { slug: "cmc-100-index", label: "CoinMarketCap 100 Index", iconText: "100", iconBg: "bg-blue-500" },
        ],
      },
    ],
  },
  {
    sections: [
      {
        title: "ETF Flows",
        items: [
          { slug: "crypto-etfs", label: "Crypto ETFs", icon: BarChart3, iconBg: "bg-violet-500" },
          { slug: "bitcoin-etfs", label: "Bitcoin ETFs", iconText: "₿", iconBg: "bg-orange-500" },
          { slug: "ethereum-etfs", label: "Ethereum ETFs", iconText: "Ξ", iconBg: "bg-blue-500" },
        ],
      },
      {
        title: "Technical analysis",
        items: [
          { slug: "rsi", label: "RSI", icon: Activity, iconBg: "bg-emerald-500" },
          { slug: "macd", label: "MACD", icon: TrendingUp, iconBg: "bg-blue-500" },
        ],
      },
    ],
  },
  {
    sections: [
      {
        title: "Derivatives",
        items: [
          { slug: "derivatives-overview", label: "Overview", icon: FileText, iconBg: "bg-cyan-500" },
          { slug: "liquidations", label: "Liquidations", icon: Minus, iconBg: "bg-red-500" },
          { slug: "funding-rates", label: "Funding Rates", icon: Wallet, iconBg: "bg-emerald-500" },
        ],
      },
    ],
  },
];

export const DASHBOARDS_MENU_SLUGS = flattenColumnSlugs(DASHBOARDS_MENU_COLUMNS);

export function dashboardsItemHref(slug: string): string {
  return `/dashboards/${slug}`;
}

export function dashboardsItemLabel(slug: string): string | undefined {
  return findItemLabel(DASHBOARDS_MENU_COLUMNS, slug);
}

export function isDashboardsMenuSlug(value: string): boolean {
  return DASHBOARDS_MENU_SLUGS.includes(value);
}
