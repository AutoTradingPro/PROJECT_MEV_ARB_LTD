"use client";

import MegaMenuListPanel from "@/components/navigation/mega-menu/MegaMenuListPanel";
import { ROADMAP_MENU_ITEMS, roadmapItemHref } from "@/lib/navigation/roadmapMenu";

interface RoadmapMegaMenuProps {
  onNavigate?: () => void;
}

export default function RoadmapMegaMenu({ onNavigate }: RoadmapMegaMenuProps) {
  return (
    <MegaMenuListPanel
      items={ROADMAP_MENU_ITEMS}
      itemHref={roadmapItemHref}
      onNavigate={onNavigate}
    />
  );
}
