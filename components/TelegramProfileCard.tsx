"use client";

import { useEffect } from "react";
import { LoaderCircle, Send, Wallet } from "lucide-react";
import { useTelegram } from "@/hooks/useTelegram";
import { useNetwork } from "@/context/NetworkContext";
import { useWallet } from "@/context/WalletContext";

const TELEGRAM_BOT = "@MEV_Arbitrase_Bot";

export default function TelegramProfileCard({ className = "" }: { className?: string }) {
  const { webApp, user, ready, expand } = useTelegram();
  const { chain } = useNetwork();
  const {
    address,
    shortAddress,
    isConnected,
    isConnecting,
    providerAvailable,
    connect,
  } = useWallet();

  useEffect(() => {
    if (!webApp) return;
    ready();
    expand();
  }, [webApp, ready, expand]);

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ")
    : "";

  return (
    <section
      className={`theme-panel flex h-full min-h-0 w-full flex-col rounded-2xl border border-slate-800/80 p-3.5 sm:p-4 space-y-3 transition-colors duration-200 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl border border-sky-500/30 bg-slate-950 flex items-center justify-center shrink-0">
            <Send className="w-4 h-4 text-sky-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold uppercase tracking-wide">Telegram Mini App</h2>
            {user ? (
              <div className="mt-1 space-y-0.5">
                <p className="text-base font-semibold tracking-tight truncate">{displayName || "Pengguna Telegram"}</p>
                <p className="text-[12px] font-mono text-sky-300">
                  {user.username ? `@${user.username}` : "Username tidak disetel"}
                </p>
                <p className="text-[11px] font-mono text-slate-500">ID {user.id}</p>
              </div>
            ) : (
              <p className="mt-1 text-[12px] text-slate-400 leading-relaxed max-w-xl">
                Buka lewat Telegram Bot {TELEGRAM_BOT} untuk pengalaman mobile-first yang optimal.
              </p>
            )}
          </div>
        </div>
        {user ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Telegram Web App Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-slate-700 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide text-slate-500">
            Browser
          </span>
        )}
      </div>

      <div className="mt-auto rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Wallet Authorization Status</p>
        {isConnected && address ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-sm font-semibold text-amber-300">{shortAddress}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{chain.shortLabel}</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">
              Connected
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-slate-400">
              {providerAvailable
                ? "Dompet belum terhubung. Pilih MetaMask, Coinbase, atau dompet lain di modal."
                : "Dompet belum terhubung. Buka modal Connect Wallet untuk pindai QR WalletConnect."}
            </p>
            <button
              type="button"
              onClick={() => void connect()}
              disabled={isConnecting}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isConnecting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wallet className="h-3.5 w-3.5" />
              )}
              Connect Wallet
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
