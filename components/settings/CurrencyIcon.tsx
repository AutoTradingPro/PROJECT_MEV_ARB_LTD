"use client";

import type { CurrencyOption } from "@/lib/settings/currencies";

export function CurrencyIcon({ currency }: { currency: CurrencyOption }) {
  if (currency.icon === "usd") {
    return (
      <span className="w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">
        $
      </span>
    );
  }
  if (currency.icon === "eur") {
    return (
      <span className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
        €
      </span>
    );
  }
  if (currency.icon === "gbp") {
    return (
      <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
        £
      </span>
    );
  }
  if (currency.icon === "btc") {
    return (
      <span className="w-8 h-8 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center">
        ₿
      </span>
    );
  }
  if (currency.icon === "eth") {
    return (
      <span className="w-8 h-8 rounded-full bg-slate-400 text-white text-xs font-bold flex items-center justify-center">
        Ξ
      </span>
    );
  }
  return (
    <span className="w-8 h-8 rounded-full bg-slate-100 text-lg flex items-center justify-center">
      {currency.flag ?? "🏳️"}
    </span>
  );
}
