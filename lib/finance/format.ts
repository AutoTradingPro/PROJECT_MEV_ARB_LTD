/** Mata uang tampilan Laporan Keuangan owner — selalu Rupiah. */
export const FINANCE_DISPLAY_CURRENCY = "IDR" as const;

export type FinanceDisplayCurrency = typeof FINANCE_DISPLAY_CURRENCY;

/** Pemformat angka Rupiah global: `Rp 2.000.000,00` (locale id-ID). */
export function formatFinanceIdr(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}Rp ${Math.abs(n).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Alias tampilan laporan — seluruh nominal keuangan owner memakai Rupiah. */
export function formatFinanceAmount(value: number): string {
  return formatFinanceIdr(value);
}
