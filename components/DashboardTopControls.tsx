"use client";

import ResultWithdrawCard from "@/components/ResultWithdrawCard";
import FlashloanArbSimulationCard from "@/components/FlashloanArbSimulationCard";
import FlashLoanProviderCard from "@/components/tier/FlashLoanProviderCard";
import OperationalConfigBar from "@/components/tier/OperationalConfigBar";
import type { BotConfig } from "@/lib/bot/types";

interface DashboardTopControlsProps {
  config: BotConfig;
  onConfigChange: (config: BotConfig) => void;
  configBusy?: boolean;
  isPro: boolean;
  killed: boolean;
  running: boolean;
  switchBusy: boolean;
  pendingSwitch: "kill" | "resume" | "withdraw" | null;
  todayProfitUsd: number;
  healthFactor?: number;
  sandbox?: boolean;
  vaultUsd?: number;
  livePoolFeePct?: number | null;
  livePairLabel?: string;
  onKill: () => void;
  onWithdraw: (withdrawPct: number) => void;
}

export default function DashboardTopControls({
  config,
  onConfigChange,
  configBusy,
  isPro,
  killed,
  running,
  switchBusy,
  pendingSwitch,
  todayProfitUsd,
  healthFactor,
  sandbox,
  vaultUsd,
  livePoolFeePct = null,
  livePairLabel,
  onKill,
  onWithdraw,
}: DashboardTopControlsProps) {
  return (
    <div className="flex w-full flex-col gap-4">
      <ResultWithdrawCard
        isPro={isPro}
        killed={killed}
        running={running}
        busy={switchBusy}
        pending={pendingSwitch}
        todayProfitUsd={todayProfitUsd}
        healthFactor={healthFactor}
        sandbox={sandbox}
        vaultUsd={vaultUsd}
        companion={<FlashloanArbSimulationCard />}
        onKill={onKill}
        onWithdraw={onWithdraw}
      />
      <FlashLoanProviderCard
        config={config}
        onChange={onConfigChange}
        livePoolFeePct={livePoolFeePct}
        livePairLabel={livePairLabel}
      />
      <OperationalConfigBar
        config={config}
        onChange={onConfigChange}
        busy={configBusy}
        livePoolFeePct={livePoolFeePct}
      />
    </div>
  );
}
