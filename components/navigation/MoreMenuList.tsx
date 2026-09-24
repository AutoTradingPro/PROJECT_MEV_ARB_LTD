"use client";

import MegaMenuGroupedListPanel from "@/components/navigation/mega-menu/MegaMenuGroupedListPanel";
import { MORE_MENU_SECTIONS, moreItemHref } from "@/lib/navigation/moreMenu";

interface MoreMenuListProps {
  onNavigate?: () => void;
}

export default function MoreMenuList({ onNavigate }: MoreMenuListProps) {
  return (
    <MegaMenuGroupedListPanel
      sections={MORE_MENU_SECTIONS}
      itemHref={moreItemHref}
      onNavigate={onNavigate}
    />
  );
}
