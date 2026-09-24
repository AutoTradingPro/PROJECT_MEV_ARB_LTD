"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import ActiveDexPicker from "@/components/tier/ActiveDexPicker";
import { useBotConfig } from "@/context/BotConfigContext";
import { useTier } from "@/context/TierContext";
import { aaveFeePctForTier } from "@/lib/bot/constants";
import { formatPct, formatUsd } from "@/lib/bot/configUnits";
import { proportionalMinProfitAnchorUsd } from "@/lib/bot/adaptiveMinProfit";
import { clampBribePercent, resolveDynamicBribePercent } from "@/lib/bot/dynamicBribe";
import { clampMaxPriceImpactPct, clampMaxSpotSpreadPct, clampMinPoolLiquidityUsd } from "@/lib/bot/poolSafety";
import {
  estimateOperationalNetProfitUsd,
  getFlashLoanPlatform,
  mergeFlashLoanPlatforms,
  resolveFlashLoanFeePct,
} from "@/lib/bot/flashLoanProviders";
import type { BotConfig } from "@/lib/bot/types";

interface OperationalConfigBarProps {
  config: BotConfig;
  onChange: (config: BotConfig) => void;
  busy?: boolean;
  livePoolFeePct?: number | null;
}

function numInput(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export default function OperationalConfigBar({
  onChange,
  busy,
  livePoolFeePct = null,
}: OperationalConfigBarProps) {
  const { isPro } = useTier();
  const { config: liveConfig, setConfig, patchConfig, setLoanAmountUsd } = useBotConfig();
  const [draft, setDraft] = useState<BotConfig>(liveConfig);
  const aaveFeePct = aaveFeePctForTier(isPro);

  useEffect(() => {
    setDraft(liveConfig);
  }, [liveConfig]);

  const emitChange = useCallback(
    (next: BotConfig) => {
      const platforms = mergeFlashLoanPlatforms(next.flashLoanPlatforms);
      const resolved = resolveFlashLoanFeePct(platforms, next.flashLoanProvider, {
        aaveFeePct,
        uniswapPoolFeePct: livePoolFeePct ?? undefined,
      });
      const locked: BotConfig = {
        ...next,
        flashLoanPlatforms: platforms,
        flashLoanProvider: resolved.providerId,
        aaveFeePct: resolved.feePct,
      };
      setDraft(locked);
      setConfig(locked);
      onChange(locked);
    },
    [onChange, aaveFeePct, setConfig, livePoolFeePct]
  );

  useEffect(() => {
    const platforms = mergeFlashLoanPlatforms(liveConfig.flashLoanPlatforms);
    const resolved = resolveFlashLoanFeePct(platforms, liveConfig.flashLoanProvider, {
      aaveFeePct,
      uniswapPoolFeePct: livePoolFeePct ?? undefined,
    });
    if (
      liveConfig.aaveFeePct === resolved.feePct &&
      liveConfig.flashLoanProvider === resolved.providerId
    ) {
      return;
    }
    patchConfig({
      flashLoanPlatforms: platforms,
      flashLoanProvider: resolved.providerId,
      aaveFeePct: resolved.feePct,
    });
  }, [aaveFeePct, liveConfig.flashLoanPlatforms, liveConfig.flashLoanProvider, livePoolFeePct, patchConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedFee = useMemo(() => {
    const platforms = mergeFlashLoanPlatforms(liveConfig.flashLoanPlatforms);
    return resolveFlashLoanFeePct(platforms, liveConfig.flashLoanProvider, {
      aaveFeePct,
      uniswapPoolFeePct: livePoolFeePct ?? undefined,
    });
  }, [liveConfig.flashLoanPlatforms, liveConfig.flashLoanProvider, aaveFeePct, livePoolFeePct]);
  const feePct = resolvedFee.feePct;
  const feeProvider = getFlashLoanPlatform(resolvedFee.providerId);

  const bribePct = resolveDynamicBribePercent(draft);
  const estNet = useMemo(
    () =>
      estimateOperationalNetProfitUsd({
        loanAmountUsd: liveConfig.loanAmountUsd,
        minSpreadPct: draft.minSpreadPct,
        minerTipPct: bribePct,
        flashFeePct: feePct,
      }),
    [liveConfig.loanAmountUsd, draft.minSpreadPct, bribePct, feePct]
  );

  const fields: {
    key: keyof Pick<
      BotConfig,
      | "loanAmountUsd"
      | "dynamicBribePercent"
      | "minSpreadPct"
      | "maxSpotSpreadPct"
      | "minPoolLiquidityUsd"
      | "maxPriceImpactPct"
    >;
    label: string;
    suffix?: string;
    prefix?: string;
    step?: number;
  }[] = [
    { key: "loanAmountUsd", label: "Jumlah Pinjaman (Loan Amount)", prefix: "$", step: 100 },
    { key: "minPoolLiquidityUsd", label: "Min Pool Liquidity USD", prefix: "$", step: 1000 },
    { key: "dynamicBribePercent", label: "Dynamic Profit Sharing Bribe %", suffix: "%", step: 0.1 },
    { key: "minSpreadPct", label: "Minimum Spread %", suffix: "%", step: 0.01 },
    { key: "maxSpotSpreadPct", label: "Max Allowable Spread %", suffix: "%", step: 0.1 },
    { key: "maxPriceImpactPct", label: "Max Price Impact %", suffix: "%", step: 0.05 },
  ];

  return (
    <section className="theme-panel w-full rounded-2xl p-4 pb-3 space-y-2.5">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 shrink-0 text-amber-400" />
            <h3 className="text-sm font-bold tracking-wide">Konfigurasi Operasional</h3>
            {busy ? (
              <span className="text-[10px] font-mono text-emerald-400 animate-pulse">
                Memindai ulang…
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-500">Live · otomatis tersimpan</span>
            )}
          </div>
          <p className="truncate text-[10px] font-mono text-sky-400/90">
            <span className="font-bold uppercase tracking-wide text-sky-300/80">Auto Mode</span>
            {" · "}
            Min Profit: loan × 0.05% ({formatUsd(proportionalMinProfitAnchorUsd(liveConfig.loanAmountUsd))}) · Slippage: fleksibel (0.5%–1.0%)
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2.5 rounded-xl border border-amber-400/25 bg-slate-950/40 px-2.5 py-1.5">
          <div className="text-right leading-tight">
            <span className="block text-[9px] uppercase tracking-wide text-slate-500">
              Bundle Execution
            </span>
            <span
              className={`text-[11px] font-bold ${
                liveConfig.useBundle ? "text-amber-300" : "text-slate-400"
              }`}
            >
              {liveConfig.useBundle ? "Private Bundle" : "Standard Queue"}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={liveConfig.useBundle}
            aria-label="Bundle Execution"
            onClick={() =>
              emitChange({
                ...draft,
                useBundle: !liveConfig.useBundle,
              })
            }
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
              liveConfig.useBundle ? "bg-amber-400" : "bg-slate-600"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                liveConfig.useBundle ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3">
        {fields.map(({ key, label, prefix, suffix, step }) => (
          <label key={key} className="block min-w-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1 truncate">
              {label}
            </span>
            <div className="relative">
              {prefix ? (
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                  {prefix}
                </span>
              ) : null}
              <input
                type="number"
                min={0}
                max={
                  key === "dynamicBribePercent"
                    ? 50
                    : key === "maxPriceImpactPct"
                      ? 15
                      : key === "maxSpotSpreadPct"
                        ? 25
                        : undefined
                }
                step={step ?? 0.01}
                value={
                  key === "loanAmountUsd"
                    ? liveConfig.loanAmountUsd
                    : key === "dynamicBribePercent"
                      ? resolveDynamicBribePercent(draft)
                      : key === "maxSpotSpreadPct"
                        ? clampMaxSpotSpreadPct(draft.maxSpotSpreadPct)
                        : draft[key]
                }
                onChange={(e) => {
                  const parsed = numInput(Number(e.target.value), Number(draft[key] ?? 0));
                  if (key === "loanAmountUsd") {
                    setLoanAmountUsd(parsed);
                    onChange({
                      ...liveConfig,
                      ...draft,
                      loanAmountUsd: parsed,
                      aaveFeePct: liveConfig.aaveFeePct,
                    });
                    return;
                  }
                  if (key === "dynamicBribePercent") {
                    const bribe = clampBribePercent(parsed);
                    emitChange({
                      ...draft,
                      dynamicBribePercent: bribe,
                      minerTipPct: bribe,
                    });
                    return;
                  }
                  if (key === "minPoolLiquidityUsd") {
                    emitChange({
                      ...draft,
                      minPoolLiquidityUsd: clampMinPoolLiquidityUsd(parsed),
                    });
                    return;
                  }
                  if (key === "maxPriceImpactPct") {
                    emitChange({
                      ...draft,
                      maxPriceImpactPct: clampMaxPriceImpactPct(parsed),
                    });
                    return;
                  }
                  if (key === "maxSpotSpreadPct") {
                    emitChange({
                      ...draft,
                      maxSpotSpreadPct: clampMaxSpotSpreadPct(parsed),
                    });
                    return;
                  }
                  emitChange({
                    ...draft,
                    [key]: parsed,
                  });
                }}
                className={`w-full theme-input rounded-lg py-2 font-mono text-sm focus:outline-none focus:border-amber-400/40 ${
                  prefix ? "pl-6 pr-2" : suffix ? "pl-2 pr-6" : "px-2"
                }`}
              />
              {suffix ? (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                  {suffix}
                </span>
              ) : null}
            </div>
            {key === "loanAmountUsd" ? (
              <span className="mt-1 block text-[9px] font-mono text-slate-600 truncate">
                Nominal USDT · pinjaman kilat
              </span>
            ) : null}
            {key === "minPoolLiquidityUsd" ? (
              <span className="mt-1 block text-[9px] font-mono text-slate-600 truncate">
                Filter global: skip scan+log jika liq min pair &lt; nilai · 0 = bypass · default $100k
              </span>
            ) : null}
            {key === "minSpreadPct" ? (
              <span className="mt-1 block text-[9px] font-mono text-slate-600 truncate">
                SCAN_ONLY: di bawah ini → Skip
              </span>
            ) : null}
            {key === "maxSpotSpreadPct" ? (
              <span className="mt-1 block text-[9px] font-mono text-slate-600 truncate">
                SCAN_ONLY: di atas ini → Skip (glitch V3/V2)
              </span>
            ) : null}
            {key === "dynamicBribePercent" ? (
              <span className="mt-1 block text-[9px] font-mono text-slate-600 truncate">
                SCAN_ONLY: potong Gross untuk Est. Net
              </span>
            ) : null}
            {key === "maxPriceImpactPct" ? (
              <span className="mt-1 block text-[9px] font-mono text-slate-600 truncate">
                SCAN_ONLY: impact Max Safe Loan di atas ini → Skip
              </span>
            ) : null}
          </label>
        ))}

        <div className="block min-w-0">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1 truncate">
            Est. Net Profit
          </span>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
              $
            </span>
            <input
              readOnly
              tabIndex={-1}
              value={estNet.toFixed(2)}
              className={`w-full theme-input rounded-lg py-2 pl-6 pr-2 font-mono text-sm cursor-default ${
                estNet >= 0 ? "text-emerald-300" : "text-red-300"
              }`}
            />
          </div>
          <span className="mt-1 block text-[9px] font-mono text-slate-600 truncate">
            Spread − slip − fee {formatPct(feePct)} ({feeProvider.label}
            {feeProvider.autoDetectFee ? " auto" : ""}) − bribe · {resolvedFee.liquidity}
          </span>
        </div>
      </div>

      <p className="text-[10px] font-mono text-slate-600">
        Loan {formatUsd(liveConfig.loanAmountUsd)} USDT · Spread ≥ {formatPct(draft.minSpreadPct)} ·
        Liq ≥ {formatUsd(draft.minPoolLiquidityUsd ?? 100000)} · Slippage 0.5%–1.0% · Min profit{" "}
        {liveConfig.chainId === "solana" ? "max(loan×0.10%,$5)" : "max(loan×0.60%,costFloor)"} · Dynamic Profit Sharing Bribe{" "}
        {formatPct(resolveDynamicBribePercent(draft))} · Flash fee {formatPct(feePct)} (
        {feeProvider.label}
        {feeProvider.autoDetectFee ? " · auto-detect" : ""} · {resolvedFee.liquidity}) · Est. net{" "}
        {formatUsd(estNet)} · {liveConfig.useBundle ? "Private Bundle" : "Standard Queue"}
      </p>

      <div className="mt-0">
        <ActiveDexPicker config={liveConfig} onChange={emitChange} compact />
      </div>
    </section>
  );
}
