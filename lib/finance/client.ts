import type { FinancePeriodId } from "@/lib/finance/policy";
import type { FinancialReport } from "@/lib/finance/types";

export async function fetchFinancialReport(period: FinancePeriodId): Promise<FinancialReport> {
  const res = await fetch(`/api/owner/finance?period=${encodeURIComponent(period)}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as { report?: FinancialReport; error?: string };
  if (!res.ok || !json.report) {
    throw new Error(json.error || "Gagal memuat laporan keuangan.");
  }
  return json.report;
}
