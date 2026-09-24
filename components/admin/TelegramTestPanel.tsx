"use client";

import { useState } from "react";
import { Bell, CheckCircle2, LoaderCircle } from "lucide-react";

type TestPhase = "idle" | "loading" | "success" | "error";

export default function TelegramTestPanel() {
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const runTest = async () => {
    setPhase("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/telegram/test", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setPhase("error");
        setMessage(json.error || "Gagal mengirim notifikasi uji.");
        return;
      }
      setPhase("success");
      setMessage("Pesan uji terkirim. Cek Telegram di HP Android.");
    } catch {
      setPhase("error");
      setMessage("Tidak bisa memanggil /api/telegram/test. Pastikan server Next.js berjalan.");
    }
  };

  return (
    <section className="theme-panel rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold uppercase tracking-wide">Telegram Notification</h2>
            <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
              Uji token dan chat ID dari .env.local tanpa mengeksekusi transaksi on-chain.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={phase === "loading"}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-sky-400 cursor-pointer disabled:opacity-50"
        >
          {phase === "loading" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          Test Telegram Notification
        </button>
      </div>

      {phase === "success" && message && (
        <p className="flex items-start gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {message}
        </p>
      )}
      {phase === "error" && message && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {message}
        </p>
      )}
    </section>
  );
}
