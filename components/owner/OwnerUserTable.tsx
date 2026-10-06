"use client";

import OwnerTierBadge from "@/components/owner/OwnerTierBadge";
import { OWNER_TIER_OPTIONS, type OwnerUser, type OwnerUserTier } from "@/lib/owner/types";

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortenWallet(wallet: string): string {
  if (!wallet) return "—";
  if (wallet.length < 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

interface OwnerUserTableProps {
  users: OwnerUser[];
  busyId?: string | null;
  onChangeTier: (user: OwnerUser, tier: OwnerUserTier) => void;
  onToggleSuspend: (user: OwnerUser) => void;
}

export default function OwnerUserTable({
  users,
  busyId,
  onChangeTier,
  onToggleSuspend,
}: OwnerUserTableProps) {
  return (
    <div className="touch-scroll rounded-2xl border border-slate-800">
      <table className="w-full min-w-[1480px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] uppercase tracking-wide text-slate-500">
            <th className="px-3 py-3 w-12 font-semibold">No</th>
            <th className="px-3 py-3 font-semibold">Username</th>
            <th className="px-3 py-3 font-semibold">Email</th>
            <th className="px-3 py-3 font-semibold">Wallet / Telegram ID</th>
            <th className="px-3 py-3 text-right font-semibold">Saldo Utama</th>
            <th className="px-3 py-3 text-right font-semibold">Saldo Affiliate</th>
            <th className="px-3 py-3 text-right font-semibold">Jumlah Staked</th>
            <th className="px-3 py-3 text-right font-semibold">Status Staking</th>
            <th className="px-3 py-3 font-semibold">Tier Free / Pro</th>
            <th className="px-3 py-3 text-right font-semibold">Suspend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {users.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-slate-500 font-sans">
                Tidak ada user pada filter ini.
              </td>
            </tr>
          ) : (
            users.map((user, index) => {
              const busy = busyId === user.id;
              const suspended = Boolean(user.suspended);
              return (
                <tr
                  key={user.id}
                  className={`transition-colors ${
                    suspended ? "bg-red-950/20" : "hover:bg-slate-800/40"
                  }`}
                >
                  <td className="px-3 py-3 font-mono tabular-nums text-slate-500">{index + 1}</td>
                  <td className="px-3 py-3">
                    <span className="font-semibold text-slate-100">{user.username}</span>
                    {suspended ? (
                      <span className="ml-2 inline-flex rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-red-300">
                        Suspended
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-mono text-[11px] text-slate-300 break-all">{user.email}</span>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-mono text-[11px] text-amber-300/90" title={user.wallet}>
                      {shortenWallet(user.wallet)}
                    </p>
                    <p className="font-mono text-[11px] text-sky-400/90 mt-0.5">
                      {user.telegramId
                        ? `TG ${user.telegramId}${user.telegramUsername ? ` · @${user.telegramUsername}` : ""}`
                        : "Telegram —"}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-emerald-400">
                    {formatUsd(user.mainBalanceUsd)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-cyan-300">
                    {formatUsd(user.affiliateBalanceUsd)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-amber-300">
                    {formatUsd(user.stakedUsd)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        user.stakingActive
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                          : "border-slate-600 bg-slate-800/80 text-slate-400"
                      }`}
                    >
                      {user.stakingActive ? "Aktif" : "Tidak"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <OwnerTierBadge tier={user.tier} />
                      <select
                        value={user.tier}
                        disabled={busy}
                        onChange={(event) =>
                          onChangeTier(user, event.target.value as OwnerUserTier)
                        }
                        className="theme-input max-w-[7.5rem] rounded-lg px-2 py-1 text-[11px] font-semibold"
                      >
                        {OWNER_TIER_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onToggleSuspend(user)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide cursor-pointer disabled:opacity-40 ${
                        suspended
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                          : "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                      }`}
                    >
                      {suspended ? "Unsuspend" : "Suspend"}
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
