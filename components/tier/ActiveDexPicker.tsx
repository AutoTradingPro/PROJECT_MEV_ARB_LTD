"use client";

import { useEffect, useState } from "react";
import { defaultDexIdsForChain, dexRoutesForChain } from "@/lib/bot/constants";
import type { BotConfig, DexId } from "@/lib/bot/types";
import { useBotConfig } from "@/context/BotConfigContext";
import { useNetwork } from "@/context/NetworkContext";

interface ActiveDexPickerProps {
  config: BotConfig;
  onChange: (config: BotConfig) => void;
  compact?: boolean;
}

export default function ActiveDexPicker({ config, onChange, compact }: ActiveDexPickerProps) {
  const { chainId } = useNetwork();
  const { patchConfig } = useBotConfig();
  const preferred = defaultDexIdsForChain(chainId);
  const routes = [...dexRoutesForChain(chainId)].sort((a, b) => {
    const rank = (id: string) => {
      const index = preferred.indexOf(id as (typeof preferred)[number]);
      return index === -1 ? 99 : index;
    };
    return rank(a.id) - rank(b.id);
  });
  const scoped = config.activeDexIds.filter((id) => routes.some((item) => item.id === id));
  const fromConfig =
    config.chainId !== chainId || scoped.length === 0 ? preferred : scoped;
  const [pending, setPending] = useState<DexId[] | null>(null);
  const selected = pending ?? fromConfig;

  useEffect(() => {
    setPending(null);
  }, [config.activeDexIds, chainId]);

  return (
    <fieldset className={`${compact ? "space-y-1.5" : "space-y-2"} m-0 min-w-0 border-0 p-0`}>
      <legend className={`text-slate-400 ${compact ? "text-[10px]" : "text-xs"}`}>
        DEX aktif (klik untuk on/off — masuk Table Price)
      </legend>
      <div className={`flex flex-wrap gap-2 ${compact ? "" : "gap-y-2"}`}>
        {routes.map((dex) => {
          const checked = selected.includes(dex.id);
          return (
            <button
              key={dex.id}
              type="button"
              aria-pressed={checked}
              onClick={() => {
                const next = checked
                  ? selected.filter((id) => id !== dex.id)
                  : [...selected, dex.id];
                const ids = (next.length > 0 ? next : [dex.id]) as DexId[];
                setPending(ids);
                patchConfig({ activeDexIds: ids, chainId });
                onChange({ ...config, activeDexIds: ids, chainId });
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 cursor-pointer transition-colors ${
                checked
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-slate-800 bg-slate-950/60 text-slate-500 hover:text-slate-300"
              } ${compact ? "text-[10px]" : "text-xs"}`}
            >
              {dex.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
