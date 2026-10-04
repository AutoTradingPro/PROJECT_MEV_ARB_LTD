import type { OwnerCashbookLine } from "@/lib/finance/ownerCashbook";
import type { FinanceLine } from "@/lib/finance/types";
import { formatFinanceAmount } from "@/lib/finance/format";

function formatLedgerWhen(line: OwnerCashbookLine): string {
  const [year, month, day] = line.date.split("-");
  const date = `${day}/${month}/${year}`;
  return line.time ? `${date} ${line.time}` : date;
}

function ledgerStamp(line: OwnerCashbookLine): string {
  return `${line.date}T${line.time ?? "00:00:00"}`;
}

/** Buku kas: No, Tanggal & Waktu, Keterangan, Kategori, Jumlah (IDR). */
export function CashLedgerTable({
  title,
  lines,
}: {
  title: string;
  lines: OwnerCashbookLine[];
}) {
  const rows = [...lines].sort(
    (a, b) => ledgerStamp(a).localeCompare(ledgerStamp(b)) || a.item.localeCompare(b.item)
  );
  const net = rows.reduce((sum, line) => sum + (line.kind === "inflow" ? line.amountIdr : -line.amountIdr), 0);
  return (
    <div className="theme-panel rounded-2xl overflow-hidden">
      <div className="border-b border-slate-800 px-4 py-3">
        <h3 className="text-sm font-bold tracking-wide text-slate-100">{title}</h3>
      </div>
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-3 w-12 font-semibold">No</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap">Tanggal & Waktu</th>
              <th className="px-3 py-3 font-semibold">Keterangan Transaksi</th>
              <th className="px-3 py-3 font-semibold">Kategori</th>
              <th className="px-3 py-3 text-right font-semibold">Jumlah (IDR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {rows.map((line, index) => {
              const signed = line.kind === "inflow" ? line.amountIdr : -line.amountIdr;
              return (
                <tr key={`${line.code}-${line.date}-${line.item}`} className="hover:bg-slate-800/40">
                  <td className="px-3 py-3 font-mono text-slate-500">{index + 1}</td>
                  <td className="px-3 py-3 font-mono whitespace-nowrap text-slate-300">{formatLedgerWhen(line)}</td>
                  <td className="px-3 py-3 font-semibold text-slate-100">
                    {line.item}
                    {line.note ? <span className="mt-0.5 block font-normal text-slate-500">{line.note}</span> : null}
                  </td>
                  <td className="px-3 py-3 text-slate-300">{line.category}</td>
                  <td
                    className={`px-3 py-3 text-right font-mono font-bold tabular-nums ${
                      signed < 0 ? "text-rose-300" : "text-emerald-400"
                    }`}
                  >
                    {formatFinanceAmount(signed)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="border-t border-slate-700 bg-slate-950">
              <td className="px-3 py-3" />
              <td className="px-3 py-3 font-black uppercase tracking-wide text-amber-300" colSpan={3}>
                Jumlah
              </td>
              <td className="px-3 py-3 text-right font-mono font-black tabular-nums text-amber-300">
                {formatFinanceAmount(net)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function FinanceLinesTable({
  title,
  lines,
  footer,
}: {
  title: string;
  lines: FinanceLine[];
  footer?: { label: string; amountUsd: number };
}) {
  return (
    <div className="theme-panel rounded-2xl overflow-hidden">
      <div className="border-b border-slate-800 px-4 py-3">
        <h3 className="text-sm font-bold tracking-wide text-slate-100">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-3 w-20 font-semibold">Kode</th>
              <th className="px-3 py-3 font-semibold">Akun</th>
              <th className="px-3 py-3 font-semibold">Catatan</th>
              <th className="px-3 py-3 text-right font-semibold">Rp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {lines.map((line) => (
              <tr
                key={line.code}
                className={`hover:bg-slate-800/40 ${
                  line.emphasis === "subtotal" || line.emphasis === "total"
                    ? "bg-amber-400/5"
                    : ""
                }`}
              >
                <td className="px-3 py-3 font-mono text-slate-500">{line.code}</td>
                <td
                  className={`px-3 py-3 ${
                    line.emphasis === "subtotal" || line.emphasis === "total"
                      ? "font-bold text-amber-200"
                      : "font-semibold text-slate-100"
                  }`}
                >
                  {line.label}
                </td>
                <td className="px-3 py-3 text-slate-500">{line.note || "—"}</td>
                <td
                  className={`px-3 py-3 text-right font-mono font-bold tabular-nums ${
                    line.emphasis === "muted"
                      ? "text-slate-500"
                      : line.amountUsd < 0
                        ? "text-rose-300"
                        : "text-emerald-400"
                  }`}
                >
                  {formatFinanceAmount(line.amountUsd)}
                </td>
              </tr>
            ))}
            {footer ? (
              <tr className="bg-slate-950/70">
                <td className="px-3 py-3" />
                <td className="px-3 py-3 font-black uppercase tracking-wide text-amber-300" colSpan={2}>
                  {footer.label}
                </td>
                <td className="px-3 py-3 text-right font-mono font-black tabular-nums text-amber-300">
                  {formatFinanceAmount(footer.amountUsd)}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
