"use client";

import MegaMenuColumn from "@/components/navigation/mega-menu/MegaMenuColumn";
import type { MegaMenuColumnDef } from "@/lib/navigation/megaMenuTypes";

interface MegaMenuPanelProps {
  columns: MegaMenuColumnDef[];
  itemHref: (slug: string) => string;
  onNavigate?: () => void;
}

export default function MegaMenuPanel({ columns, itemHref, onNavigate }: MegaMenuPanelProps) {
  return (
    <div className="bg-slate-950/98 border border-slate-800 rounded-2xl shadow-xl shadow-black/50 backdrop-blur-xl p-5 sm:p-6 transition-all duration-200">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-0">
        {columns.map((column, index) => (
          <MegaMenuColumn
            key={column.sections.map((s) => s.title).join("-")}
            column={column}
            itemHref={itemHref}
            onNavigate={onNavigate}
            showDivider={index > 0}
          />
        ))}
      </div>
    </div>
  );
}
