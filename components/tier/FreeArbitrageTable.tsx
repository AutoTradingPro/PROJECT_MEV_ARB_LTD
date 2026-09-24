"use client";

import ArbitrageMatrixTable from "@/components/ArbitrageMatrixTable";
import type { ProScanMode } from "@/context/TierContext";
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import type { TokenPairConfig } from "@/lib/chain/tokenPairs";

interface FreeArbitrageTableProps {
  opportunities: Opportunity[];
  selectedPair: TokenPairConfig;
  availablePairs: TokenPairConfig[];
  scanMode?: ProScanMode;
  config: BotConfig;
  executingId: string | null;
  walletConnected: boolean;
  sandboxMode?: boolean;
  scanOnly?: boolean;
  onExecute: (opp: Opportunity, config: BotConfig) => void;
  onSelectPair: (id: string) => void;
}

export default function FreeArbitrageTable(props: FreeArbitrageTableProps) {
  return (
    <ArbitrageMatrixTable
      opportunities={props.opportunities}
      selectedPair={props.selectedPair}
      availablePairs={props.availablePairs}
      scanMode={props.scanMode}
      onSelectPair={props.onSelectPair}
      minSpreadPct={props.config.minSpreadPct}
      executingId={props.executingId}
      walletConnected={props.walletConnected}
      sandboxMode={props.sandboxMode}
      showExecute={!props.scanOnly}
      config={props.config}
      onExecute={props.onExecute}
      rowsToggle
    />
  );
}
