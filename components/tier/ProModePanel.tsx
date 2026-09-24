"use client";

import type { ReactNode } from "react";
import ArbitrageMatrixUtama, { type ButtonPhase } from "@/components/ArbitrageMatrixUtama";
import BotTerminalLog from "@/components/tier/BotTerminalLog";
import ScannerToggle from "@/components/tier/ScannerToggle";
import ScanOnlyModeToggle from "@/components/tier/ScanOnlyModeToggle";
import ScanOnlyPnLDashboard from "@/components/tier/ScanOnlyPnLDashboard";
import type { ScanOnlyReport } from "@/lib/scanOnly/types";
import type { ProScanMode } from "@/context/TierContext";
import type { Opportunity } from "@/lib/bot/types";
import type { TokenPairConfig } from "@/lib/chain/tokenPairs";
import type { TerminalEntry } from "@/hooks/useBotTerminal";

interface ProModePanelProps {
  opportunities: Opportunity[];
  scanPhase: ButtonPhase;
  simulatePhase: ButtonPhase;
  simulateHint?: string;
  liveBlock: number;
  scanPaceMs?: number;
  chainLabel: string;
  selectedPair: TokenPairConfig;
  availablePairs: TokenPairConfig[];
  scannerEnabled: boolean;
  killed: boolean;
  terminalEntries: TerminalEntry[];
  analytics?: ReactNode;
  scanOnly?: boolean;
  scanOnlyReport?: ScanOnlyReport | null;
  scanOnlyBusy?: boolean;
  minSpreadPct?: number;
  proScanMode?: ProScanMode;
  onProScanModeChange?: (mode: ProScanMode) => void;
  onScannerChange: (enabled: boolean) => void;
  onSelectPair: (id: string) => void;
  onScan: () => void;
  onSimulate: () => void;
  onClearTerminal: () => void;
  sandboxMode?: boolean;
}

export default function ProModePanel({
  opportunities,
  scanPhase,
  simulatePhase,
  simulateHint,
  liveBlock,
  scanPaceMs,
  chainLabel,
  selectedPair,
  availablePairs,
  scannerEnabled,
  killed,
  terminalEntries,
  analytics,
  scanOnly = false,
  scanOnlyReport = null,
  scanOnlyBusy = false,
  minSpreadPct = 0.5,
  proScanMode = "full",
  onProScanModeChange,
  onScannerChange,
  onSelectPair,
  onScan,
  onSimulate,
  onClearTerminal,
  sandboxMode = false,
}: ProModePanelProps) {
  return (
    <div className="space-y-5 w-full">
      <ArbitrageMatrixUtama
        opportunities={opportunities}
        scanPhase={scanPhase}
        simulatePhase={simulatePhase}
        simulateHint={simulateHint}
        liveBlock={liveBlock}
        scanPaceMs={scanPaceMs}
        chainLabel={chainLabel}
        selectedPair={selectedPair}
        availablePairs={availablePairs}
        onSelectPair={onSelectPair}
        onScan={onScan}
        onSimulate={onSimulate}
        proBadge
        minSpreadPct={minSpreadPct}
        proScanMode={proScanMode}
        onProScanModeChange={onProScanModeChange}
        scannerEnabled={scannerEnabled}
        sandboxMode={sandboxMode}
      />

      {scanOnly ? (
        <ScanOnlyPnLDashboard report={scanOnlyReport} scanning={scanOnlyBusy} />
      ) : (
        analytics
      )}

      <ScanOnlyModeToggle />

      <ScannerToggle
        enabled={scannerEnabled}
        onChange={onScannerChange}
        disabled={killed}
        sandboxMode={sandboxMode}
        scanPaceMs={scanPaceMs}
      />

      <BotTerminalLog
        entries={terminalEntries}
        scannerEnabled={(scannerEnabled || Boolean(sandboxMode)) && !killed}
        onClear={onClearTerminal}
        emptyHint={
          scanOnly
            ? "SCAN_ONLY · menunggu tick blok untuk matriks 10 pair (tanpa tx)."
            : sandboxMode
            ? "Runtime Testnet Pro · menunggu tick harga 3 detik…"
            : undefined
        }
      />
    </div>
  );
}
