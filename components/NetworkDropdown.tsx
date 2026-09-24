"use client";

import Image from "next/image";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TRADING_CHAIN_LIST, getTradingNetwork, isTradingChainId, type TradingChainId } from "@/config/networks";
import { getChain, type ChainId } from "@/lib/chain/networks";

interface NetworkDropdownProps {
  chainId: ChainId;
  onChange: (id: ChainId) => void;
  compact?: boolean;
  variant?: "navbar" | "settings";
}

export default function NetworkDropdown({
  chainId,
  onChange,
  compact = false,
  variant = "navbar",
}: NetworkDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trading = isTradingChainId(chainId) ? getTradingNetwork(chainId) : TRADING_CHAIN_LIST[0];
  const active = getChain(trading.id);
  const isSettings = variant === "settings";

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className={isSettings ? "w-full" : "relative"} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          isSettings
            ? "flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            : `flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 hover:border-slate-600 transition-colors cursor-pointer ${
                compact ? "px-3 py-1.5" : "px-3 py-2 w-full"
              }`
        }
        aria-label="Pilih jaringan trading"
        aria-expanded={open}
      >
        <Image
          src={active.logoUrl}
          alt={trading.shortLabel}
          width={18}
          height={18}
          className="rounded-full"
          unoptimized
        />
        <span className={`truncate font-semibold ${isSettings ? "text-slate-800" : active.accentClass}`}>
          {compact && !isSettings ? trading.shortLabel : trading.name}
        </span>
        <span className={`text-[10px] font-mono ${isSettings ? "text-slate-400" : "text-slate-500"}`}>
          {trading.nativeSymbol}
        </span>
        <ChevronDown
          className={`w-3 h-3 ml-auto transition-transform ${open ? "rotate-180" : ""} ${
            isSettings ? "text-slate-400" : "text-slate-400"
          }`}
        />
      </button>

      {open && (
        <div
          className={
            isSettings
              ? "mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-sm py-1"
              : "absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-[60]"
          }
        >
          {TRADING_CHAIN_LIST.map((network) => {
            const chain = getChain(network.id);
            const selected = network.id === chainId;
            return (
              <button
                key={network.id}
                type="button"
                onClick={() => {
                  onChange(network.id as TradingChainId);
                  setOpen(false);
                }}
                className={
                  isSettings
                    ? `w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                        selected ? "bg-slate-50" : ""
                      }`
                    : `w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-slate-800 transition-colors cursor-pointer ${
                        selected ? "bg-slate-800/80" : ""
                      }`
                }
              >
                <Image
                  src={chain.logoUrl}
                  alt={network.shortLabel}
                  width={22}
                  height={22}
                  className="rounded-full shrink-0"
                  unoptimized
                />
                <div className="min-w-0 flex-1">
                  <span
                    className={`block text-xs font-semibold truncate ${
                      isSettings ? "text-slate-800" : chain.accentClass
                    }`}
                  >
                    {network.name}
                  </span>
                  <span
                    className={`block text-[10px] font-mono truncate ${
                      isSettings ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Chain {network.chainId} · {network.nativeSymbol} · {network.pairs.length} pair
                  </span>
                </div>
                {selected ? (
                  <Check className={`w-4 h-4 shrink-0 ${isSettings ? "text-emerald-500" : "text-emerald-400"}`} />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
