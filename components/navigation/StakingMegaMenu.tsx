"use client";

import MegaMenuListPanel from "@/components/navigation/mega-menu/MegaMenuListPanel";
import { STAKING_MENU_ITEMS, stakingItemHref } from "@/lib/navigation/stakingMenu";

interface StakingMegaMenuProps {
  onNavigate?: () => void;
}

export default function StakingMegaMenu({ onNavigate }: StakingMegaMenuProps) {
  return (
    <MegaMenuListPanel
      items={STAKING_MENU_ITEMS}
      itemHref={stakingItemHref}
      onNavigate={onNavigate}
    />
  );
}
