"use client";

import MegaMenuPanel from "@/components/navigation/mega-menu/MegaMenuPanel";
import { AIRDROP_MENU_COLUMNS, airdropItemHref } from "@/lib/navigation/airdropMenu";

interface AirdropMegaMenuProps {
  onNavigate?: () => void;
}

export default function AirdropMegaMenu({ onNavigate }: AirdropMegaMenuProps) {
  return (
    <MegaMenuPanel
      columns={AIRDROP_MENU_COLUMNS}
      itemHref={airdropItemHref}
      onNavigate={onNavigate}
    />
  );
}
