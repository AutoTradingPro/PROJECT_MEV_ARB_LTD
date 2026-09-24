"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CurrencyIcon } from "@/components/settings/CurrencyIcon";
import SelectionCard from "@/components/settings/SelectionCard";
import { useSettings } from "@/context/SettingsContext";
import { CURRENCIES, type CurrencyCategory } from "@/lib/settings/currencies";

const SECTIONS: { key: CurrencyCategory; title: string }[] = [
  { key: "popular", title: "Popular currencies" },
  { key: "bitcoin", title: "Bitcoin Units" },
  { key: "fiat", title: "Fiat currencies" },
];

export default function CurrencyPanel() {
  const { currency, setCurrency } = useSettings();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
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

      {SECTIONS.map(({ key, title }) => {
        const items = filtered.filter((c) => c.category === key);
        if (items.length === 0) return null;
        return (
          <section key={key}>
            <h3 className="text-xs font-semibold text-slate-500 mb-3">{title}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {items.map((item) => (
                <SelectionCard
                  key={item.code}
                  title={item.label}
                  subtitle={`${item.code} - ${item.symbol}`}
                  selected={currency === item.code}
                  onClick={() => setCurrency(item.code)}
                  leading={<CurrencyIcon currency={item} />}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
