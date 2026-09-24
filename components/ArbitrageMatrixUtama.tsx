"use client";

import {
  Check,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import TokenPairSelector from "@/components/TokenPairSelector";
import ArbitrageMatrixTable from "@/components/ArbitrageMatrixTable";
import PairScanModeToggle from "@/components/tier/PairScanModeToggle";
import { useTier, type ProScanMode } from "@/context/TierContext";
import { useNetwork } from "@/context/NetworkContext";
import { useBotConfig } from "@/context/BotConfigContext";
import { formatBps } from "@/lib/bot/dexMath";
import { formatUsdPrice } from "@/lib/bot/pricing";
import { dexLabelsForChain } from "@/lib/bot/constants";
import {
  activeFlashLoanProviderId,
  getFlashLoanPlatform,
  mergeFlashLoanPlatforms,
} from "@/lib/bot/flashLoanProviders";
import type { Opportunity } from "@/lib/bot/types";
import type { TokenPairConfig } from "@/lib/chain/tokenPairs";
import { useMemo } from "react";

export type ButtonPhase = "idle" | "loading" | "success" | "error";

interface ArbitrageMatrixUtamaProps {
  opportunities: Opportunity[];
  scanPhase: ButtonPhase;
  simulatePhase: ButtonPhase;
  simulateHint?: string;
  liveBlock: number;
  scanPaceMs?: number;
  chainLabel: string;
  selectedPair: TokenPairConfig;
  availablePairs: TokenPairConfig[];
  minSpreadPct?: number;
  onSelectPair: (id: string) => void;
  onScan: () => void;
  onSimulate: () => void;
  proBadge?: boolean;
  proScanMode?: ProScanMode;
  onProScanModeChange?: (mode: ProScanMode) => void;
  scannerEnabled?: boolean;
  sandboxMode?: boolean;
}

export default function ArbitrageMatrixUtama({
  opportunities,
  scanPhase,
  simulatePhase,
  simulateHint,
  liveBlock,
  scanPaceMs,
  chainLabel,
  selectedPair,
  availablePairs,
  onSelectPair,
  onScan,
  onSimulate,
  proBadge,
  minSpreadPct = 0.5,
  proScanMode = "full",
  onProScanModeChange,
  scannerEnabled = false,
  sandboxMode = false,
}: ArbitrageMatrixUtamaProps) {
  const { chainId } = useNetwork();
  const { config: botConfig } = useBotConfig();
  const { proScanMode: tierScanMode, setProScanMode } = useTier();
  const scanMode = proScanMode ?? tierScanMode;
  const changeScanMode = onProScanModeChange ?? setProScanMode;
  const flashActive = useMemo(() => {
    const platforms = mergeFlashLoanPlatforms(botConfig.flashLoanPlatforms);
    const id = activeFlashLoanProviderId(platforms);
    if (!id) return null;
    return getFlashLoanPlatform(id).label;
  }, [botConfig.flashLoanPlatforms]);
  const ready = opportunities.filter((item) => item.status === "ready");
  const topSpread = ready.reduce((max, item) => Math.max(max, item.spreadBps), 0);
  const liveRows = opportunities.some((item) => item.live);
  const busy = scanPhase === "loading" || simulatePhase === "loading";
  const priced =
    opportunities.find((item) => item.pairId === selectedPair.id && item.priceDexAUsd && item.priceDexBUsd) ??
    opportunities.find((item) => item.priceDexAUsd && item.priceDexBUsd);
  const solanaDexHint =
    chainId === "solana"
      ? "Raydium · Orca Whirlpool · Meteora DLMM"
      : dexLabelsForChain(chainId)
          .split(" / ")
          .filter(Boolean)
          .slice(0, 3)
          .join(" · ");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
            <h2 className="text-lg font-bold tracking-wide">Live Arbitrage Matrix</h2>
            {proBadge ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border text-amber-300 border-amber-500/40 bg-amber-500/10">
                Pro · Automated
              </span>
            ) : null}
            {sandboxMode && proBadge ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border text-cyan-300 border-cyan-500/40 bg-cyan-500/10">
                Runtime · {scanPaceMs ?? 1000} ms
              </span>
            ) : null}
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                liveRows
                  ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                  : "text-slate-400 border-slate-700"
              }`}
            >
              {sandboxMode
                ? `${selectedPair.label} · harga simulasi`
                : liveRows
                  ? `${selectedPair.label} on-chain`
                  : "menunggu pool valid"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {chainLabel} · {selectedPair.label} · {chainId === "solana" ? "Slot" : "Blok"} #
            {liveBlock || "—"}
            {sandboxMode && proBadge
              ? " · feed mock tiap 3 dtk · spread ≥0.5%/5 mnt · ≥1%/10 mnt"
              : ""}
          </p>
          <p className="text-[10px] font-mono text-slate-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
            <span>
              Scan:{" "}
              <span className={scanMode === "full" ? "text-violet-300" : "text-amber-300"}>
                {scanMode === "full" ? "Full pair Scan" : "Single aktif"}
              </span>
            </span>
            <span>·</span>
            <span>
              FlashLoan:{" "}
              <span className={flashActive ? "text-emerald-300" : "text-slate-500"}>
                {flashActive ? `${flashActive} (eksklusif)` : "Siaga · semua OFF"}
              </span>
            </span>
            {chainId === "solana" ? (
              <>
                <span>·</span>
                <span className="text-sky-300/80">{solanaDexHint}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2">
          <PairScanModeToggle
            mode={scanMode}
            onChange={changeScanMode}
            pairCount={availablePairs.length}
          />
          <div className="flex gap-2">
          <button
            type="button"
            onClick={onScan}
            disabled={busy}
            className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-lg disabled:opacity-50 cursor-pointer ${
              scanPhase === "success"
                ? "bg-emerald-400 text-slate-950 shadow-emerald-400/20"
                : sandboxMode && proBadge
                  ? "bg-slate-800 border border-cyan-500/30 text-cyan-200 shadow-none hover:bg-slate-700"
                  : "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-amber-400/10 hover:from-amber-300 hover:to-yellow-200"
            }`}
          >
            {scanPhase === "loading" ? (
              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
            ) : scanPhase === "success" ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <RefreshCw className={`w-3.5 h-3.5 ${sandboxMode && proBadge ? "opacity-70" : ""}`} />
            )}
            {scanPhase === "loading"
              ? "Menghitung..."
              : scanPhase === "success"
                ? "Matrix terbarui"
                : sandboxMode && proBadge
                  ? "Refresh manual"
                  : "Scan Ulang Matrix"}
          </button>
          <button
            type="button"
            onClick={onSimulate}
            disabled={busy}
            className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center gap-2 border transition-all cursor-pointer disabled:opacity-40 ${
              simulatePhase === "success"
                ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                : simulatePhase === "error"
                  ? "bg-red-500/15 border-red-400/60 text-red-300"
                  : "bg-slate-800 border-emerald-500/40 text-emerald-300 hover:bg-slate-700"
            }`}
          >
            {simulatePhase === "loading" ? (
              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
            ) : simulatePhase === "success" ? (
              <Check className="w-3.5 h-3.5" />
            ) : null}
            {simulatePhase === "loading"
              ? "Menyimulasikan..."
              : simulatePhase === "success"
                ? "Simulasi lolos"
                : simulatePhase === "error"
                  ? "Simulasi gagal"
                  : "Simulasi eth_call"}
          </button>
          </div>
        </div>
      </div>

      <TokenPairSelector
        pairs={availablePairs}
        selectedId={selectedPair.id}
        onSelect={onSelectPair}
        networkLabel={chainLabel}
      />

      {scanMode === "full" ? (
        <p className="text-[10px] font-mono text-violet-400/90 bg-violet-500/5 border border-violet-500/20 rounded-lg px-3 py-1.5">
          Full pair Scan aktif — memindai {availablePairs.length} pasangan
          {chainId === "solana"
            ? ` · semua venue (${solanaDexHint}) tanpa skip ketat`
            : ""}{" "}
          setiap siklus. FlashLoan tetap 1 provider eksklusif.
        </p>
      ) : (
        <p className="text-[10px] font-mono text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-1.5">
          Single aktif — hanya {selectedPair.label} (hemat kuota). Pilih pasangan di bawah untuk
          ganti target. FlashLoan: maks satu provider ON.
        </p>
      )}

      {simulateHint ? (
        <p className="text-[11px] font-mono text-slate-400">{simulateHint}</p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Spread Tertinggi</span>
            <span className="text-base font-bold text-emerald-400 font-mono">
              {ready.length ? formatBps(topSpread) : "—"}
            </span>
          </div>
        </div>
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              {sandboxMode ? "Price DEX A / B" : "Peluang siap"}
            </span>
            <span className="text-base font-bold text-amber-400 font-mono">
              {sandboxMode
                ? `${formatUsdPrice(priced?.priceDexAUsd)} · ${formatUsdPrice(priced?.priceDexBUsd)}`
                : ready.length}
            </span>
          </div>
        </div>
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              {sandboxMode ? "Peluang siap" : "Filter profit"}
            </span>
            <span className="text-base font-bold text-blue-400 font-mono">
              {sandboxMode ? ready.length : "Revert jika rugi"}
            </span>
          </div>
        </div>
      </div>

      <ArbitrageMatrixTable
        opportunities={opportunities}
        selectedPair={selectedPair}
        availablePairs={availablePairs}
        scanMode={scanMode}
        onSelectPair={onSelectPair}
        minSpreadPct={minSpreadPct}
        showExecute={false}
        rowsToggle
        scanning={scanPhase === "loading" || scannerEnabled}
        sandboxMode={sandboxMode}
      />

      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          {scanMode === "full"
            ? `Full pair Scan · ${availablePairs.length} pair · ${dexLabelsForChain(chainId)} di ${chainLabel}`
            : `Single aktif · ${selectedPair.label} · ${dexLabelsForChain(chainId)} di ${chainLabel}`}
        </span>
        <span className="text-amber-400 flex items-center gap-1">
          AtomicFlashArb.sol
          <ExternalLink className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}
