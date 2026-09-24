"use client";

import { useCallback, useEffect, useState } from "react";
import { Power, PowerOff, ShieldAlert } from "lucide-react";

interface BotKillState {
  killed?: boolean;
  running?: boolean;
  error?: string;
}

export default function OwnerKillSwitch() {
  const [killed, setKilled] = useState(false);
  const [pending, setPending] = useState<"kill" | "resume" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bot?t=${Date.now()}`, { cache: "no-store" });
      const json = (await res.json()) as BotKillState;
      if (typeof json.killed === "boolean") setKilled(json.killed);
      setError(null);
    } catch {
      setError("Tidak bisa membaca status mesin bot.");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(id);
  }, [load]);

  const run = async (action: "kill" | "resume") => {
    if (action === "kill") {
      const ok = window.confirm(
        "Aktifkan Kill Switch global? Seluruh scanner dan eksekusi arbitrase akan ditahan."
      );
      if (!ok) return;
    }
    setPending(action);
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as BotKillState;
      if (!res.ok) throw new Error(json.error || "Gagal mengubah kill switch.");
      setKilled(Boolean(json.killed));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah kill switch.");
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="theme-panel rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/80">
            Global Bot Control
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-sm font-black tracking-wide">
            <ShieldAlert className={`h-4 w-4 ${killed ? "text-red-400" : "text-emerald-400"}`} />
            Kill Switch mesin pemindai
          </h2>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-slate-500">
            Mematikan atau menyalakan seluruh mesin scan/eksekusi (testnet + mainnet + otonom) lewat
            state bot server. Portal dApp mengikuti status ini secara massal.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
            killed
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${killed ? "bg-red-500" : "bg-emerald-400"}`} />
          {killed ? "Mesin mati" : "Mesin hidup"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending !== null || killed}
          onClick={() => void run("kill")}
          className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-red-200 hover:bg-red-500/25 cursor-pointer disabled:opacity-40"
        >
          <PowerOff className="h-4 w-4" />
          {pending === "kill" ? "Mematikan…" : "Kill Switch ON"}
        </button>
        <button
          type="button"
          disabled={pending !== null || !killed}
          onClick={() => void run("resume")}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-200 hover:bg-emerald-500/20 cursor-pointer disabled:opacity-40"
        >
          <Power className="h-4 w-4" />
          {pending === "resume" ? "Menyalakan…" : "Resume mesin"}
        </button>
      </div>
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </section>
  );
}
