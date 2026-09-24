"use client";

import ResultWithdrawCard from "@/components/ResultWithdrawCard";

/** @deprecated Gunakan ResultWithdrawCard */
export default function EmergencyKillSwitch(props: {
  killed: boolean;
  running: boolean;
  onKill: () => void;
  onResume: () => void;
  onWithdraw: () => void;
  busy: boolean;
  pending?: "kill" | "resume" | "withdraw" | null;
  compact?: boolean;
  isPro?: boolean;
  todayProfitUsd?: number;
}) {
  return (
    <ResultWithdrawCard
      isPro={props.isPro ?? Boolean(props.compact)}
      killed={props.killed}
      running={props.running}
      busy={props.busy}
      pending={props.pending}
      todayProfitUsd={props.todayProfitUsd}
      onKill={props.onKill}
      onWithdraw={() => props.onWithdraw()}
    />
  );
}
