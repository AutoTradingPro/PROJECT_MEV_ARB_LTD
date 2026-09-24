"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, Landmark, LayoutDashboard, Settings, Users, X } from "lucide-react";
import { OWNER_NAV_ITEMS } from "@/lib/owner/nav";
import OwnerBrandLogo from "@/components/owner/OwnerBrandLogo";

const ICONS = {
  users: Users,
  overview: LayoutDashboard,
  finance: BookOpenText,
  vault: Landmark,
  settings: Settings,
} as const;

interface OwnerSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function OwnerSidebar({ open, onClose }: OwnerSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 md:hidden ${open ? "block" : "hidden"}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950 transition-transform print:hidden md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <OwnerBrandLogo />
            <div className="min-w-0">
              <p className="text-sm font-black tracking-wide text-amber-400 truncate">Owner Console</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Dashboard Owner</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 cursor-pointer"
            aria-label="Tutup menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {OWNER_NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.id as keyof typeof ICONS] ?? Users;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-amber-400/15 text-amber-300 border border-amber-500/30"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <p className="px-4 py-3 text-[10px] font-mono text-slate-600 border-t border-slate-800">
          Siap subdomain owner.*
        </p>
      </aside>
    </>
  );
}
