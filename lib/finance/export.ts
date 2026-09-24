import { FINANCE_PILLARS } from "@/lib/finance/policy";
import type { FinanceLine, FinancialReport } from "@/lib/finance/types";
import { formatFinanceIdr } from "@/lib/finance/format";

export { formatFinanceAmount, formatFinanceIdr, FINANCE_DISPLAY_CURRENCY } from "@/lib/finance/format";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function linesToCsv(title: string, lines: FinanceLine[]): string[] {
  const rows = [csvEscape(title), ["Kode", "Akun", "Rp", "Catatan"].map(csvEscape).join(",")];
  for (const line of lines) {
    rows.push(
      [line.code, line.label, formatFinanceIdr(line.amountUsd), line.note || ""].map((cell) =>
        csvEscape(String(cell))
      ).join(",")
    );
  }
  return rows;
}

export function financialReportToCsv(report: FinancialReport, pillarId: string): string {
  const pillar = FINANCE_PILLARS.find((item) => item.id === pillarId);
  const header = [
    csvEscape("MEV ARB · Laporan Keuangan Owner"),
    csvEscape(pillar?.label || pillarId),
    csvEscape(`Periode ${report.periodLabel}`),
    csvEscape(`Dibuat ${report.generatedAt}`),
    "",
  ];

  if (pillarId === "income") {
    return [
      ...header,
      ...linesToCsv("Pendapatan", report.income.revenue),
      "",
      ...linesToCsv("Beban", report.income.expenses),
      "",
      ["Laba kotor", formatFinanceIdr(report.income.grossProfitUsd)].map(csvEscape).join(","),
      ["Laba bersih", formatFinanceIdr(report.income.netIncomeUsd)].map(csvEscape).join(","),
    ].join("\n");
  }
  if (pillarId === "balance") {
    return [
      ...header,
      ...linesToCsv("Aset", report.balance.assets),
      "",
      ...linesToCsv("Liabilitas", report.balance.liabilities),
      "",
      ...linesToCsv("Ekuitas", report.balance.equity),
      "",
      `Total aset,${formatFinanceIdr(report.balance.totalAssetsUsd)}`,
      `Total liabilitas,${formatFinanceIdr(report.balance.totalLiabilitiesUsd)}`,
      `Total ekuitas,${formatFinanceIdr(report.balance.totalEquityUsd)}`,
    ].join("\n");
  }
  if (pillarId === "cashflow") {
    const book = report.cashbook;
    const cashRows = [
      csvEscape(`Buku kas owner · ${book.periodLabel}`),
      ...book.recurring.map((item) =>
        csvEscape(
          `Opex ${item.item} · ${item.detail} × ${item.days} ${item.intervalDays > 1 ? `kali / ${item.intervalDays} hari` : "hari"} = ${formatFinanceIdr(item.totalIdr)}`
        )
      ),
      csvEscape(`Langganan terbit ke kas,${formatFinanceIdr(book.subscriptionsCommittedIdr)}`),
      ...book.subscriptions.map((item) =>
        [
          item.nextPaymentDate,
          item.item,
          item.category,
          formatFinanceIdr(item.amountIdr),
          `${item.frequency} · ${item.active ? "aktif" : "nonaktif"} · ${item.note || ""}`,
        ]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      csvEscape(`Inventaris subtotal,${formatFinanceIdr(book.inventoryTotalIdr)}`),
      ...book.inventory.map((item) =>
        [item.date, item.item, item.category, formatFinanceIdr(item.amountIdr), item.note || ""]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      csvEscape(`Pribadi subtotal,${formatFinanceIdr(book.personalTotalIdr)}`),
      ...book.personal.map((item) =>
        [item.date, item.item, item.category, formatFinanceIdr(item.amountIdr), item.note || ""]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      csvEscape(`Prive subtotal,${formatFinanceIdr(book.priveTotalIdr)}`),
      ...book.prive.map((item) =>
        [item.date, item.item, item.category, formatFinanceIdr(item.amountIdr), item.note || ""]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      csvEscape(`Deposit exchange subtotal,${formatFinanceIdr(book.exchangeDepositsTotalIdr)}`),
      ...book.exchangeDeposits.map((item) =>
        [item.date, item.item, item.category, formatFinanceIdr(item.amountIdr), item.note || ""]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      csvEscape(`Alokasi modal Trust Wallet ETH (kas keluar),${formatFinanceIdr(book.web3DepositsTotalIdr)}`),
      ...book.web3Deposits.map((item) =>
        [item.date, item.item, item.category, formatFinanceIdr(item.amountIdr), item.note || ""]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      csvEscape(`Infrastruktur RPC subtotal,${formatFinanceIdr(book.infrastructureTotalIdr)}`),
      ...book.infrastructure.map((item) =>
        [item.date, item.item, item.category, formatFinanceIdr(item.amountIdr), item.note || ""]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      csvEscape(`Utilitas PDAM subtotal,${formatFinanceIdr(book.utilitiesTotalIdr)}`),
      ...book.utilities.map((item) =>
        [item.date, item.item, item.category, formatFinanceIdr(item.amountIdr), item.note || ""]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      csvEscape(`OpEx harian,${formatFinanceIdr(book.opex.daily.amountIdr)}`),
      csvEscape(`OpEx mingguan,${formatFinanceIdr(book.opex.weekly.amountIdr)}`),
      csvEscape(`OpEx bulanan MTD,${formatFinanceIdr(book.opex.monthly.amountIdr)}`),
      csvEscape(`OpEx wajib terkumpul,${formatFinanceIdr(book.opex.accumulatedIdr)}`),
      ["Kode", "Tanggal / akun", "Rp", "Catatan"].map(csvEscape).join(","),
      ...book.inflows.map((line) =>
        [line.code, line.label, formatFinanceIdr(line.amountIdr), line.note || "Kas masuk"]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      ["", "Total Kas Masuk", formatFinanceIdr(book.totalInflowIdr), ""].map((cell) => csvEscape(String(cell))).join(","),
      ...book.mutasiLines.map((line) =>
        [line.code, line.label, formatFinanceIdr(line.amountIdr), line.note || "Pengeluaran"]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      ...book.dailyOpexLines.map((line) =>
        [line.code, line.label, formatFinanceIdr(line.amountIdr), line.note || "Opex harian"]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      ...book.periodicOpexLines.map((line) =>
        [line.code, line.label, formatFinanceIdr(line.amountIdr), line.note || "Opex berkala"]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      ["", "Total Pengeluaran", formatFinanceIdr(book.totalOutflowIdr), ""].map((cell) => csvEscape(String(cell))).join(","),
      ...book.commitmentLines.map((line) =>
        [line.code, line.label, formatFinanceIdr(line.amountIdr), line.note || "Komitmen bulanan"]
          .map((cell) => csvEscape(String(cell)))
          .join(",")
      ),
      [
        "",
        "Komitmen bulanan",
        formatFinanceIdr(book.commitmentLines.reduce((sum, line) => sum + line.amountIdr, 0)),
        "",
      ]
        .map((cell) => csvEscape(String(cell)))
        .join(","),
      `Saldo akhir,${formatFinanceIdr(book.closingIdr)}`,
      "",
    ];
    return [
      ...header,
      ...cashRows,
      ...linesToCsv("Aktivitas operasi", report.cashflow.operating),
      "",
      ...linesToCsv("Aktivitas investasi", report.cashflow.investing),
      "",
      ...linesToCsv("Aktivitas pendanaan", report.cashflow.financing),
      "",
      `Kas awal,${formatFinanceIdr(report.cashflow.openingCashUsd)}`,
      `Perubahan bersih,${formatFinanceIdr(report.cashflow.netChangeUsd)}`,
      `Kas akhir,${formatFinanceIdr(report.cashflow.closingCashUsd)}`,
    ].join("\n");
  }
  if (pillarId === "equity") {
    return [
      ...header,
      `Saldo awal,${formatFinanceIdr(report.equity.openingUsd)}`,
      ...linesToCsv("Pergerakan", report.equity.movements),
      `Saldo akhir,${formatFinanceIdr(report.equity.closingUsd)}`,
    ].join("\n");
  }

  const noteRows = report.notes.sections.flatMap((section) => {
    const lines = [csvEscape(section.title)];
    for (const row of section.rows || []) {
      lines.push([row.key, row.value].map(csvEscape).join(","));
    }
    return lines;
  });
  const audit = [
    "",
    "Audit log",
    ["Waktu", "Kategori", "Judul", "Detail"].map(csvEscape).join(","),
    ...report.notes.auditLog.map((event) =>
      [event.at, event.category, event.title, event.detail].map(csvEscape).join(",")
    ),
  ];
  return [...header, ...noteRows, ...audit].join("\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
