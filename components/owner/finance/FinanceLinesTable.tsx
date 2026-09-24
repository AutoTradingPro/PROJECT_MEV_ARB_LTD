import type { FinanceLine } from "@/lib/finance/types";
import { formatFinanceAmount } from "@/lib/finance/format";

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
