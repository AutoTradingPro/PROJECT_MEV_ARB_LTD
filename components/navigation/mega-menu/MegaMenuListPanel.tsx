"use client";

import MegaMenuItem from "@/components/navigation/mega-menu/MegaMenuItem";
import type { MegaMenuItemDef } from "@/lib/navigation/megaMenuTypes";

interface MegaMenuListPanelProps {
  items: MegaMenuItemDef[];
  itemHref: (slug: string) => string;
  onNavigate?: () => void;
  className?: string;
}

export default function MegaMenuListPanel({
  items,
  itemHref,
  onNavigate,
  className = "",
}: MegaMenuListPanelProps) {
  return (
    <div
      className={`w-72 bg-slate-950/98 border border-slate-800 rounded-2xl shadow-xl shadow-black/50 backdrop-blur-xl p-2 transition-all duration-200 ${className}`}
    >
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.slug}>
            <MegaMenuItem href={itemHref(item.slug)} {...item} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}
