"use client";

import { useEffect, useRef } from "react";
import { Settings, User } from "lucide-react";
import SettingsDropdown from "@/components/settings/SettingsDropdown";
import { useSettings } from "@/context/SettingsContext";

export default function SettingsButton() {
  const { settingsOpen, setSettingsOpen, toggleSettings, theme } = useSettings();
  const isLight = theme === "light";
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [setSettingsOpen]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={settingsOpen}
        aria-label="Pengaturan"
        onClick={toggleSettings}
        className={`box-border flex h-11 items-center gap-2 rounded-full border pl-3 pr-1 shadow-sm transition-all cursor-pointer ${
          settingsOpen
            ? isLight
              ? "border-blue-300 bg-slate-50"
              : "border-amber-500/40 bg-slate-900"
            : isLight
              ? "border-slate-200 bg-white hover:bg-slate-50"
              : "border-slate-700 bg-slate-900 hover:border-amber-500/35 hover:bg-slate-800"
        }`}
      >
        <Settings
          className={`w-4 h-4 shrink-0 stroke-[2.25] ${
            settingsOpen
              ? isLight
                ? "text-blue-600"
                : "text-amber-300"
              : isLight
                ? "text-slate-600"
                : "text-slate-400"
          }`}
        />
        <span className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center">
          <User className="w-4 h-4 text-slate-500" />
        </span>
      </button>

      {settingsOpen && <SettingsDropdown onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
