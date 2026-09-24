"use client";

import Link from "next/link";
import type { MegaMenuSection } from "@/lib/navigation/config";
import { megaItemHref, megaMenuRows, sectionLabel } from "@/lib/navigation/config";

interface MegaMenuGridProps {
  section: MegaMenuSection;
  onNavigate?: () => void;
}

export default function MegaMenuGrid({ section, onNavigate }: MegaMenuGridProps) {
  const rows = megaMenuRows();
  const gridCols = [5, 5, 3] as const;

  return (
    <div className="bg-slate-900/98 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/40 backdrop-blur-xl p-4 sm:p-5 space-y-3 transition-all">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-400/90">
          {sectionLabel(section)}
        </p>
        <span className="text-[10px] font-mono text-slate-500">13 modul</span>
      </div>

      {rows.map((items, rowIndex) => (
        <div
          key={rowIndex}
          className={`grid gap-2 ${
            gridCols[rowIndex] === 5 ? "grid-cols-5" : "grid-cols-3"
          }`}
        >
          {items.map((num) => (
            <Link
              key={num}
              href={megaItemHref(section, num)}
              onClick={onNavigate}
              className="group flex flex-col items-center justify-center min-h-[52px] rounded-xl border border-slate-800 bg-slate-950/60 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all"
            >
              <span className="text-lg font-black font-mono text-slate-200 group-hover:text-amber-300 tabular-nums">
                {num}
              </span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
