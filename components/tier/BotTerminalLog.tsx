"use client";

import { useEffect, useRef } from "react";
import { Terminal, Trash2 } from "lucide-react";
import { levelClass, type TerminalEntry, type TerminalTokenTone } from "@/hooks/useBotTerminal";

function dumpToneClass(tone: TerminalTokenTone): string {
  switch (tone) {
    case "string":
      return "text-green-400";
    case "bigint":
      return "text-yellow-300";
    case "number":
      return "text-yellow-200";
    case "key":
      return "text-slate-300";
    case "ident":
      return "text-slate-200";
    case "undef":
      return "text-slate-500";
    default:
      return "text-slate-500";
  }
}

interface BotTerminalLogProps {
  entries: TerminalEntry[];
  scannerEnabled: boolean;
  onClear: () => void;
  emptyHint?: string;
}

export default function BotTerminalLog({
  entries,
  scannerEnabled,
  onClear,
  emptyHint,
}: BotTerminalLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-wide">Terminal Log</span>
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
              scannerEnabled
                ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                : "text-slate-500 border-slate-700"
            }`}
          >
            {scannerEnabled ? "AUTO" : "PAUSED"}
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-slate-500 hover:text-slate-300 p-1 rounded cursor-pointer"
          title="Bersihkan log"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="h-72 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-0.5 bg-black"
      >
        {entries.length === 0 && (
          <p className="text-slate-600">
            {emptyHint ??
              (scannerEnabled
                ? "Menunggu siklus scan berikutnya…"
                : "Aktifkan Scanner DEX untuk log pemindaian, atau tekan Execute di mode Free untuk hash on-chain.")}
          </p>
        )}
        {entries.map((entry) =>
          entry.dump && entry.tokens ? (
            <div key={entry.id} className="whitespace-pre font-mono leading-[1.45]">
              {entry.tokens.map((token, i) => (
                <span key={`${entry.id}-${i}`} className={dumpToneClass(token.tone)}>
                  {token.text}
                </span>
              ))}
            </div>
          ) : (
            <div key={entry.id} className="flex gap-2">
              {!/^\s*\[\d{2}[.:]\d{2}[.:]\d{2}\]/.test(entry.message) && (
                <span className="text-slate-600 shrink-0 tabular-nums">[{entry.at}]</span>
              )}
              <span className={levelClass(entry.level)}>
                {entry.message}
                {entry.href && (
                  <>
                    {" "}
                    <a
                      href={entry.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
                    >
                      {entry.hrefLabel || "BSCScan"}
                    </a>
                  </>
                )}
              </span>
            </div>
          )
        )}
        {scannerEnabled && (
          <span className="inline-block w-2 h-4 bg-emerald-400/80 animate-pulse ml-12" aria-hidden />
        )}
      </div>
    </div>
  );
}
