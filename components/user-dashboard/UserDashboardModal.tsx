"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { USER_DASHBOARD_TABS, type UserDashboardTab } from "@/lib/user-dashboard";
import ProfilePanel from "@/components/user-dashboard/ProfilePanel";
import MoneyManagementPanel from "@/components/user-dashboard/MoneyManagementPanel";
import StakingPanel from "@/components/user-dashboard/StakingPanel";
import AffiliatePanel from "@/components/user-dashboard/AffiliatePanel";

export default function UserDashboardModal() {
  const { user, isDashboardOpen, closeDashboard } = useAuth();
  const [tab, setTab] = useState<UserDashboardTab>("profile");

  useEffect(() => {
    if (!isDashboardOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDashboard();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isDashboardOpen, closeDashboard]);

  useEffect(() => {
    if (!user && isDashboardOpen) closeDashboard();
  }, [user, isDashboardOpen, closeDashboard]);

  if (!isDashboardOpen || !user) return null;

  return (
    <div
      className="ui-modal-root z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-dashboard-title"
    >
      <button
        type="button"
        aria-label="Tutup User Dashboard"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer"
        onClick={closeDashboard}
      />

      <div className="relative flex h-[min(92dvh,920px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl shadow-black/50">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-widest text-amber-400/90">Akun pengguna</p>
            <h2 id="user-dashboard-title" className="text-lg font-black tracking-wide text-white">
              User Dashboard
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-400">@{user.username}</p>
          </div>
          <button
            type="button"
            onClick={closeDashboard}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-3 py-2 sm:px-6">
          {USER_DASHBOARD_TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-xs font-bold uppercase tracking-wide cursor-pointer transition-colors ${
                  active
                    ? "border-amber-500/50 bg-amber-400/15 text-amber-300"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {tab === "profile" ? <ProfilePanel /> : null}
          {tab === "money" ? <MoneyManagementPanel /> : null}
          {tab === "staking" ? <StakingPanel /> : null}
          {tab === "affiliate" ? <AffiliatePanel /> : null}
        </div>
      </div>
    </div>
  );
}
