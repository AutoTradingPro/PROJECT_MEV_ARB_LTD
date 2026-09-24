import type { DexId } from "@/lib/bot/types";

export type BotMode = "SCAN_ONLY" | "EXECUTE";

export type ScanEligibility = "layak" | "tipis" | "skip";

export interface ScanOnlyTarget {
  no: number;
  pairId: string;
  pairLabel: string;
  quoteSymbol: string;
  quoteDecimals: number;
  dexA: DexId;
  dexB: DexId;
}

export interface ScanOnlyRow {
  no: number;
  pairId: string;
  pair: string;
  route: string;
  dexA: DexId;
  dexB: DexId;
  poolTvlUsd: number;
  maxSafeLoanUsd: number;
  priceImpactPct: number;
  spreadBps: number;
  grossUsd: number;
  dexFeeUsd: number;
  flashFeeUsd: number;
  bribeUsd: number;
  gasUsd: number;
  netUsd: number;
  status: ScanEligibility;
  statusLabel: string;
  reason?: string;
}

export interface ScanOnlyReport {
  botMode: BotMode;
  chainId: string;
  blockNumber: number;
  gasPriceWei: string;
  maxPriceImpactPct: number;
  minSpreadPct: number;
  maxSpotSpreadPct: number;
  bribePct: number;
  minNetProfitUsd: number;
  scannedAt: string;
  rows: ScanOnlyRow[];
  matrix: string;
  layakCount: number;
  tipisCount: number;
  skipCount: number;
  bestNetUsd: number;
}
