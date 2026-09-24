import { notFound } from "next/navigation";
import DevelopingPlaceholder from "@/components/layout/DevelopingPlaceholder";
import MarketsLanding from "@/components/markets/MarketsLanding";
import ProductsLanding from "@/components/products/ProductsLanding";
import RoadmapLanding from "@/components/roadmap/RoadmapLanding";
import AirdropLanding from "@/components/airdrop/AirdropLanding";
import SwapLanding from "@/components/swap/SwapLanding";
import StakingLanding from "@/components/staking/StakingLanding";
import {
  isMegaMenuSection,
  MEGA_MENU_SECTIONS,
  sectionLabel,
  type MegaMenuSection,
} from "@/lib/navigation/config";

interface SectionIndexPageProps {
  params: Promise<{ section: string }>;
}

export function generateStaticParams() {
  return MEGA_MENU_SECTIONS.map((section) => ({ section }));
}

export default async function SectionIndexPage({ params }: SectionIndexPageProps) {
  const { section } = await params;
  if (!isMegaMenuSection(section)) notFound();
  if (section === "markets") {
    return <MarketsLanding />;
  }
  if (section === "dashboards") {
    return <ProductsLanding />;
  }
  if (section === "roadmap") {
    return <RoadmapLanding />;
  }
  if (section === "airdrop") {
    return <AirdropLanding />;
  }
  if (section === "swap") {
    return <SwapLanding />;
  }
  if (section === "staking") {
    return <StakingLanding />;
  }

  return <DevelopingPlaceholder menuLabel={sectionLabel(section as MegaMenuSection)} />;
}
