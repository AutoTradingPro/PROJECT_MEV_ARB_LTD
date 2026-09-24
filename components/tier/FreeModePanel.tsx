"use client";

import { Zap } from "lucide-react";
import TokenPairSelector from "@/components/TokenPairSelector";
import BotTerminalLog from "@/components/tier/BotTerminalLog";
import FreeArbitrageTable from "@/components/tier/FreeArbitrageTable";
import PairScanModeToggle from "@/components/tier/PairScanModeToggle";
import ScanOnlyModeToggle from "@/components/tier/ScanOnlyModeToggle";
import ScanOnlyPnLDashboard from "@/components/tier/ScanOnlyPnLDashboard";
import { useTier, type ProScanMode } from "@/context/TierContext";
import type { TerminalEntry } from "@/hooks/useBotTerminal";
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import type { TokenPairConfig } from "@/lib/chain/tokenPairs";
import type { ReactNode } from "react";
import type { ScanOnlyReport } from "@/lib/scanOnly/types";

interface FreeModePanelProps {
  opportunities: Opportunity[];
  config: BotConfig;
  liveBlock: number;
  chainLabel: string;
  selectedPair: TokenPairConfig;
  availablePairs: TokenPairConfig[];
  executingId: string | null;
  walletConnected: boolean;
  sandboxMode?: boolean;
  terminalEntries: TerminalEntry[];
  analytics?: ReactNode;
  scanOnly?: boolean;
  scanOnlyReport?: ScanOnlyReport | null;
  scanOnlyBusy?: boolean;
  proScanMode?: ProScanMode;
  onProScanModeChange?: (mode: ProScanMode) => void;
  onSelectPair: (id: string) => void;
  onExecute: (opp: Opportunity, config: BotConfig) => void;
  onClearTerminal: () => void;
}

export default function FreeModePanel({
  opportunities,
  config,
  liveBlock,
  chainLabel,
  selectedPair,
  availablePairs,
  executingId,
  walletConnected,
  sandboxMode = false,
  terminalEntries,
  analytics,
  scanOnly = false,
  scanOnlyReport = null,
  scanOnlyBusy = false,
  proScanMode,
  onProScanModeChange,
  onSelectPair,
  onExecute,
  onClearTerminal,
}: FreeModePanelProps) {
  const { proScanMode: tierScanMode, setProScanMode } = useTier();
  const scanMode = proScanMode ?? tierScanMode;
  const changeScanMode = onProScanModeChange ?? setProScanMode;
  const readyCount = opportunities.filter((o) => o.status === "ready").length;

  return (
    <div className="theme-panel rounded-2xl p-6 shadow-xl space-y-5 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Zap className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold tracking-wide">Live Arbitrage Matrix</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border text-emerald-300 border-emerald-500/40 bg-emerald-500/10">
              Free · Manual
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {chainLabel} · Blok #{liveBlock || "—"} · {readyCount} siap dieksekusi
          </p>
        </div>
        <PairScanModeToggle
          mode={scanMode}
          onChange={changeScanMode}
          pairCount={availablePairs.length}
        />
      </div>

      <TokenPairSelector
        pairs={availablePairs}
        selectedId={selectedPair.id}
        onSelect={onSelectPair}
        networkLabel={chainLabel}
      />

      {scanMode === "full" ? (
        <p className="text-[10px] font-mono text-violet-400/90 bg-violet-500/5 border border-violet-500/20 rounded-lg px-3 py-1.5">
          Full pair Scan aktif — memindai {availablePairs.length} pasangan setiap siklus. FlashLoan:
          satu provider eksklusif.
        </p>
      ) : (
        <p className="text-[10px] font-mono text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-1.5">
          Single aktif — hanya {selectedPair.label} (hemat kuota). FlashLoan: maks satu provider ON.
        </p>
      )}

      <FreeArbitrageTable
        opportunities={opportunities}
        selectedPair={selectedPair}
        availablePairs={availablePairs}
        scanMode={scanMode}
        config={config}
        executingId={executingId}
        walletConnected={walletConnected}
        sandboxMode={sandboxMode}
        scanOnly={scanOnly}
        onExecute={onExecute}
        onSelectPair={onSelectPair}
      />

      <p className="text-[11px] text-slate-500 font-mono">
        EXECUTE memakai rute pada baris yang dipilih.
        {sandboxMode
          ? " Mode Testnet menghasilkan Mock Tx Hash instan tanpa saldo dompet atau likuiditas on-chain."
          : scanOnly
            ? " SCAN_ONLY aktif — tombol Execute ditahan sampai mode Execute dinyalakan."
            : " Hash on-chain dan tautan BSCScan tampil di terminal di bawah serta notifikasi pojok setelah MetaMask mengirim transaksi."}
      </p>

      {scanOnly ? (
        <ScanOnlyPnLDashboard report={scanOnlyReport} scanning={scanOnlyBusy} />
      ) : (
        analytics
      )}

      <ScanOnlyModeToggle />

      <BotTerminalLog
        entries={terminalEntries}
        scannerEnabled={false}
        onClear={onClearTerminal}
        emptyHint={
          scanOnly
            ? "SCAN_ONLY · tekan Scan Matrix atau biarkan siklus blok mengisi tabel kelayakan."
            : sandboxMode
            ? "Tekan Execute di Testnet (Sandbox) untuk Mock Tx Hash dan penambahan vault fiktif."
            : "Tekan Execute untuk mengirim transaksi. Hash on-chain dan tautan BSCScan akan muncul di sini."
        }
      />
    </div>
  );
}
