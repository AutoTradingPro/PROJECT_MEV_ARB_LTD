"use client";

import Link from "next/link";
import type { MegaMenuItemDef } from "@/lib/navigation/megaMenuTypes";

interface MegaMenuItemProps extends MegaMenuItemDef {
  href: string;
  onNavigate?: () => void;
  className?: string;
}

export default function MegaMenuItem({
  href,
  label,
  icon: Icon,
  iconText,
  iconBg,
  badge,
  onNavigate,
  className = "",
}: MegaMenuItemProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all duration-200 hover:bg-slate-800/60 ${className}`}
    >
      <span
        className={`shrink-0 w-9 h-9 rounded-full ${iconBg} flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-105`}
      >
        {Icon ? (
          <Icon className="w-4 h-4 text-white" strokeWidth={2.25} />
        ) : (
          <span
            className={`text-white font-bold leading-none ${
              iconText && iconText.length > 2 ? "text-[9px]" : "text-[11px]"
            }`}
          >
            {iconText}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors truncate">
          {label}
        </span>
        {badge ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-600 text-[10px] font-bold text-white leading-none">
            {badge}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
