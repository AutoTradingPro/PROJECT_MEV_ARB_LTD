"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import ScannerNetworkSwitcher from "@/components/ScannerNetworkSwitcher";
import type { TokenPairConfig } from "@/lib/chain/tokenPairs";

interface PairIconStackProps {
  pair: TokenPairConfig;
  size?: number;
}

export function PairIconStack({ pair, size = 28 }: PairIconStackProps) {
  const half = Math.round(size * 0.55);
  return (
    <div className="relative shrink-0" style={{ width: size + half / 2, height: size }}>
      <Image
        src={pair.baseIcon}
        alt={pair.baseSymbol}
        width={size}
        height={size}
        className="rounded-full border-2 border-slate-900 bg-slate-800"
        unoptimized
      />
      <Image
        src={pair.quoteIcon}
        alt={pair.quoteSymbol}
        width={half}
        height={half}
        className="rounded-full border-2 border-slate-900 bg-slate-800 absolute -right-1 bottom-0"
        unoptimized
      />
    </div>
  );
}

interface TokenPairSelectorProps {
  pairs: TokenPairConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
  headerExtra?: ReactNode;
  networkLabel?: string;
}

export default function TokenPairSelector({
  pairs,
  selectedId,
  onSelect,
  headerExtra,
  networkLabel,
}: TokenPairSelectorProps) {
  if (pairs.length === 0) {
    return (
      <div className="space-y-3">
        <ScannerNetworkSwitcher />
        <p className="text-xs text-slate-500 font-mono">
          Tidak ada pasangan populer untuk jaringan ini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ScannerNetworkSwitcher />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Pasangan Populer · {networkLabel ?? "jaringan aktif"}
        </span>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {headerExtra}
          <span className="text-[10px] text-slate-500 font-mono">{pairs.length} pair</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {pairs.map((pair) => {
          const active = pair.id === selectedId;
          return (
            <button
              key={pair.id}
              type="button"
              onClick={() => onSelect(pair.id)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                active
                  ? "border-amber-400/60 bg-amber-400/10 shadow-lg shadow-amber-400/5"
                  : "border-slate-800 bg-slate-950/50 hover:border-slate-600 hover:bg-slate-900"
              }`}
            >
              <PairIconStack pair={pair} size={24} />
              <span
                className={`text-[11px] font-mono font-bold truncate ${
                  active ? "text-amber-300" : "text-slate-300"
                }`}
              >
                {pair.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
