"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { affiliateLinkForUsername, formatUsd } from "@/lib/user-dashboard";

export default function AffiliatePanel() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const link = useMemo(() => (user ? affiliateLinkForUsername(user.username) : ""), [user]);

  if (!user) return null;

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Bagikan tautan referral. Saldo affiliate adalah akumulasi komisi yang tercatat di akun ini.
      </p>
      <div className="rounded-xl border border-cyan-500/20 bg-black/40 px-4 py-4">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">Saldo Affiliate</p>
        <p className="mt-1 font-mono text-xl font-bold tabular-nums text-cyan-300">
          {formatUsd(user.affiliateBalanceUsd)}
        </p>
      </div>
      <div className="theme-panel rounded-2xl p-4 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide">
          <Link2 className="w-4 h-4 text-amber-400" />
          Link Affiliate
        </h3>
        <p className="font-mono text-xs text-slate-300 break-all rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5">
          {link}
        </p>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Tautan disalin" : "Salin tautan"}
        </button>
      </div>
    </div>
  );
}
