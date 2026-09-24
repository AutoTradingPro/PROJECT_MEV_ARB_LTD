"use client";

import { Check, Copy } from "lucide-react";
import BankLogo from "@/components/pricing/BankLogos";
import {
  TRANSFER_BANKS,
  type TransferBankId,
} from "@/lib/pricing/checkout";

export default function BankTransferForm({
  selectedBank,
  onSelectBank,
  rows,
  copied,
  onCopy,
  status,
}: {
  selectedBank: TransferBankId;
  onSelectBank: (id: TransferBankId) => void;
  rows: { label: string; value: string; copy?: boolean }[];
  copied: string | null;
  onCopy: (label: string, value: string) => void;
  status: "idle" | "checking" | "success";
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Pilih bank, lalu transfer ke virtual account di bawah.</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="listbox" aria-label="Pilih bank">
        {TRANSFER_BANKS.map((bank) => {
          const selected = selectedBank === bank.id;
          return (
            <button
              key={bank.id}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelectBank(bank.id)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                selected
                  ? "border-cyan-400/55 bg-cyan-400/10 shadow-[0_0_16px_rgba(34,211,238,0.12)]"
                  : "border-slate-800 bg-black hover:border-slate-600"
              }`}
            >
              <BankLogo id={bank.id} />
              <span className="min-w-0">
                <span className={`block text-xs font-black ${selected ? "text-cyan-200" : "text-white"}`}>
                  {bank.shortName}
                </span>
                <span className="block truncate text-[10px] leading-4 text-slate-400">{bank.name}</span>
              </span>
            </button>
          );
        })}
      </div>

      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-black px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{row.label}</p>
            <p className="truncate text-sm font-semibold text-white">{row.value}</p>
          </div>
          {row.copy ? (
            <button
              type="button"
              onClick={() => onCopy(row.label, row.value)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-bold text-cyan-200 hover:border-cyan-400/40"
            >
              {copied === row.label ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === row.label ? "Tersalin" : "Salin"}
            </button>
          ) : null}
        </div>
      ))}

      <p
        className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
          status === "success"
            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
            : status === "checking"
              ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
              : "border-slate-800 bg-black text-slate-400"
        }`}
      >
        Status:{" "}
        {status === "success" ? "Terbayar" : status === "checking" ? "Memverifikasi transfer…" : "Menunggu transfer"}
      </p>
    </div>
  );
}
