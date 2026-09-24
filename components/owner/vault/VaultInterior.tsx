"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Landmark, Loader2, Lock, RefreshCw, Wallet } from "lucide-react";
import { CHAINS, type ChainId } from "@/lib/chain/networks";
import { formatVaultError } from "@/lib/vault/client";
import { withdrawOperationalNative, withdrawVaultNative } from "@/lib/owner/vaultActions";
import type { AddressBalance } from "@/lib/owner/vaultBalanceTypes";
import type { VaultRegistry } from "@/lib/owner/vaultRegistry";

type VaultTab = "contracts" | "wallets";

interface VaultInteriorProps {
  remainingMs: number;
  registry: VaultRegistry;
  vaultBalances: AddressBalance[];
  walletBalances: AddressBalance[];
  loadingBalances: boolean;
  saving: boolean;
  onLock: () => void;
  onRefresh: () => void;
  onSave: (patch: {
    vaultContracts?: Partial<Record<ChainId, string>>;
    operationalWallets?: Partial<Record<ChainId, string>>;
  }) => Promise<void>;
}

function formatRemain(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function balanceFor(list: AddressBalance[], chainId: ChainId): AddressBalance | undefined {
  return list.find((item) => item.chainId === chainId);
}

export default function VaultInterior({
  remainingMs,
  registry,
  vaultBalances,
  walletBalances,
  loadingBalances,
  saving,
  onLock,
  onRefresh,
  onSave,
}: VaultInteriorProps) {
  const [tab, setTab] = useState<VaultTab>("contracts");
  const [drafts, setDrafts] = useState<VaultRegistry>(registry);
  const [vaultAmounts, setVaultAmounts] = useState<Record<ChainId, string>>(
    () => Object.fromEntries(CHAINS.map((c) => [c.id, ""])) as Record<ChainId, string>
  );
  const [walletAmounts, setWalletAmounts] = useState<Record<ChainId, string>>(
    () => Object.fromEntries(CHAINS.map((c) => [c.id, ""])) as Record<ChainId, string>
  );
  const [destinations, setDestinations] = useState<Record<ChainId, string>>(
    () => Object.fromEntries(CHAINS.map((c) => [c.id, ""])) as Record<ChainId, string>
  );
  const [busyChain, setBusyChain] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(registry);
  }, [registry]);

  const title = useMemo(
    () => (tab === "contracts" ? "Smart Contract Vault Management" : "Operational Wallets Management"),
    [tab]
  );

  function updateDraft(kind: "vaultContracts" | "operationalWallets", chainId: ChainId, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], [chainId]: value },
    }));
  }

  async function saveRow(kind: "vaultContracts" | "operationalWallets", chainId: ChainId) {
    setNotice(null);
    try {
      await onSave({ [kind]: { [chainId]: drafts[kind][chainId] } });
      setNotice("Alamat disimpan.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Gagal menyimpan alamat.");
    }
  }

  async function onWithdrawVault(chainId: ChainId) {
    setNotice(null);
    const address = drafts.vaultContracts[chainId]?.trim() || registry.vaultContracts[chainId];
    if (!address) {
      setNotice("Isi dan simpan alamat kontrak vault terlebih dahulu.");
      return;
    }
    setBusyChain(`vault-${chainId}`);
    try {
      const hash = await withdrawVaultNative({
        chainId,
        vaultAddress: address,
        amount: vaultAmounts[chainId],
      });
      setNotice(`Withdraw vault terkirim: ${hash.slice(0, 10)}…`);
      onRefresh();
    } catch (error) {
      setNotice(formatVaultError(error));
    } finally {
      setBusyChain(null);
    }
  }

  async function onWithdrawWallet(chainId: ChainId) {
    setNotice(null);
    const fromAddress = drafts.operationalWallets[chainId]?.trim() || registry.operationalWallets[chainId];
    if (!fromAddress) {
      setNotice("Isi dan simpan alamat dompet operasional terlebih dahulu.");
      return;
    }
    setBusyChain(`wallet-${chainId}`);
    try {
      const hash = await withdrawOperationalNative({
        chainId,
        fromAddress,
        toAddress: destinations[chainId],
        amount: walletAmounts[chainId],
      });
      setNotice(`Withdraw wallet terkirim: ${hash.slice(0, 10)}…`);
      onRefresh();
    } catch (error) {
      setNotice(formatVaultError(error));
    } finally {
      setBusyChain(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-slate-950 via-[#1a1408] to-slate-950 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400/80">Secure Vault</p>
            <h1 className="mt-1 text-xl font-black tracking-wide text-amber-100">Brankas Owner</h1>
            <p className="mt-1 text-sm text-slate-400">
              Sesi aktif · terkunci otomatis dalam{" "}
              <span className="font-mono text-amber-300">{formatRemain(remainingMs)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loadingBalances}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-500/30 bg-black/30 px-3 py-2 text-xs font-semibold text-amber-200 disabled:opacity-50"
            >
              {loadingBalances ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Segarkan saldo
            </button>
            <button
              type="button"
              onClick={onLock}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-amber-200"
            >
              <Lock className="h-3.5 w-3.5" />
              Lock Vault
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("contracts")}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
            tab === "contracts"
              ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
              : "border-slate-800 bg-slate-950 text-slate-400"
          }`}
        >
          <Landmark className="h-4 w-4" />
          Bagian A · Contract Vault
        </button>
        <button
          type="button"
          onClick={() => setTab("wallets")}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
            tab === "wallets"
              ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
              : "border-slate-800 bg-slate-950 text-slate-400"
          }`}
        >
          <Wallet className="h-4 w-4" />
          Bagian B · Operational Wallets
        </button>
      </div>

      <section className="rounded-2xl border border-amber-500/20 bg-slate-950 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-black tracking-wide text-amber-100">{title}</h2>
        </div>
        {notice ? (
          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {notice}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-3 font-semibold">Jaringan</th>
                <th className="py-2 pr-3 font-semibold">Alamat</th>
                <th className="py-2 pr-3 font-semibold">Saldo</th>
                {tab === "wallets" ? <th className="py-2 pr-3 font-semibold">Tujuan</th> : null}
                <th className="py-2 pr-3 font-semibold">Nominal</th>
                <th className="py-2 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {CHAINS.map((chain) => {
                const kind = tab === "contracts" ? "vaultContracts" : "operationalWallets";
                const balance = balanceFor(tab === "contracts" ? vaultBalances : walletBalances, chain.id);
                const busy =
                  busyChain === `${tab === "contracts" ? "vault" : "wallet"}-${chain.id}` || saving;
                return (
                  <tr key={chain.id} className="border-b border-slate-900 align-top">
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-slate-100">{chain.shortLabel}</p>
                      <p className="text-[11px] text-slate-500">{chain.nativeSymbol}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex min-w-[280px] gap-2">
                        <input
                          value={drafts[kind][chain.id]}
                          onChange={(event) => updateDraft(kind, chain.id, event.target.value)}
                          placeholder={chain.evm ? "0x…" : "Alamat Solana"}
                          className="w-full rounded-lg border border-slate-800 bg-black/40 px-2.5 py-2 font-mono text-xs text-amber-50 outline-none focus:border-amber-500/40"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void saveRow(kind, chain.id)}
                          className="shrink-0 cursor-pointer rounded-lg border border-amber-500/30 px-2.5 py-2 text-[11px] font-semibold text-amber-200 disabled:opacity-50"
                        >
                          Simpan
                        </button>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      {loadingBalances ? (
                        <span className="text-xs text-slate-500">Memuat…</span>
                      ) : balance?.error ? (
                        <span className="text-xs text-red-300">{balance.error}</span>
                      ) : (
                        <span className="font-mono text-xs text-amber-200">{balance?.label ?? "—"}</span>
                      )}
                    </td>
                    {tab === "wallets" ? (
                      <td className="py-3 pr-3">
                        <input
                          value={destinations[chain.id]}
                          onChange={(event) =>
                            setDestinations((prev) => ({ ...prev, [chain.id]: event.target.value }))
                          }
                          placeholder="Alamat tujuan"
                          className="w-full min-w-[180px] rounded-lg border border-slate-800 bg-black/40 px-2.5 py-2 font-mono text-xs text-amber-50 outline-none focus:border-amber-500/40"
                        />
                      </td>
                    ) : null}
                    <td className="py-3 pr-3">
                      <input
                        value={tab === "contracts" ? vaultAmounts[chain.id] : walletAmounts[chain.id]}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (tab === "contracts") {
                            setVaultAmounts((prev) => ({ ...prev, [chain.id]: value }));
                          } else {
                            setWalletAmounts((prev) => ({ ...prev, [chain.id]: value }));
                          }
                        }}
                        placeholder="0.0"
                        className="w-28 rounded-lg border border-slate-800 bg-black/40 px-2.5 py-2 font-mono text-xs text-amber-50 outline-none focus:border-amber-500/40"
                      />
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          tab === "contracts" ? void onWithdrawVault(chain.id) : void onWithdrawWallet(chain.id)
                        }
                        className="cursor-pointer rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-950 disabled:opacity-50"
                      >
                        {busyChain === `${tab === "contracts" ? "vault" : "wallet"}-${chain.id}`
                          ? "Mengirim…"
                          : tab === "contracts"
                            ? "Withdraw Vault"
                            : "Withdraw Wallet"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tab === "wallets" ? (
          <p className="mt-3 text-xs text-slate-500">
            Penarikan EVM memakai MetaMask pada alamat operasional yang sama. Solana menampilkan saldo, tetapi
            withdraw on-chain belum memakai wallet adapter.
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Withdraw vault memanggil fungsi kontrak `withdraw` melalui dompet owner yang terhubung. Saldo yang
            ditampilkan adalah native token di alamat kontrak.
          </p>
        )}
      </section>
    </div>
  );
}
