"use client";

import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";

export type TxNotifyTone = "success" | "error" | "info";

export interface TxNotify {
  id: string;
  tone: TxNotifyTone;
  title: string;
  message: string;
  href?: string;
  linkLabel?: string;
}

interface TxNotifyToastProps {
  notify: TxNotify | null;
  onDismiss: () => void;
}

const toneClass: Record<TxNotifyTone, string> = {
  success: "border-emerald-500/40 bg-emerald-950/90 text-emerald-100",
  error: "border-red-500/40 bg-red-950/90 text-red-100",
  info: "border-cyan-500/40 bg-slate-900/95 text-slate-100",
};

export default function TxNotifyToast({ notify, onDismiss }: TxNotifyToastProps) {
  useEffect(() => {
    if (!notify) return;
    const ms = notify.tone === "error" ? 16000 : 12000;
    const id = window.setTimeout(onDismiss, ms);
    return () => window.clearTimeout(id);
  }, [notify, onDismiss]);

  if (!notify) return null;

  return (
    <div
      role="status"
      className={`fixed bottom-5 right-4 z-[200] max-w-md w-[calc(100%-2rem)] sm:w-[28rem] rounded-xl border shadow-2xl px-4 py-3 ${toneClass[notify.tone]}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wide">{notify.title}</p>
          <p className="text-[11px] font-mono mt-1 break-all opacity-90">{notify.message}</p>
          {notify.href && (
            <a
              href={notify.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold underline underline-offset-2 hover:opacity-80"
            >
              {notify.linkLabel || "Buka explorer"}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded hover:bg-white/10 cursor-pointer"
          aria-label="Tutup notifikasi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
