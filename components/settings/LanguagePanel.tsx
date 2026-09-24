"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import SelectionCard from "@/components/settings/SelectionCard";
import { useSettings } from "@/context/SettingsContext";
import { allLanguagesSorted, popularLanguages } from "@/lib/settings/languages";

export default function LanguagePanel() {
  const { language, setLanguage } = useSettings();
  const [query, setQuery] = useState("");

  const filteredPopular = useMemo(() => {
    const q = query.trim().toLowerCase();
    return popularLanguages().filter(
      (l) =>
        !q ||
        l.label.toLowerCase().includes(q) ||
        l.region.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [query]);

  const filteredAll = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allLanguagesSorted().filter(
      (l) =>
        !q ||
        l.label.toLowerCase().includes(q) ||
        l.region.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="w-full bg-slate-100 border-0 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {filteredPopular.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 mb-3">Popular languages</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {filteredPopular.map((item) => (
              <SelectionCard
                key={item.code}
                title={item.label}
                subtitle={item.region}
                selected={language === item.code}
                onClick={() => setLanguage(item.code)}
              />
            ))}
          </div>
        </section>
      )}

      {filteredAll.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 mb-3">All languages</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-[340px] overflow-y-auto pr-1">
            {filteredAll.map((item) => (
              <SelectionCard
                key={item.code}
                title={item.label}
                subtitle={item.region}
                selected={language === item.code}
                onClick={() => setLanguage(item.code)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
