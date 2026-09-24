"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";

interface SelectionCardProps {
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
  leading?: ReactNode;
}

export default function SelectionCard({
  title,
  subtitle,
  selected,
  onClick,
  leading,
}: SelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl px-3 py-3 flex items-center gap-3 transition-all cursor-pointer border ${
        selected
          ? "bg-slate-100 border-slate-200 shadow-sm"
          : "bg-white border-transparent hover:bg-slate-50"
      }`}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{title}</p>
        <p className="text-xs text-slate-500 truncate">{subtitle}</p>
      </div>
      {selected ? (
        <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}
