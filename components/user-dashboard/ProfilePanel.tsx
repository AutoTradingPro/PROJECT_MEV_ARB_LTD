"use client";

import { Copy, Check, Send } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTelegram } from "@/hooks/useTelegram";
import { useTier } from "@/context/TierContext";
import { useWallet } from "@/context/WalletContext";
import { patchOwnerUser } from "@/lib/users/client";
import ConnectTelegramModal from "@/components/user-dashboard/ConnectTelegramModal";

function shortenWallet(wallet: string): string {
  if (wallet.length < 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export default function ProfilePanel() {
  const { user, patchUser } = useAuth();
  const { isPro } = useTier();
  const { address, isConnected } = useWallet();
  const { user: telegramUser } = useTelegram();
  const [copied, setCopied] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  if (!user) return null;

  const telegramId = user.telegramId || (telegramUser?.id ? String(telegramUser.id) : "");
  const telegramUsername = user.telegramUsername || telegramUser?.username;
  const telegramConnected = Boolean(telegramId || telegramUsername);
  const walletLabel = isConnected && address ? address : "Belum terhubung";

  const copyWallet = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  const saveTelegram = async (input: { telegramId: string; telegramUsername?: string }) => {
    const saved = await patchOwnerUser(user.username, {
      telegramId: input.telegramId,
      telegramUsername: input.telegramUsername,
    });
    patchUser({
      telegramId: saved?.telegramId ?? input.telegramId,
      telegramUsername: saved?.telegramUsername ?? input.telegramUsername,
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Informasi akun yang dipakai di portal MEV ARB.</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="theme-panel-muted rounded-xl px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">Username</dt>
          <dd className="mt-1 font-semibold text-slate-100">{user.username}</dd>
        </div>
        <div className="theme-panel-muted rounded-xl px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">Email</dt>
          <dd className="mt-1 font-mono text-sm text-slate-200 break-all">{user.email}</dd>
        </div>
        <div className="theme-panel-muted rounded-xl px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">Status Tier</dt>
          <dd className="mt-1">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isPro
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-slate-600 bg-slate-800/80 text-slate-300"
              }`}
            >
              {isPro ? "Pro" : "Free"}
            </span>
          </dd>
        </div>
        <div className="theme-panel-muted rounded-xl px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">Telegram ID</dt>
          <dd className="mt-1 space-y-2">
            {telegramConnected ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-sky-300">
                  {telegramId ? `TG ${telegramId}` : ""}
                  {telegramId && telegramUsername ? " · " : ""}
                  {telegramUsername ? `@${telegramUsername}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setConnectOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Ubah
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConnectOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-300 hover:bg-sky-500/20 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Hubungkan Telegram
              </button>
            )}
          </dd>
        </div>
        <div className="theme-panel-muted rounded-xl px-4 py-3 sm:col-span-2">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">ID Wallet</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-amber-300 break-all" title={isConnected ? address : undefined}>
              {isConnected && address ? shortenWallet(address) : walletLabel}
            </span>
            {isConnected && address ? (
              <button
                type="button"
                onClick={() => void copyWallet()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? "Disalin" : "Salin"}
              </button>
            ) : null}
          </dd>
        </div>
      </dl>

      <ConnectTelegramModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onSave={saveTelegram}
        initialId={telegramId}
        initialUsername={telegramUsername}
      />
    </div>
  );
}
