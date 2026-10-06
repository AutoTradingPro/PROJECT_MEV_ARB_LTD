"use client";

import type { ConsoleLine } from "@/components/mev-core/types";

const TONE: Record<ConsoleLine["tone"], string> = {
  ok: "text-emerald-400",
  warn: "text-amber-300",
  muted: "text-slate-500",
  info: "text-blue-400",
  error: "text-red-400",
};

export default function MevCoreConsole({ lines, connected = false }: { lines: ConsoleLine[]; connected?: boolean }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-black shadow-[inset_0_0_40px_rgba(16,185,129,0.05)]">
      <div className="flex items-center justify-between border-b border-white/5 bg-[linear-gradient(90deg,#0E3A2D_0%,#123231_45%,#142632_100%)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B2C7C0]">
        Console Logs
        <span className={`font-mono normal-case tracking-normal ${connected ? "text-emerald-400" : "text-emerald-700"}`}>
          {connected ? "live · ws :4101" : "menunggu stream"}
        </span>
      </div>
      <div className="max-h-64 space-y-1 overflow-auto px-3 py-3 font-mono text-xs leading-relaxed sm:px-4 sm:text-sm">
        {lines.length === 0 ? (
          <p className="text-slate-500">Menunggu log simulasi, validasi spread, bribe, dan hasil eksekusi.</p>
        ) : null}
        {lines.map((line) => (
          <p key={line.id} className={`break-words ${TONE[line.tone]}`}>
            <span className="text-emerald-700">{line.time}</span>{" "}
            <span className="text-emerald-300">[{line.tag}]</span> {line.message}
          </p>
        ))}
      </div>
    </section>
  );
}
