"use client";

import { ChevronDown, CreditCard } from "lucide-react";

const COUNTRIES = [
  { code: "ID", label: "Indonesia" },
  { code: "SG", label: "Singapore" },
  { code: "MY", label: "Malaysia" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
] as const;

export interface CardFormValue {
  email: string;
  name: string;
  number: string;
  expiry: string;
  cvc: string;
  country: string;
  save: boolean;
}

const fieldClass =
  "w-full border-0 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500";

function BrandMarks() {
  return (
    <span className="flex shrink-0 items-center gap-1 pr-2" aria-hidden>
      <span className="rounded-[3px] bg-[#1A1F71] px-1 py-[1px] text-[8px] font-black tracking-tight text-white">VISA</span>
      <span className="relative h-3.5 w-5">
        <span className="absolute left-0 top-0 h-3.5 w-3.5 rounded-full bg-[#EB001B]" />
        <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full bg-[#F79E1B]/90" />
      </span>
      <span className="rounded-[3px] bg-[#2E77BC] px-1 py-[1px] text-[7px] font-black leading-3 text-white">AMEX</span>
      <span className="rounded-[3px] bg-gradient-to-r from-[#0E4C96] via-[#BE0F2C] to-[#00873C] px-1 py-[1px] text-[7px] font-black text-white">
        JCB
      </span>
    </span>
  );
}

export default function CardPaymentForm({
  value,
  onChange,
}: {
  value: CardFormValue;
  onChange: (next: CardFormValue) => void;
}) {
  const patch = (partial: Partial<CardFormValue>) => onChange({ ...value, ...partial });

  return (
    <div className="rounded-2xl border border-slate-800 bg-black p-4 text-white">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <CreditCard className="h-4 w-4" strokeWidth={2} />
        Kartu
      </div>

      <p className="mt-4 text-[15px] font-semibold text-white">Informasi kontak</p>
      <label className="mt-1.5 flex items-center overflow-hidden rounded-lg border border-slate-700 bg-black focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20">
        <span className="shrink-0 pl-3 text-[13px] text-slate-400">Email</span>
        <input
          type="email"
          value={value.email}
          onChange={(event) => patch({ email: event.target.value })}
          className={`${fieldClass} min-w-0 flex-1 text-right`}
          placeholder="email@domain.com"
          autoComplete="email"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-[13px] text-slate-300">Informasi kartu</span>
        <span className="mt-1.5 block overflow-hidden rounded-lg border border-slate-700 bg-black focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20">
          <span className="flex items-center border-b border-slate-700">
            <input
              value={value.number}
              onChange={(event) => patch({ number: formatCardNumber(event.target.value) })}
              className={`${fieldClass} min-w-0 flex-1 font-mono`}
              placeholder="1234 1234 1234 1234"
              inputMode="numeric"
              autoComplete="cc-number"
            />
            <BrandMarks />
          </span>
          <span className="grid grid-cols-2">
            <input
              value={value.expiry}
              onChange={(event) => patch({ expiry: formatExpiry(event.target.value) })}
              className={`${fieldClass} border-r border-slate-700`}
              placeholder="BB / TT"
              inputMode="numeric"
              autoComplete="cc-exp"
            />
            <span className="flex items-center">
              <input
                value={value.cvc}
                onChange={(event) => patch({ cvc: event.target.value.replace(/\D/g, "").slice(0, 4) })}
                className={`${fieldClass} min-w-0 flex-1`}
                placeholder="CVC"
                inputMode="numeric"
                autoComplete="cc-csc"
              />
              <span className="pr-2 text-slate-500" aria-hidden>
                <svg viewBox="0 0 24 16" className="h-4 w-6 fill-none stroke-current" strokeWidth="1.4">
                  <rect x="1" y="1" width="22" height="14" rx="2" />
                  <path d="M16 9.5h4M17.5 8v3" />
                </svg>
              </span>
            </span>
          </span>
        </span>
      </label>

      <label className="mt-4 block">
        <span className="text-[13px] text-slate-300">Nama pemegang kartu</span>
        <input
          value={value.name}
          onChange={(event) => patch({ name: event.target.value })}
          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-black px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          placeholder="Nama lengkap"
          autoComplete="cc-name"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-[13px] text-slate-300">Negara atau wilayah</span>
        <span className="relative mt-1.5 block">
          <select
            value={value.country}
            onChange={(event) => patch({ country: event.target.value })}
            className="w-full appearance-none rounded-lg border border-slate-700 bg-black px-3 py-2.5 pr-9 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          >
            {COUNTRIES.map((item) => (
              <option key={item.code} value={item.code} className="bg-black text-white">
                {item.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </span>
      </label>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 whitespace-normal text-[13px] leading-5 text-slate-300">
        <input
          type="checkbox"
          checked={value.save}
          onChange={(event) => patch({ save: event.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-black text-cyan-400 focus:ring-cyan-400"
        />
        Simpan informasi pembayaran saya untuk pembelian mendatang
      </label>
    </div>
  );
}

function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}
