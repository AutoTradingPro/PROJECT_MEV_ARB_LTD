"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Printer, ShieldCheck } from "lucide-react";
import FinanceLinesTable, { CashLedgerTable } from "@/components/owner/finance/FinanceLinesTable";
import { fetchFinancialReport } from "@/lib/finance/client";
import { downloadCsv, financialReportToCsv } from "@/lib/finance/export";
import { formatFinanceAmount } from "@/lib/finance/format";
import {
  FINANCE_PERIODS,
  FINANCE_PILLARS,
  type FinancePeriodId,
  type FinancePillarId,
} from "@/lib/finance/policy";
import type { FinancialReport } from "@/lib/finance/types";

const POLL_MS = 4000;

export default function FinancialReportingView() {
  const [period, setPeriod] = useState<FinancePeriodId>("aug2026");
  const [pillar, setPillar] = useState<FinancePillarId>("cashflow");
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchFinancialReport(period);
      setReport(next);
      setError(null);
      setLive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat laporan.");
      setLive(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const exportCsv = () => {
    if (!report) return;
    downloadCsv(`laporan-keuangan-${pillar}-${period}.csv`, financialReportToCsv(report, pillar));
  };

  const activeLabel = useMemo(
    () => FINANCE_PILLARS.find((item) => item.id === pillar)?.label ?? "",
    [pillar]
  );

  return (
    <div className="space-y-5 finance-print">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/80">
            Owner · terisolasi
          </p>
          <h1 className="text-xl font-black tracking-wide text-slate-100">Laporan Keuangan</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Lima pilar pelaporan platform plus buku kas owner, seluruhnya dalam Rupiah (Rp):
            setoran modal, mutasi, dan saldo akhir. Data operasional dari database user dan jurnal
            eksekusi bot.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!report}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:border-amber-500/40 hover:text-amber-200 cursor-pointer disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Ekspor CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-400/15 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/25 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            Cetak / PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        {FINANCE_PERIODS.map((item) => {
          const active = period === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide cursor-pointer transition-colors ${
                active
                  ? "border-amber-500/50 bg-amber-400/15 text-amber-300"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {FINANCE_PILLARS.map((item) => {
          const active = pillar === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPillar(item.id)}
              className={`rounded-xl border px-3 py-2 text-[11px] font-bold cursor-pointer transition-colors ${
                active
                  ? "border-amber-500/50 bg-amber-400/15 text-amber-200"
                  : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200"
              }`}
            >
              {item.short}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      {report ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <p>
              {activeLabel} · {report.periodLabel} · {report.currency} · {report.policyVersion}
            </p>
            <p className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              {live ? "Live · sinkron operasional" : "Menghubungkan…"} ·{" "}
              {report.stats.successTradesInPeriod} tx sukses
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {report.cards.map((card) => (
              <div key={card.label} className="theme-panel rounded-2xl px-4 py-4">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className="mt-1 font-mono text-xl font-black tabular-nums text-amber-300">
                  {card.value}
                </p>
                {card.hint ? <p className="mt-1 text-[11px] text-slate-500">{card.hint}</p> : null}
              </div>
            ))}
          </div>

          <OpexSummaryPanel opex={report.cashbook.opex} />

          {pillar === "income" ? (
            <div className="space-y-4">
              <FinanceLinesTable
                title="Pendapatan"
                lines={report.income.revenue}
                footer={{ label: "Jumlah pendapatan", amountUsd: report.income.grossProfitUsd }}
              />
              <FinanceLinesTable
                title="Beban operasional"
                lines={report.income.expenses}
                footer={{ label: "Laba / (rugi) bersih", amountUsd: report.income.netIncomeUsd }}
              />
            </div>
          ) : null}

          {pillar === "balance" ? (
            <div className="space-y-4">
              <FinanceLinesTable
                title="Aset"
                lines={report.balance.assets}
                footer={{ label: "Total aset", amountUsd: report.balance.totalAssetsUsd }}
              />
              <FinanceLinesTable
                title="Liabilitas"
                lines={report.balance.liabilities}
                footer={{ label: "Total liabilitas", amountUsd: report.balance.totalLiabilitiesUsd }}
              />
              <FinanceLinesTable
                title="Ekuitas"
                lines={report.balance.equity}
                footer={{ label: "Total ekuitas", amountUsd: report.balance.totalEquityUsd }}
              />
              <p
                className={`text-xs ${
                  report.balance.balanced ? "text-emerald-400" : "text-amber-300"
                }`}
              >
                {report.balance.balanced
                  ? "Neraca seimbang: Aset = Liabilitas + Ekuitas."
                  : "Neraca perlu rekonsiliasi (selisih pembulatan atau data tidak lengkap)."}
              </p>
            </div>
          ) : null}

          {pillar === "cashflow" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <CashStat label="Total Kas Masuk" value={report.cashbook.totalInflowIdr} />
                <CashStat label="Total Pengeluaran" value={report.cashbook.totalOutflowIdr} invert />
                <CashStat label="Saldo Akhir" value={report.cashbook.closingIdr} />
              </div>
              <p className="text-xs text-slate-500">
                Buku kas owner · {report.cashbook.periodLabel} · {report.cashbook.source} · kas awal{" "}
                {formatFinanceAmount(report.cashbook.openingIdr)}
              </p>
              <div className="space-y-1 text-xs text-slate-400">
                {report.cashbook.recurring.map((item) => (
                  <p key={item.id}>
                    Opex {item.item}: {item.detail} × {item.days}{" "}
                    {item.intervalDays > 1 ? `kali (setiap ${item.intervalDays} hari)` : "hari"} (
                    {item.startDate.slice(8, 10)}/{item.startDate.slice(5, 7)}/{item.startDate.slice(0, 4)}–
                    {item.endDate.slice(8, 10)}/{item.endDate.slice(5, 7)}/{item.endDate.slice(0, 4)}) ={" "}
                    {formatFinanceAmount(item.totalIdr)}
                  </p>
                ))}
              </div>
              {report.cashbook.infrastructure.length ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                    OpEx infrastruktur / RPC
                  </p>
                  {report.cashbook.infrastructure.map((item) => (
                    <p key={item.id} className="mt-1 text-slate-300">
                      {formatIsoId(item.date)} · {item.item} · {item.category} ·{" "}
                      {formatFinanceAmount(item.amountIdr)}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  ))}
                  <p className="mt-1 text-slate-500">
                    Subtotal infrastruktur {formatFinanceAmount(report.cashbook.infrastructureTotalIdr)}{" "}
                    sudah termasuk dalam mutasi dan ringkasan OpEx. Porsi harian RPC{" "}
                    {formatFinanceAmount(report.cashbook.opex.rpcDailySliceIdr)} (
                    {report.cashbook.opex.rpcCycleDays} hari siklus, nota terakhir{" "}
                    {formatFinanceAmount(report.cashbook.opex.rpcLatestIdr)}).
                  </p>
                </div>
              ) : null}
              {report.cashbook.utilities.length ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                    Utilitas / operasional bulanan (PDAM)
                  </p>
                  {report.cashbook.utilities.map((item) => (
                    <p key={item.id} className="mt-1 text-slate-300">
                      {formatIsoId(item.date)} · {item.item} · {item.category} ·{" "}
                      {formatFinanceAmount(item.amountIdr)}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  ))}
                  <p className="mt-1 text-slate-500">
                    Total keluar PDAM {formatFinanceAmount(report.cashbook.utilitiesTotalIdr)} (nominal
                    transfer + biaya admin) sudah termasuk dalam mutasi, OpEx mingguan, dan OpEx
                    bulan berjalan.
                  </p>
                </div>
              ) : null}
              {report.cashbook.inventory.length ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                    Catatan inventaris
                  </p>
                  {report.cashbook.inventory.map((item) => (
                    <p key={item.id} className="mt-1 text-slate-300">
                      {item.date.slice(8, 10)}/{item.date.slice(5, 7)}/{item.date.slice(0, 4)} · {item.item} ·{" "}
                      {item.category} · {formatFinanceAmount(item.amountIdr)}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  ))}
                  <p className="mt-1 text-slate-500">
                    Subtotal inventaris {formatFinanceAmount(report.cashbook.inventoryTotalIdr)} sudah
                    termasuk dalam total pengeluaran.
                  </p>
                </div>
              ) : null}
              {report.cashbook.personal.length ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                    Pengeluaran pribadi / konsumsi rumah tangga
                  </p>
                  {report.cashbook.personal.map((item) => (
                    <p key={item.id} className="mt-1 text-slate-300">
                      {item.date.slice(8, 10)}/{item.date.slice(5, 7)}/{item.date.slice(0, 4)} · {item.item} ·{" "}
                      {item.category} · {formatFinanceAmount(item.amountIdr)}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  ))}
                  <p className="mt-1 text-slate-500">
                    Subtotal pribadi {formatFinanceAmount(report.cashbook.personalTotalIdr)} sudah
                    termasuk dalam total pengeluaran.
                  </p>
                </div>
              ) : null}
              {report.cashbook.prive.length ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                    Prive / penarikan dana pribadi
                  </p>
                  {report.cashbook.prive.map((item) => (
                    <p key={item.id} className="mt-1 text-slate-300">
                      {item.date.slice(8, 10)}/{item.date.slice(5, 7)}/{item.date.slice(0, 4)} · {item.item} ·{" "}
                      {item.category} · {formatFinanceAmount(item.amountIdr)}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  ))}
                  <p className="mt-1 text-slate-500">
                    Subtotal prive {formatFinanceAmount(report.cashbook.priveTotalIdr)} mengurangi kas
                    owner, tetapi tidak dihitung sebagai OpEx operasional bot.
                  </p>
                </div>
              ) : null}
              {report.cashbook.exchangeDeposits.length ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                    Deposit exchange / modal operasional
                  </p>
                  {report.cashbook.exchangeDeposits.map((item) => (
                    <p key={item.id} className="mt-1 text-slate-300">
                      {item.date.slice(8, 10)}/{item.date.slice(5, 7)}/{item.date.slice(0, 4)} · {item.item} ·{" "}
                      {item.category} · {formatFinanceAmount(item.amountIdr)}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  ))}
                  <p className="mt-1 text-slate-500">
                    Subtotal deposit exchange{" "}
                    {formatFinanceAmount(report.cashbook.exchangeDepositsTotalIdr)} sudah termasuk
                    dalam total pengeluaran.
                  </p>
                </div>
              ) : null}
              {report.cashbook.web3Deposits.length ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                    Pengeluaran alokasi modal / uji arbitrase
                  </p>
                  {report.cashbook.web3Deposits.map((item) => (
                    <p key={item.id} className="mt-1 text-slate-300">
                      {item.date.slice(8, 10)}/{item.date.slice(5, 7)}/{item.date.slice(0, 4)} · {item.item} ·{" "}
                      {item.category} · {formatFinanceAmount(item.amountIdr)}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  ))}
                  <p className="mt-1 text-slate-500">
                    Subtotal alokasi Trust Wallet ETH{" "}
                    {formatFinanceAmount(report.cashbook.web3DepositsTotalIdr)} sudah termasuk dalam
                    total pengeluaran (bukan kas masuk). Catatan lump-sum lama Rp 200.000,00 tidak
                    dipakai.
                  </p>
                </div>
              ) : null}
              <CashLedgerTable
                title="Arus Kas Utama"
                lines={[
                  ...report.cashbook.inflows,
                  ...report.cashbook.mutasiLines,
                  ...report.cashbook.outflows.filter((line) => line.code.startsWith("KB-")),
                ]}
              />
              <CashLedgerTable
                title="Pengeluaran Harian"
                lines={[...report.cashbook.dailyOpexLines, ...report.cashbook.periodicOpexLines]}
              />
              {report.cashbook.subscriptions.length ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                    Pengeluaran rutin / langganan
                  </p>
                  {report.cashbook.subscriptions.map((item) => (
                    <p key={item.id} className="mt-1 text-slate-300">
                      {item.item} · {item.category} · {formatFinanceAmount(item.amountIdr)} / bulan
                      {" · "}
                      jadwal berikutnya {item.nextPaymentDate.slice(8, 10)}/
                      {item.nextPaymentDate.slice(5, 7)}/{item.nextPaymentDate.slice(0, 4)}
                      {" · "}
                      {item.active ? "Aktif" : "Nonaktif"}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  ))}
                  <p className="mt-1 text-slate-500">
                    {report.cashbook.subscriptionsCommittedIdr > 0
                      ? `Yang sudah jatuh tempo pada periode ini ${formatFinanceAmount(report.cashbook.subscriptionsCommittedIdr)} sudah termasuk dalam total pengeluaran.`
                      : "Nominal langganan belum memotong kas periode ini karena jadwal pembayaran berikutnya masih di depan tanggal buku."}
                  </p>
                </div>
              ) : null}
              {report.cashbook.commitmentLines.length ? (
                <FinanceLinesTable
                  title="Komitmen Bulanan / Langganan Rutin"
                  lines={report.cashbook.commitmentLines.map((line) => ({
                    code: line.code,
                    label: line.label,
                    amountUsd: -line.amountIdr,
                    note: line.note || "Langganan bulanan",
                  }))}
                  footer={{
                    label: "Komitmen bulanan",
                    amountUsd: -report.cashbook.commitmentLines.reduce(
                      (sum, line) => sum + line.amountIdr,
                      0
                    ),
                  }}
                />
              ) : null}
              <div className="grid gap-3 sm:grid-cols-3">
                <CashStat label="Kas awal (platform)" value={report.cashflow.openingCashUsd} />
                <CashStat label="Perubahan bersih (platform)" value={report.cashflow.netChangeUsd} />
                <CashStat label="Kas akhir (platform)" value={report.cashflow.closingCashUsd} />
              </div>
              <FinanceLinesTable title="Aktivitas operasi" lines={report.cashflow.operating} />
              <FinanceLinesTable title="Aktivitas investasi" lines={report.cashflow.investing} />
              <FinanceLinesTable title="Aktivitas pendanaan" lines={report.cashflow.financing} />
            </div>
          ) : null}

          {pillar === "equity" ? (
            <div className="space-y-4">
              <FinanceLinesTable
                title="Pergerakan modal owner"
                lines={[
                  {
                    code: "E-00",
                    label: "Saldo ekuitas awal periode",
                    amountUsd: report.equity.openingUsd,
                  },
                  ...report.equity.movements,
                ]}
                footer={{ label: "Saldo ekuitas akhir", amountUsd: report.equity.closingUsd }}
              />
            </div>
          ) : null}

          {pillar === "notes" ? (
            <div className="space-y-4">
              {report.notes.sections.map((section) => (
                <section key={section.title} className="theme-panel rounded-2xl p-4 sm:p-5 space-y-3">
                  <h3 className="text-sm font-bold tracking-wide text-slate-100">{section.title}</h3>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 48)} className="text-sm leading-relaxed text-slate-400">
                      {paragraph}
                    </p>
                  ))}
                  {section.rows?.length ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left text-xs">
                        <tbody className="divide-y divide-slate-800/70">
                          {section.rows.map((row) => (
                            <tr key={row.key}>
                              <td className="px-3 py-2 text-slate-500 w-[40%]">{row.key}</td>
                              <td className="px-3 py-2 font-mono text-slate-200">{row.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              ))}
              <section className="theme-panel rounded-2xl overflow-hidden">
                <div className="border-b border-slate-800 px-4 py-3">
                  <h3 className="text-sm font-bold tracking-wide">Audit log operasional</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-3 font-semibold">Waktu</th>
                        <th className="px-3 py-3 font-semibold">Kategori</th>
                        <th className="px-3 py-3 font-semibold">Judul</th>
                        <th className="px-3 py-3 font-semibold">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {report.notes.auditLog.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                            Belum ada peristiwa pada periode ini.
                          </td>
                        </tr>
                      ) : (
                        report.notes.auditLog.map((event, index) => (
                          <tr key={`${event.at}-${index}`} className="hover:bg-slate-800/40">
                            <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">
                              {event.at.replace("T", " ").slice(0, 19)}
                            </td>
                            <td className="px-3 py-2 uppercase tracking-wide text-amber-400/80">
                              {event.category}
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-100">{event.title}</td>
                            <td className="px-3 py-2 text-slate-400 break-all">{event.detail}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : null}
        </>
      ) : !error ? (
        <p className="text-sm text-slate-500">Menyusun buku besar dari data operasional…</p>
      ) : null}
    </div>
  );
}

function formatIsoId(isoDate: string): string {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}/${isoDate.slice(0, 4)}`;
}

function OpexSummaryPanel({
  opex,
}: {
  opex: FinancialReport["cashbook"]["opex"];
}) {
  const items = [
    {
      label: "OpEx Harian",
      value: opex.daily.amountIdr,
      hint: `${formatIsoId(opex.daily.start)} · posting wajib + porsi RPC ${formatFinanceAmount(opex.rpcDailySliceIdr)} / hari`,
    },
    {
      label: "OpEx Mingguan",
      value: opex.weekly.amountIdr,
      hint: `${formatIsoId(opex.weekly.start)} — ${formatIsoId(opex.weekly.end)} · termasuk nota RPC dalam jendela`,
    },
    {
      label: "OpEx Bulanan",
      value: opex.monthly.amountIdr,
      hint: `${formatIsoId(opex.monthly.start)} — ${formatIsoId(opex.monthly.end)} · MTD termasuk ANKR dan PDAM`,
    },
  ];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Ringkasan OpEx operasional
        </p>
        <p className="text-[11px] text-slate-500">
          Akumulasi wajib s.d. {formatIsoId(opex.asOf)} · run-rate{" "}
          {formatFinanceAmount(opex.runRateDailyIdr)} / hari · terkumpul{" "}
          {formatFinanceAmount(opex.accumulatedIdr)}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="theme-panel rounded-2xl px-4 py-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-1 font-mono text-xl font-black tabular-nums text-rose-300">
              {formatFinanceAmount(item.value)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{item.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashStat({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  const display = invert ? -Math.abs(value) : value;
  return (
    <div className="theme-panel-muted rounded-2xl px-4 py-4">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 font-mono text-lg font-black tabular-nums ${
          display < 0 ? "text-rose-300" : "text-slate-100"
        }`}
      >
        {formatFinanceAmount(value)}
      </p>
    </div>
  );
}
