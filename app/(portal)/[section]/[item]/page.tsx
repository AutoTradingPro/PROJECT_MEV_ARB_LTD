import { notFound } from "next/navigation";
import DevelopingPlaceholder from "@/components/layout/DevelopingPlaceholder";
import RoadmapMvaCoin from "@/components/roadmap/RoadmapMvaCoin";
import {
  isRoadmapMenuSlug,
  roadmapItemLabel,
  ROADMAP_MENU_SLUGS,
} from "@/lib/navigation/roadmapMenu";
import {
  airdropItemLabel,
  AIRDROP_MENU_SLUGS,
  isAirdropMenuSlug,
} from "@/lib/navigation/airdropMenu";
import {
  dashboardsItemLabel,
  DASHBOARDS_MENU_SLUGS,
  isDashboardsMenuSlug,
} from "@/lib/navigation/dashboardsMenu";
import {
  exchangesItemLabel,
  EXCHANGES_MENU_SLUGS,
  isExchangesMenuSlug,
} from "@/lib/navigation/exchangesMenu";
import {
  isStakingMenuSlug,
  stakingItemLabel,
  STAKING_MENU_SLUGS,
} from "@/lib/navigation/stakingMenu";
import {
  isMarketsMenuSlug,
  marketsItemLabel,
  MARKETS_MENU_SLUGS,
} from "@/lib/navigation/marketsMenu";
import {
  isMegaMenuSection,
  MEGA_ITEM_COUNT,
  MEGA_MENU_SECTIONS,
  sectionLabel,
  type MegaMenuSection,
} from "@/lib/navigation/config";

interface SectionItemPageProps {
  params: Promise<{ section: string; item: string }>;
}

export function generateStaticParams() {
  const marketsParams = MARKETS_MENU_SLUGS.map((slug) => ({
    section: "markets",
    item: slug,
  }));

  const dashboardsParams = DASHBOARDS_MENU_SLUGS.map((slug) => ({
    section: "dashboards",
    item: slug,
  }));

  const stakingParams = STAKING_MENU_SLUGS.map((slug) => ({
    section: "staking",
    item: slug,
  }));

  const exchangesParams = EXCHANGES_MENU_SLUGS.map((slug) => ({
    section: "swap",
    item: slug,
  }));

  const roadmapParams = ROADMAP_MENU_SLUGS.map((slug) => ({
    section: "roadmap",
    item: slug,
  }));

  const airdropParams = AIRDROP_MENU_SLUGS.map((slug) => ({
    section: "airdrop",
    item: slug,
  }));

  const legacySections = MEGA_MENU_SECTIONS.filter(
    (s) =>
      s !== "markets" &&
      s !== "dashboards" &&
      s !== "staking" &&
      s !== "swap" &&
      s !== "roadmap" &&
      s !== "airdrop"
  );

  const otherParams = legacySections.flatMap((section) =>
    Array.from({ length: MEGA_ITEM_COUNT }, (_, i) => ({
      section,
      item: String(i + 1),
    }))
  );

  return [
    ...marketsParams,
    ...dashboardsParams,
    ...stakingParams,
    ...exchangesParams,
    ...roadmapParams,
    ...airdropParams,
    ...otherParams,
  ];
}

export default async function SectionItemPage({ params }: SectionItemPageProps) {
  const { section, item } = await params;
  if (!isMegaMenuSection(section)) notFound();

  const label = sectionLabel(section as MegaMenuSection);

  if (section === "markets") {
    if (!isMarketsMenuSlug(item)) notFound();
    return (
      <DevelopingPlaceholder menuLabel={label} subLabel={marketsItemLabel(item)} />
    );
  }

  if (section === "dashboards") {
    if (!isDashboardsMenuSlug(item)) notFound();
    return (
      <DevelopingPlaceholder menuLabel={label} subLabel={dashboardsItemLabel(item)} />
    );
  }

  if (section === "staking") {
    if (!isStakingMenuSlug(item)) notFound();
    return (
      <DevelopingPlaceholder menuLabel={label} subLabel={stakingItemLabel(item)} />
    );
  }

  if (section === "swap") {
    if (!isExchangesMenuSlug(item)) notFound();
    return (
      <DevelopingPlaceholder menuLabel={label} subLabel={exchangesItemLabel(item)} />
    );
  }

  if (section === "roadmap") {
    if (!isRoadmapMenuSlug(item)) notFound();
    if (item === "mva-coin") {
      return <RoadmapMvaCoin />;
    }
    return (
      <DevelopingPlaceholder menuLabel={label} subLabel={roadmapItemLabel(item)} />
    );
  }

  if (section === "airdrop") {
    if (!isAirdropMenuSlug(item)) notFound();
    return (
      <DevelopingPlaceholder menuLabel={label} subLabel={airdropItemLabel(item)} />
    );
  }

  const num = Number(item);
  if (!Number.isInteger(num) || num < 1 || num > MEGA_ITEM_COUNT) notFound();

  return (
    <DevelopingPlaceholder menuLabel={label} subLabel={`Modul ${num}`} />
  );
}
