"use client";

import MegaMenuItem from "@/components/navigation/mega-menu/MegaMenuItem";
import type { MegaMenuColumnDef } from "@/lib/navigation/megaMenuTypes";

interface MegaMenuColumnProps {
  column: MegaMenuColumnDef;
  itemHref: (slug: string) => string;
  onNavigate?: () => void;
  showDivider?: boolean;
}

export default function MegaMenuColumn({
  column,
  itemHref,
  onNavigate,
  showDivider = false,
}: MegaMenuColumnProps) {
  return (
    <div
      className={`min-w-0 flex-1 px-4 first:pl-0 last:pr-0 ${
        showDivider ? "border-l border-slate-800/80 first:border-l-0" : ""
      }`}
    >
      {column.sections.map((section, sectionIndex) => (
        <div
          key={section.title || section.items[0]?.slug || sectionIndex}
          className={sectionIndex > 0 ? "mt-4 pt-4 border-t border-slate-800/80" : ""}
        >
          {section.title ? (
            <h3 className="text-xs font-medium text-slate-500 mb-2 px-2">{section.title}</h3>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.slug}>
                <MegaMenuItem
                  href={itemHref(item.slug)}
                  {...item}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
