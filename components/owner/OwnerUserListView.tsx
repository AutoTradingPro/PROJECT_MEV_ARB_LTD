"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import OwnerUserTable from "@/components/owner/OwnerUserTable";
import { fetchOwnerUsers, patchOwnerUser } from "@/lib/users/client";
import {
  USER_LIST_FILTERS,
  type OwnerUser,
  type OwnerUserListFilter,
  type OwnerUserTier,
} from "@/lib/owner/types";

const POLL_MS = 2500;

export default function OwnerUserListView() {
  const [filter, setFilter] = useState<OwnerUserListFilter>("all");
  const [users, setUsers] = useState<OwnerUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchOwnerUsers();
      setUsers(next);
      setError(null);
      setLive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat user.");
      setLive(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const rows = useMemo(() => {
    if (filter === "all") return users;
    if (filter === "staking") return users.filter((user) => user.stakingActive);
    if (filter === "suspended") return users.filter((user) => user.suspended);
    if (filter === "free") return users.filter((user) => user.tier === "free");
    return users.filter((user) => user.tier === filter);
  }, [filter, users]);

  const changeTier = async (user: OwnerUser, tier: OwnerUserTier) => {
    if (user.tier === tier) return;
    setBusyId(user.id);
    setActionError(null);
    try {
      const saved = await patchOwnerUser(user.username, { tier });
      if (saved) {
        setUsers((current) => current.map((row) => (row.id === saved.id ? saved : row)));
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal mengubah tier.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleSuspend = async (user: OwnerUser) => {
    const next = !user.suspended;
    const ok = window.confirm(
      next
        ? `Suspend darurat ${user.username}? Eksekusi bot akun ini akan ditahan.`
        : `Unsuspend ${user.username} dan izinkan eksekusi kembali?`
    );
    if (!ok) return;
    setBusyId(user.id);
    setActionError(null);
    try {
      const saved = await patchOwnerUser(user.username, { suspended: next });
      if (saved) {
        setUsers((current) => current.map((row) => (row.id === saved.id ? saved : row)));
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal mengubah status suspend.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black tracking-wide text-slate-100">User List</h1>
        <p className="mt-1 text-sm text-slate-400">
          Panel pengguna global tersinkron dengan <span className="font-mono text-slate-300">/api/users</span>.
          Ubah tier Free/Pro dan suspend darurat tanpa meninggalkan Dashboard Owner.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {USER_LIST_FILTERS.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide cursor-pointer transition-colors ${
                active
                  ? "border-amber-500/50 bg-amber-400/15 text-amber-300"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="theme-panel rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-mono uppercase tracking-wide text-slate-500">
            {rows.length} user
          </p>
          <p className="text-[11px] text-slate-500">
            {live ? "Live · sinkron registrasi dApp" : "Menghubungkan…"}
          </p>
        </div>
        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}
        {actionError ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {actionError}
          </p>
        ) : null}
        <OwnerUserTable
          users={rows}
          busyId={busyId}
          onChangeTier={(user, tier) => void changeTier(user, tier)}
          onToggleSuspend={(user) => void toggleSuspend(user)}
        />
      </div>
    </div>
  );
}
