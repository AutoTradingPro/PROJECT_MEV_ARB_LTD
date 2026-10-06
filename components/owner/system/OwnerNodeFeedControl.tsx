"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio, Server } from "lucide-react";
import { useRpcLiveFeed } from "@/context/RpcLiveFeedContext";
import type { NodeFeedLogEntry } from "@/lib/owner/nodeFeedLog";

function StatusDot({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex h-2.5 w-2.5 rounded-full ${
        on ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.55)]"
      }`}
      aria-hidden
    />
  );
}

function FeedSwitch({
  on,
  label,
  onToggle,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="flex items-center gap-3 shrink-0 cursor-pointer"
    >
      <span
        className={`text-[11px] font-mono font-bold uppercase tracking-wide ${
          on ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {on ? "On" : "Off"}
      </span>
      <span
        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-colors ${
          on ? "border-emerald-500/50 bg-emerald-500/80" : "border-red-500/40 bg-red-950/80"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

export default function OwnerNodeFeedControl() {
  const { wssEnabled, rpcFallbackEnabled, toggleWssEnabled, toggleRpcFallbackEnabled } =
    useRpcLiveFeed();
  const [logs, setLogs] = useState<NodeFeedLogEntry[]>([]);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/system-control", { cache: "no-store" });
      const json = (await res.json()) as { logs?: NodeFeedLogEntry[] };
      if (res.ok && json.logs) setLogs(json.logs);
    } catch {
      /* panel tetap menampilkan sakelar */
    }
  }, []);

  useEffect(() => {
    void loadLogs();
    const id = window.setInterval(() => void loadLogs(), 2500);
    return () => window.clearInterval(id);
  }, [loadLogs, wssEnabled, rpcFallbackEnabled]);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/80">
          System Control
        </p>
        <h2 className="mt-1 text-lg font-black tracking-wide text-slate-100">Koneksi Node WSS / RPC</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Sakelar global Mode Publik vs Mode Hemat. ON = seluruh jaringan yang ber-toggle ON
          menerima WSS/RPC bersamaan. OFF = hanya jaringan yang sedang dipilih di scanner
          (hemat kuota).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="theme-panel rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Radio
                className={`mt-0.5 h-5 w-5 shrink-0 ${wssEnabled ? "text-emerald-400" : "text-red-400"}`}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusDot on={wssEnabled} />
                  <h3 className="text-sm font-bold uppercase tracking-wide">WSS Node</h3>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  {wssEnabled
                    ? "Mode Publik — WSS newHeads di semua jaringan yang ON."
                    : "Mode Hemat — WSS hanya di jaringan scanner yang sedang dipilih."}
                </p>
              </div>
            </div>
            <FeedSwitch on={wssEnabled} label="WSS Node" onToggle={toggleWssEnabled} />
          </div>
          <p
            className={`rounded-xl border px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wide ${
              wssEnabled
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}
          >
            {wssEnabled ? "Mode Publik · semua jaringan ON" : "Mode Hemat · rantai terpilih saja"}
          </p>
        </article>

        <article className="theme-panel rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Server
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  rpcFallbackEnabled ? "text-emerald-400" : "text-red-400"
                }`}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusDot on={rpcFallbackEnabled} />
                  <h3 className="text-sm font-bold uppercase tracking-wide">RPC Fallback</h3>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  {rpcFallbackEnabled
                    ? "Mode Publik — polling HTTP head di semua jaringan yang ON."
                    : "Mode Hemat — HTTP RPC hanya di jaringan scanner yang sedang dipilih."}
                </p>
              </div>
            </div>
            <FeedSwitch
              on={rpcFallbackEnabled}
              label="RPC Fallback"
              onToggle={toggleRpcFallbackEnabled}
            />
          </div>
          <p
            className={`rounded-xl border px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wide ${
              rpcFallbackEnabled
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}
          >
            {rpcFallbackEnabled ? "Mode Publik · semua jaringan ON" : "Mode Hemat · rantai terpilih saja"}
          </p>
        </article>
      </div>

      <div className="theme-panel rounded-2xl overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-bold tracking-wide">Log status koneksi</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Jejak ON/OFF Mode Publik (WSS/RPC) dan toggle per jaringan.
          </p>
        </div>
        <div className="touch-scroll">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 font-semibold">Waktu</th>
                <th className="px-3 py-3 font-semibold">Kanal</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Pesan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    Belum ada perubahan sakelar. Toggle WSS atau RPC untuk merekam log.
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">
                      {entry.at.replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-3 py-2 font-bold uppercase tracking-wide text-amber-300/90">
                      {entry.channel === "wss" ? "WSS Node" : "RPC Fallback"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          entry.enabled
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-red-500/40 bg-red-500/10 text-red-300"
                        }`}
                      >
                        <StatusDot on={entry.enabled} />
                        {entry.enabled ? "On" : "Off"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{entry.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
