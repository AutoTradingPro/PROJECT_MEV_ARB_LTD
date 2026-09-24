"use client";

import MegaMenuItem from "@/components/navigation/mega-menu/MegaMenuItem";
import type { MegaMenuSectionDef } from "@/lib/navigation/megaMenuTypes";

interface MegaMenuGroupedListPanelProps {
  sections: MegaMenuSectionDef[];
  itemHref: (slug: string) => string;
  onNavigate?: () => void;
  className?: string;
  itemClassName?: string;
}

export default function MegaMenuGroupedListPanel({
  sections,
  itemHref,
  onNavigate,
  className = "",
  itemClassName = "",
}: MegaMenuGroupedListPanelProps) {
  return (
    <div
      className={`w-72 bg-slate-950/98 border border-slate-800 rounded-2xl shadow-xl shadow-black/50 backdrop-blur-xl p-3 transition-all duration-200 ${className}`}
    >
      {sections.map((section, sectionIndex) => (
        <div key={section.title} className={sectionIndex > 0 ? "mt-4 pt-4 border-t border-slate-800/80" : ""}>
          <h3 className="text-xs font-medium text-slate-500 mb-2 px-2">{section.title}</h3>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.slug}>
                <MegaMenuItem
                  href={itemHref(item.slug)}
                  {...item}
                  onNavigate={onNavigate}
                  className={itemClassName}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
