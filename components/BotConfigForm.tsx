"use client";

import OperationalConfigBar from "@/components/tier/OperationalConfigBar";
import type { BotConfig } from "@/lib/bot/types";

interface BotConfigFormProps {
  config: BotConfig;
  onChange: (config: BotConfig) => void;
  busy?: boolean;
}

/** @deprecated Gunakan OperationalConfigBar — wrapper kompatibilitas */
export default function BotConfigForm(props: BotConfigFormProps) {
  return <OperationalConfigBar {...props} />;
}
