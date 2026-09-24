import type { ScanOnlyRow } from "@/lib/scanOnly/types";

function pad(value: string, width: number, align: "left" | "right" = "left"): string {
  const text = value.length > width ? value.slice(0, width) : value;
  return align === "right" ? text.padStart(width, " ") : text.padEnd(width, " ");
}

function usd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(2)}`;
}

export function formatScanOnlyMatrix(rows: ScanOnlyRow[], blockNumber: number): string {
  const header = [
    pad("No", 3, "right"),
    pad("Pair", 16),
    pad("Route (DEX A -> B)", 28),
    pad("Pool TVL (Est)", 14, "right"),
    pad("Max Safe Loan", 14, "right"),
    pad("Est. Net Profit", 16, "right"),
    pad("Status Kelayakan", 36),
  ].join("  ");
  const line = "-".repeat(header.length);
  const body = rows.map((row) =>
    [
      pad(String(row.no), 3, "right"),
      pad(row.pair, 16),
      pad(row.route, 28),
      pad(usd(row.poolTvlUsd), 14, "right"),
      pad(usd(row.maxSafeLoanUsd), 14, "right"),
      pad(usd(row.netUsd), 16, "right"),
      pad(row.statusLabel, 36),
    ].join("  ")
  );
  return [
    `[SCAN_ONLY] Matriks kelayakan · blok #${blockNumber || "—"} · tanpa tx / flash loan`,
    line,
    header,
    line,
    ...body,
    line,
  ].join("\n");
}
