"use client";

import MegaMenuPanel from "@/components/navigation/mega-menu/MegaMenuPanel";
import { MARKETS_MENU_COLUMNS, marketsItemHref } from "@/lib/navigation/marketsMenu";

interface MarketsMegaMenuProps {
  onNavigate?: () => void;
}

export default function MarketsMegaMenu({ onNavigate }: MarketsMegaMenuProps) {
  return (
    <MegaMenuPanel
      columns={MARKETS_MENU_COLUMNS}
      itemHref={marketsItemHref}
      onNavigate={onNavigate}
    />
  );
}
