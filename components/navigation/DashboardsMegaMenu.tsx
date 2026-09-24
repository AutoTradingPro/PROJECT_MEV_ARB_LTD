"use client";

import MegaMenuPanel from "@/components/navigation/mega-menu/MegaMenuPanel";
import { DASHBOARDS_MENU_COLUMNS, dashboardsItemHref } from "@/lib/navigation/dashboardsMenu";

interface DashboardsMegaMenuProps {
  onNavigate?: () => void;
}

export default function DashboardsMegaMenu({ onNavigate }: DashboardsMegaMenuProps) {
  return (
    <MegaMenuPanel
      columns={DASHBOARDS_MENU_COLUMNS}
      itemHref={dashboardsItemHref}
      onNavigate={onNavigate}
    />
  );
}
