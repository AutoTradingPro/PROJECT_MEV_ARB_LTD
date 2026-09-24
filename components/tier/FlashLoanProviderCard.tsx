"use client";

import { useEffect, useMemo } from "react";
import { Landmark } from "lucide-react";
import { useBotConfig } from "@/context/BotConfigContext";
import { useNetwork } from "@/context/NetworkContext";
import { useWallet } from "@/context/WalletContext";
import { isTradingChainId } from "@/config/networks";
import {
  FLASH_LOAN_PLATFORMS,
  activeFlashLoanProviderId,
  disableAllFlashLoanPlatforms,
  exclusiveEnablePlatform,
  getFlashLoanPlatform,
  mergeFlashLoanPlatforms,
  platformSupportsBsc,
  platformSupportsChain,
  preferredChainForPlatform,
  resolveFlashLoanFeePct,
  syncFlashLoanPlatformsToChain,
  type FlashLoanPlatformMeta,
} from "@/lib/bot/flashLoanProviders";
import { formatPct } from "@/lib/bot/configUnits";
import { defaultDexIdsForChain } from "@/lib/bot/dexRegistry";
import { defaultPairForChain } from "@/lib/chain/tokenPairs";
import { isOwnerNodeChainId } from "@/lib/owner/ownerNodeChains";
import type { BotConfig, FlashLoanProviderId } from "@/lib/bot/types";

interface FlashLoanProviderCardProps {
  config: BotConfig;
  onChange: (config: BotConfig) => void;
  livePoolFeePct?: number | null;
  livePairLabel?: string;
}

function liquidityClass(level: FlashLoanPlatformMeta["liquidity"]): string {
  if (level === "Very High") return "text-emerald-300";
  if (level === "High") return "text-sky-300";
  return "text-amber-300";
}

/** Radio-style: maks satu provider ON. Klik ulang yang aktif → semua OFF (siaga). */
function ProviderRadio({
  selected,
  onSelect,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
        selected ? "bg-emerald-500" : "bg-slate-700 hover:bg-slate-600"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          selected ? "translate-x-5" : "translate-x-0"
        }`}
      />
      <span className="sr-only">{selected ? "SELECTED" : "OFF"}</span>
    </button>
  );
}

export default function FlashLoanProviderCard({
  config,
  onChange,
}: FlashLoanProviderCardProps) {
  const { setConfig } = useBotConfig();
  const { activeNetwork, chainId, setChainId } = useNetwork();
  const { ensureWalletChain } = useWallet();
  const platforms = mergeFlashLoanPlatforms(config.flashLoanPlatforms);

  const emit = (next: BotConfig) => {
    setConfig(next);
    onChange(next);
  };

  const activeProviderId = useMemo(
    () => activeFlashLoanProviderId(platforms),
    [platforms]
  );

  /** Samakan field chain provider dengan jaringan scanner aktif (tanpa menyentuh Overview RPC/WSS). */
  useEffect(() => {
    if (!activeProviderId) return;
    const meta = getFlashLoanPlatform(activeProviderId);
    const fromPlatform = platforms[activeProviderId]?.chain;
    const bindTarget =
      isOwnerNodeChainId(chainId) && platformSupportsChain(meta, chainId)
        ? chainId
        : isOwnerNodeChainId(fromPlatform)
          ? fromPlatform
          : null;
    if (!bindTarget) return;
    const currentChain = platforms[activeProviderId]?.chain;
    if (currentChain === bindTarget) return;
    setConfig({
      ...config,
      chainId: bindTarget,
      flashLoanPlatforms: {
        ...platforms,
        [activeProviderId]: { ...platforms[activeProviderId], chain: bindTarget },
      },
    });
  }, [activeProviderId, chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolved = useMemo(
    () =>
      resolveFlashLoanFeePct(
        platforms,
        activeProviderId ?? config.flashLoanProvider
      ),
    [platforms, activeProviderId, config.flashLoanProvider]
  );

  const clearProviders = () => {
    const nextPlatforms = disableAllFlashLoanPlatforms(platforms);
    console.log("[FLASHLOAN] Mode siaga — semua provider OFF");
    emit({
      ...config,
      flashLoanPlatforms: nextPlatforms,
    });
  };

  const selectProvider = (id: FlashLoanProviderId) => {
    // Klik ulang provider aktif → kembali ke siaga (semua OFF).
    if (platforms[id]?.enabled) {
      clearProviders();
      return;
    }
    const meta = getFlashLoanPlatform(id);
    let targetChain = preferredChainForPlatform(meta, platforms[id]?.chain);
    if (platformSupportsChain(meta, chainId) && isTradingChainId(chainId)) {
      targetChain = chainId;
    } else {
      targetChain = preferredChainForPlatform(meta, platforms[id]?.chain);
    }
    if (!isTradingChainId(targetChain)) {
      targetChain = preferredChainForPlatform(meta) as typeof targetChain;
    }
    if (!isTradingChainId(targetChain)) return;

    let nextPlatforms = exclusiveEnablePlatform(platforms, id, targetChain);
    nextPlatforms = {
      ...syncFlashLoanPlatformsToChain(nextPlatforms, targetChain),
      [id]: { ...nextPlatforms[id], enabled: true, chain: targetChain },
    };

    console.log(
      `[FLASHLOAN] Provider eksklusif → ${meta.label} · jaringan ${targetChain}`
    );
    if (targetChain !== chainId) {
      setChainId(targetChain);
    }
    void ensureWalletChain(targetChain);

    const nextResolved = resolveFlashLoanFeePct(nextPlatforms, id);
    emit({
      ...config,
      chainId: targetChain,
      pairId: defaultPairForChain(targetChain).id,
      activeDexIds: defaultDexIdsForChain(targetChain),
      flashLoanPlatforms: nextPlatforms,
      flashLoanProvider: nextResolved.providerId,
      aaveFeePct: nextResolved.providerId === "aave" ? nextResolved.feePct : config.aaveFeePct,
    });
  };

  const patchPlatformMeta = (
    id: FlashLoanProviderId,
    patch: Partial<(typeof platforms)[FlashLoanProviderId]>
  ) => {
    const meta = getFlashLoanPlatform(id);
    const current = platforms[id];
    const chainTouched = typeof patch.chain === "string";
    const requestedChain = patch.chain ?? current.chain;
    let validChain = preferredChainForPlatform(meta, requestedChain);
    if (
      platforms[id]?.enabled &&
      platformSupportsChain(meta, chainId) &&
      isTradingChainId(chainId) &&
      !chainTouched
    ) {
      validChain = chainId;
    }
    const feeMode =
      patch.feeMode && meta.feeModes?.some((item) => item.id === patch.feeMode)
        ? patch.feeMode
        : current.feeMode ?? meta.feeModes?.[0]?.id;

    let nextPlatforms = {
      ...platforms,
      [id]: { ...current, ...patch, enabled: current.enabled, chain: validChain, feeMode },
    };

    if (chainTouched && current.enabled && isTradingChainId(validChain)) {
      nextPlatforms = exclusiveEnablePlatform(nextPlatforms, id, validChain);
      nextPlatforms = {
        ...syncFlashLoanPlatformsToChain(nextPlatforms, validChain),
        [id]: { ...nextPlatforms[id], enabled: true, chain: validChain },
      };
      if (validChain !== chainId) setChainId(validChain);
      void ensureWalletChain(validChain);
      const nextResolved = resolveFlashLoanFeePct(nextPlatforms, id);
      emit({
        ...config,
        chainId: validChain,
        pairId: defaultPairForChain(validChain).id,
        activeDexIds: defaultDexIdsForChain(validChain),
        flashLoanPlatforms: nextPlatforms,
        flashLoanProvider: nextResolved.providerId,
        aaveFeePct: nextResolved.providerId === "aave" ? nextResolved.feePct : config.aaveFeePct,
      });
      return;
    }

    emit({
      ...config,
      flashLoanPlatforms: nextPlatforms,
      flashLoanProvider: activeProviderId
        ? resolveFlashLoanFeePct(nextPlatforms, activeProviderId).providerId
        : config.flashLoanProvider,
    });
  };

  const standby = activeProviderId == null;
  const activeLabel = activeProviderId
    ? getFlashLoanPlatform(activeProviderId).label
    : "Siaga (tidak ada)";

  return (
    <section
      className="theme-panel w-full rounded-2xl p-4 pb-3 space-y-3"
      role="radiogroup"
      aria-label="FlashLoan Provider"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-violet-300" />
          <h3 className="text-sm font-bold tracking-wide">FlashLoan Provider</h3>
        </div>
        <span
          className={`rounded-md border px-2 py-0.5 text-[10px] font-mono ${
            standby
              ? "border-slate-600 bg-slate-800/80 text-slate-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {standby ? "Siaga · scanner idle" : `Aktif: ${activeLabel}`}
        </span>
      </div>

      <p className="text-[10px] text-slate-500">
        Semua OFF saat masuk. Pilih satu provider (radio eksklusif) untuk mulai scan; klik ulang untuk
        kembali siaga. Mode pair: Single aktif / Full pair Scan di Live Arbitrage Matrix.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
        {FLASH_LOAN_PLATFORMS.map((meta) => {
          const state = platforms[meta.id] ?? {
            enabled: false,
            chain: preferredChainForPlatform(meta),
            feeMode: meta.feeModes?.[0]?.id,
          };
          const on = Boolean(state.enabled);
          const chainValue = platformSupportsChain(meta, chainId)
            ? chainId
            : preferredChainForPlatform(meta, state.chain);
          const feeModeValue =
            meta.feeModes?.some((item) => item.id === state.feeMode)
              ? state.feeMode
              : meta.feeModes?.[0]?.id;
          return (
            <div
              key={meta.id}
              className={`rounded-xl border px-3 py-2.5 space-y-2 transition-colors ${
                on
                  ? "border-emerald-500/45 bg-emerald-500/10 ring-1 ring-emerald-500/25"
                  : "border-slate-800 bg-slate-950/40 opacity-80"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-bold ${on ? "text-emerald-200" : "text-slate-100"}`}>
                      {meta.label}
                    </span>
                    {on ? (
                      <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                        Selected
                      </span>
                    ) : null}
                    <span className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                      Fee {meta.feeLabel}
                    </span>
                    <span className={`text-[10px] font-mono ${liquidityClass(meta.liquidity)}`}>
                      {meta.liquidityLabel ?? meta.liquidity}
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                        meta.id === "kamino"
                          ? "bg-violet-400/15 text-violet-300"
                          : platformSupportsBsc(meta)
                            ? "bg-amber-400/15 text-amber-300"
                            : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {meta.id === "kamino" ? "SOLANA" : platformSupportsBsc(meta) ? "BSC" : "Non-BSC"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{meta.bestFor}</p>
                </div>
                <ProviderRadio
                  selected={on}
                  label={on ? `Nonaktifkan ${meta.label}` : `Pilih ${meta.label}`}
                  onSelect={() => selectProvider(meta.id)}
                />
              </div>

              <div className={`grid gap-2 ${meta.feeModes?.length ? "grid-cols-2" : "grid-cols-1"}`}>
                <label className="block min-w-0">
                  <span className="mb-1 block text-[9px] uppercase tracking-wide text-slate-500">
                    Jaringan
                  </span>
                  <select
                    value={chainValue}
                    aria-label={`Jaringan ${meta.label}`}
                    onChange={(event) =>
                      patchPlatformMeta(meta.id, { chain: event.target.value })
                    }
                    className="w-full rounded-lg theme-input px-2 py-1.5 font-mono text-[11px] focus:outline-none focus:border-violet-400/40"
                  >
                    {meta.chains.map((chain) => (
                      <option key={chain.id} value={chain.id}>
                        {chain.label}
                      </option>
                    ))}
                  </select>
                </label>

                {meta.feeModes?.length ? (
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[9px] uppercase tracking-wide text-slate-500">
                      Mode Fee
                    </span>
                    <select
                      value={feeModeValue}
                      aria-label={`Mode fee ${meta.label}`}
                      disabled={!on}
                      onChange={(event) =>
                        patchPlatformMeta(meta.id, { feeMode: event.target.value })
                      }
                      className="w-full rounded-lg theme-input px-2 py-1.5 font-mono text-[11px] focus:outline-none focus:border-violet-400/40 disabled:opacity-50"
                    >
                      {meta.feeModes.map((mode) => (
                        <option key={mode.id} value={mode.id}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] font-mono text-slate-600">
        {standby
          ? `Mode siaga · pilih FlashLoan Provider untuk mengaktifkan scanner · ${activeNetwork.shortLabel}`
          : `Est. Net Profit memakai ${getFlashLoanPlatform(resolved.providerId).label} · fee ${formatPct(
              resolved.feePct
            )} · likuiditas ${resolved.liquidity} · ${activeNetwork.shortLabel} · ${activeNetwork.nativeSymbol}`}
      </p>
    </section>
  );
}
