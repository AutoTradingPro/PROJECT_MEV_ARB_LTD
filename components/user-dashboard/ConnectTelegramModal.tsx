"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, LoaderCircle, Send, X } from "lucide-react";

const USERINFO_BOT = "userinfobot";
const MEV_BOT = "MEV_Arbitrase_Bot";

export function parseTelegramInput(raw: string): { telegramId: string; telegramUsername: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { telegramId: "", telegramUsername: "" };
  let telegramId = "";
  let telegramUsername = "";
  for (const token of trimmed.split(/[\s,;]+/).filter(Boolean)) {
    const stripped = token.replace(/^@/, "");
    if (/^\d{5,15}$/.test(stripped)) telegramId = stripped;
    else if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(stripped)) telegramUsername = stripped;
  }
  return { telegramId, telegramUsername };
}

interface ConnectTelegramModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: { telegramId: string; telegramUsername?: string }) => Promise<void>;
  initialId?: string;
  initialUsername?: string;
}

export default function ConnectTelegramModal({
  open,
  onClose,
  onSave,
  initialId = "",
  initialUsername = "",
}: ConnectTelegramModalProps) {
  const titleId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const preset = [initialId, initialUsername ? `@${initialUsername}` : ""].filter(Boolean).join(" ");
    setValue(preset);
    setError("");
    setBusy(false);
  }, [open, initialId, initialUsername]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const parsed = parseTelegramInput(value);
    if (!parsed.telegramId && !parsed.telegramUsername) {
      setError("Masukkan User ID angka dari bot, atau username Telegram (contoh: @Mochtgi).");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        telegramId: parsed.telegramId,
        telegramUsername: parsed.telegramUsername || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifikasi gagal. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="ui-modal-root z-[120]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Tutup panduan Telegram"
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />
      <div className="relative max-h-[min(92dvh,40rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl shadow-black/50">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl border border-sky-500/30 bg-slate-950 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-sky-400" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-bold tracking-wide text-white">
                Hubungkan Telegram
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Username web dan Telegram bisa berbeda. Ambil ID asli dari bot.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form className="px-5 pb-5 pt-2 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <ol className="space-y-2 text-[12px] text-slate-300 leading-relaxed list-decimal list-inside">
            <li>
              Buka{" "}
              <a
                href={`https://t.me/${USERINFO_BOT}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-sky-300 hover:text-sky-200"
              >
                @{USERINFO_BOT}
                <ExternalLink className="w-3 h-3" />
              </a>{" "}
              lalu ketik <span className="font-mono text-slate-200">/start</span>. Bot menampilkan{" "}
              <span className="font-semibold">Id</span> (angka) dan username.
            </li>
            <li>
              Atau buka bot panduan{" "}
              <a
                href={`https://t.me/${MEV_BOT}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200"
              >
                @{MEV_BOT}
                <ExternalLink className="w-3 h-3" />
              </a>{" "}
              jika Anda memakai Mini App MEV ARB.
            </li>
            <li>Salin User ID dan/atau username, tempel di kolom bawah, lalu verifikasi.</li>
          </ol>

          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400 font-medium">Username atau Telegram ID</span>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="@Mochtgi atau 123456789"
              autoComplete="off"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-400/50 transition-colors font-mono"
            />
          </label>

          {error ? (
            <p className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400 cursor-pointer disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy ? "Menyimpan…" : "Verifikasi & Simpan"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
