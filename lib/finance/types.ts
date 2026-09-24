import type { FinancePeriodId, FinancePillarId } from "@/lib/finance/policy";
import type { OwnerCashbook } from "@/lib/finance/ownerCashbook";

export interface FinanceLine {
  code: string;
  label: string;
  amountUsd: number;
  note?: string;
  emphasis?: "total" | "subtotal" | "muted";
}

export interface FinanceAuditEvent {
  at: string;
  category: "user" | "trade" | "policy" | "system";
  title: string;
  detail: string;
}

export interface FinanceNoteSection {
  title: string;
  paragraphs: string[];
  rows?: { key: string; value: string }[];
}

export interface FinancialReport {
  generatedAt: string;
  period: FinancePeriodId;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  currency: string;
  policyVersion: string;
  cards: { label: string; value: string; hint?: string }[];
  income: {
    revenue: FinanceLine[];
    expenses: FinanceLine[];
    grossProfitUsd: number;
    netIncomeUsd: number;
  };
  balance: {
    assets: FinanceLine[];
    liabilities: FinanceLine[];
    equity: FinanceLine[];
    totalAssetsUsd: number;
    totalLiabilitiesUsd: number;
    totalEquityUsd: number;
    balanced: boolean;
  };
  cashflow: {
    operating: FinanceLine[];
    investing: FinanceLine[];
    financing: FinanceLine[];
    netChangeUsd: number;
    openingCashUsd: number;
    closingCashUsd: number;
  };
  equity: {
    openingUsd: number;
    movements: FinanceLine[];
    closingUsd: number;
  };
  notes: {
    sections: FinanceNoteSection[];
    auditLog: FinanceAuditEvent[];
  };
  cashbook: OwnerCashbook;
  stats: {
    userCount: number;
    proUserCount: number;
    stakingUserCount: number;
    successTradesInPeriod: number;
    proTradesInPeriod: number;
  };
}

export type { FinancePeriodId, FinancePillarId };
