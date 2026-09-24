"use client";

import MegaMenuGroupedListPanel from "@/components/navigation/mega-menu/MegaMenuGroupedListPanel";
import {
  EXCHANGES_MENU_SECTIONS,
  exchangesItemHref,
} from "@/lib/navigation/exchangesMenu";

interface ExchangesMegaMenuProps {
  onNavigate?: () => void;
}

export default function ExchangesMegaMenu({ onNavigate }: ExchangesMegaMenuProps) {
  return (
    <MegaMenuGroupedListPanel
      sections={EXCHANGES_MENU_SECTIONS}
      itemHref={exchangesItemHref}
      onNavigate={onNavigate}
      itemClassName="hover:bg-blue-500/10"
    />
  );
}
