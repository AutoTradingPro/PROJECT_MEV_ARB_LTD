import type { FinancePeriodId } from "@/lib/finance/policy";

export function resolveFinanceWindow(
  period: FinancePeriodId,
  now = new Date()
): { start: Date; end: Date; label: string } {
  if (period === "aug2026") {
    const start = new Date("2026-08-01T00:00:00+07:00");
    const end = new Date("2026-08-31T23:59:59.999+07:00");
    return { start, end, label: "1 — 31 Agustus 2026" };
  }

  const end = now;
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  if (period === "week") {
    const weekday = start.getUTCDay();
    const mondayOffset = weekday === 0 ? 6 : weekday - 1;
    start.setUTCDate(start.getUTCDate() - mondayOffset);
  } else if (period === "month") {
    start.setUTCDate(1);
  }

  const label = `${formatStamp(start)} — ${formatStamp(end)} UTC`;
  return { start, end, label };
}

export function inFinanceWindow(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= start.getTime() && t <= end.getTime();
}

function formatStamp(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 16);
}
