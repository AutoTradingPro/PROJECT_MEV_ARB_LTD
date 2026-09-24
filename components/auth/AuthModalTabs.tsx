"use client";

import type { AuthTab } from "@/context/AuthContext";

interface AuthModalTabsProps {
  active: AuthTab;
  onChange: (tab: AuthTab) => void;
}

export default function AuthModalTabs({ active, onChange }: AuthModalTabsProps) {
  const tabs: { id: AuthTab; label: string }[] = [
    { id: "login", label: "Login" },
    { id: "register", label: "Create Account" },
  ];

  return (
    <div
      className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-950/80 border border-slate-800"
      role="tablist"
      aria-label="Autentikasi"
    >
      {tabs.map(({ id, label }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={`py-2.5 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              selected
                ? "bg-gradient-to-r from-amber-500/20 to-amber-400/10 text-amber-300 border border-amber-500/30 shadow-inner"
                : "text-slate-500 hover:text-slate-300 border border-transparent"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
