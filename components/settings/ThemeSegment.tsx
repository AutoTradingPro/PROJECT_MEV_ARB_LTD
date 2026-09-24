"use client";

import { useSettings, type AppTheme } from "@/context/SettingsContext";

export default function ThemeSegment() {
  const { theme, setTheme } = useSettings();

  const options: { id: AppTheme; label: string }[] = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
  ];

  return (
    <div className="inline-flex rounded-full bg-slate-100 p-0.5 border border-slate-200">
      {options.map((opt) => {
        const active = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme(opt.id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
