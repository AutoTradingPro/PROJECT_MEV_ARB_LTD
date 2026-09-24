"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";

interface VaultGateProps {
  busy: boolean;
  error: string | null;
  onUnlock: (password: string) => Promise<void>;
}

export default function VaultGate({ busy, error, onUnlock }: VaultGateProps) {
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onUnlock(password);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: "#0a0704",
        backgroundImage: "url('/owner/brankas-gate.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/70" />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-[min(92vw,420px)] rounded-3xl border border-amber-400/40 bg-slate-950/80 p-6 shadow-[0_0_80px_rgba(212,175,55,0.28)] backdrop-blur-xl"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-500/10 text-amber-300">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400/80">
              Gatekeeper Authentication
            </p>
            <h2 className="text-lg font-black tracking-wide text-amber-100">Brankas Owner</h2>
          </div>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-slate-300">
          Masukkan kata sandi brankas untuk membuka manajemen kontrak vault dan dompet operasional.
        </p>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-400/90">
          Password
        </label>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mb-4 w-full rounded-xl border border-amber-500/30 bg-black/50 px-3 py-2.5 text-sm text-amber-50 outline-none ring-amber-400/40 placeholder:text-slate-500 focus:ring-2"
          placeholder="Kata sandi brankas"
        />
        {error ? (
          <p className="mb-3 rounded-lg border border-red-500/30 bg-red-950/50 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !password.trim()}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-2.5 text-sm font-black tracking-wide text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" />
          {busy ? "Memverifikasi…" : "Buka Brankas"}
        </button>
        <Link
          href="/owner/overview"
          className="mt-3 block text-center text-xs font-semibold text-slate-400 hover:text-amber-200"
        >
          Kembali ke Owner Console
        </Link>
      </form>
    </div>
  );
}
