"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal, Trash2 } from "lucide-react";
import type { ServerLogEntry, ServerLogLevel } from "@/lib/bot/serverLog";

function levelClass(level: ServerLogLevel): string {
  switch (level) {
    case "scan":
      return "text-cyan-400";
    case "exec":
      return "text-amber-300";
    case "profit":
      return "text-emerald-300 font-bold";
    case "warn":
      return "text-amber-400";
    case "error":
      return "text-red-400";
    default:
      return "text-slate-300";
  }
}

export default function OwnerServerTerminal() {
  const [logs, setLogs] = useState<ServerLogEntry[]>([]);
  const [live, setLive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/logs", { cache: "no-store" });
      const json = (await res.json()) as { logs?: ServerLogEntry[] };
      if (res.ok && json.logs) {
        setLogs(json.logs);
        setLive(true);
      }
    } catch {
      setLive(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 1500);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const clear = async () => {
    await fetch("/api/owner/logs", { method: "DELETE" });
    await load();
  };

  return (
    <section className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-wide">Live Raw Terminal Logs</span>
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
              live
                ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                : "text-slate-500 border-slate-700"
            }`}
          >
            {live ? "SERVER" : "OFFLINE"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void clear()}
          className="text-slate-500 hover:text-slate-300 p-1 rounded cursor-pointer"
          title="Bersihkan log"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-0.5 bg-black"
      >
        {logs.length === 0 ? (
          <p className="text-slate-600">
            Menunggu jejak server — eksekusi, kill switch, dan aksi user owner muncul di sini.
          </p>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} className="flex gap-2">
              <span className="text-slate-600 shrink-0 tabular-nums">
                [{entry.at.replace("T", " ").slice(11, 19)}]
              </span>
              <span className="text-slate-500 shrink-0 uppercase">{entry.source}</span>
              <span className={levelClass(entry.level)}>{entry.message}</span>
            </div>
          ))
        )}
        {live ? (
          <span className="inline-block w-2 h-4 bg-emerald-400/80 animate-pulse ml-12" aria-hidden />
        ) : null}
      </div>
    </section>
  );
}
