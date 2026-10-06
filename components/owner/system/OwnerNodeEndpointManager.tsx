"use client";

import { type ChainId, getChain } from "@/lib/chain/networks";
import { OWNER_NODE_CHAIN_IDS, type OwnerNodeChainId } from "@/lib/owner/ownerNodeChains";
import type { ChainNodeConfig } from "@/lib/owner/nodeEndpoints";
import type { NodePingSample } from "@/lib/owner/nodePing";
import {
  FLASH_LOAN_PLATFORMS,
  platformSupportsChain,
} from "@/lib/bot/flashLoanProviders";
import { useRpcLiveFeed } from "@/context/RpcLiveFeedContext";
import { useCallback, useEffect, useState } from "react";
import { Activity, Cable, Save } from "lucide-react";

const CARD_CHAINS: OwnerNodeChainId[] = [...OWNER_NODE_CHAIN_IDS];

const CARD_TITLE: Partial<Record<OwnerNodeChainId, string>> = {
  bsc: "BNB Chain",
  solana: "Solana",
};

function emptyOwnerNodes(): Record<OwnerNodeChainId, ChainNodeConfig> {
  return Object.fromEntries(
    CARD_CHAINS.map((id) => {
      const chain = getChain(id);
      return [
        id,
        {
          chainId: id,
          primaryRpc: chain.rpcUrl,
          backupRpc: "",
          primaryWss: chain.wsUrl,
          backupWss: "",
          lastHealthyRpc: "",
          lastHealthyWss: "",
        },
      ];
    })
  ) as Record<OwnerNodeChainId, ChainNodeConfig>;
}

function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.slice(0, 40);
  }
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  switchOn,
  switchLabel,
  onSwitch,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  disabled?: boolean;
  switchOn?: boolean;
  switchLabel?: string;
  onSwitch?: () => void;
}) {
  return (
    <div className="block min-w-0">
      <span className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
        {onSwitch && switchLabel ? (
          <ChainSwitch on={Boolean(switchOn)} label={switchLabel} onToggle={onSwitch} />
        ) : null}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 font-mono text-[11px] text-slate-200 outline-none focus:border-amber-500/40 disabled:opacity-50"
      />
    </div>
  );
}

function ChainSwitch({
  on,
  label,
  onToggle,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="flex items-center gap-2 shrink-0 cursor-pointer"
    >
      <span className={`text-[11px] font-mono font-bold uppercase ${on ? "text-emerald-400" : "text-red-400"}`}>
        {on ? "On" : "Off"}
      </span>
      <span
        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-colors ${
          on ? "border-emerald-500/50 bg-emerald-500/80" : "border-red-500/40 bg-red-950/80"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

export default function OwnerNodeEndpointManager() {
  const {
    chains,
    setChainEnabled,
    wssEnabled,
    rpcFallbackEnabled,
    rpcPrimary,
    rpcBackup,
    setPrimaryRpcEnabled,
    setBackupRpcEnabled,
  } = useRpcLiveFeed();
  const [ready, setReady] = useState(false);
  const [nodes, setNodes] = useState<Record<OwnerNodeChainId, ChainNodeConfig>>(emptyOwnerNodes);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [samples, setSamples] = useState<NodePingSample[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/owner/nodes", { cache: "no-store" });
      const data = (await response.json()) as { nodes?: Record<ChainId, ChainNodeConfig> };
      if (response.ok && data.nodes) {
        setNodes((prev) => {
          const next = { ...prev };
          for (const id of CARD_CHAINS) {
            if (data.nodes?.[id]) next[id] = data.nodes[id];
          }
          return next;
        });
      }
    } catch {
      /* tetap tampilkan default */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(chainId: OwnerNodeChainId, key: keyof ChainNodeConfig, value: string) {
    setNodes((prev) => ({
      ...prev,
      [chainId]: { ...prev[chainId], [key]: value },
    }));
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/owner/nodes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nodes }),
      });
      const data = (await response.json()) as { error?: string; nodes?: Record<ChainId, ChainNodeConfig> };
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan.");
      if (data.nodes) {
        setNodes((prev) => {
          const next = { ...prev };
          for (const id of CARD_CHAINS) {
            if (data.nodes?.[id]) next[id] = data.nodes[id];
          }
          return next;
        });
      }
      setNotice("Konfigurasi FlashLoan & RPC Provider disimpan. Bot memakai Primary lalu Backup.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Gagal menyimpan konfigurasi.");
    } finally {
      setSaving(false);
    }
  }

  async function pingAll() {
    setPinging(true);
    setNotice(null);
    try {
      const response = await fetch("/api/owner/nodes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = (await response.json()) as { samples?: NodePingSample[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Ping gagal.");
      setSamples(data.samples ?? []);
      const ok = (data.samples ?? []).filter((sample) => sample.ok).length;
      const fail = (data.samples ?? []).length - ok;
      setNotice(`Ping selesai (hanya jaringan ON): ${ok} OK · ${fail} gagal.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ping gagal.");
    } finally {
      setPinging(false);
    }
  }

  if (!ready) {
    return (
      <section className="theme-panel rounded-2xl p-5 text-sm text-slate-500">
        Memuat konfigurasi FlashLoan & RPC Provider…
      </section>
    );
  }

  const masterMode =
    wssEnabled || rpcFallbackEnabled
      ? "Mode Publik — jaringan ON di bawah aktif bersamaan."
      : "Mode Hemat — bot hanya memakai jaringan yang sedang dipilih di scanner.";

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/80">FlashLoan & RPC Provider</p>
        <h2 className="mt-1 text-lg font-black tracking-wide text-slate-100">
          Ethereum · Polygon · Arbitrum · Optimism · Avalanche · Solana · Base · BNB · Monad · Linea
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Kartu per jaringan: Primary RPC, WSS Stream, Backup RPC. Toggle ON/OFF manual — tidak
          terikat FlashLoan Provider di Mev Arb. Matikan jaringan yang tidak dipakai untuk hemat
          kuota. {masterMode}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-950 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Menyimpan…" : "Simpan Konfigurasi Node"}
        </button>
        <button
          type="button"
          onClick={() => void pingAll()}
          disabled={pinging}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 disabled:opacity-50"
        >
          <Activity className="h-3.5 w-3.5" />
          {pinging ? "Menguji…" : "Test Ping / Connection"}
        </button>
      </div>

      {notice ? (
        <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">{notice}</p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {CARD_CHAINS.map((id) => {
          const chain = getChain(id);
          const row = nodes[id];
          if (!row) return null;
          const on = chains[id] === true;
          const primaryOn = rpcPrimary[id] === true;
          const backupOn = rpcBackup[id] === true;
          const title = CARD_TITLE[id] ?? chain.label;
          const flash = FLASH_LOAN_PLATFORMS.filter((item) => platformSupportsChain(item, id))
            .map((item) => item.label)
            .slice(0, 4)
            .join(" · ");
          return (
            <article
              key={id}
              className={`theme-panel rounded-2xl p-4 sm:p-5 space-y-4 ${
                on ? "" : "opacity-70"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Cable className={`h-4 w-4 ${on ? "text-amber-400" : "text-slate-500"}`} />
                  <div>
                    <h3 className="text-sm font-black tracking-wide text-slate-100">{title}</h3>
                    <p className="text-[11px] text-slate-500">
                      {chain.shortLabel} · {chain.nativeSymbol}
                    </p>
                  </div>
                </div>
                <ChainSwitch
                  on={on}
                  label={`${title} jaringan`}
                  onToggle={() => setChainEnabled(id, !on)}
                />
              </div>
              <p className="rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-[11px] text-slate-400">
                FlashLoan: {flash || "—"}
              </p>
              <div className="grid gap-3">
                <Field
                  label="Primary RPC"
                  value={row.primaryRpc}
                  onChange={(value) => patch(id, "primaryRpc", value)}
                  placeholder="https://…"
                  disabled={!on || !primaryOn}
                  switchOn={primaryOn}
                  switchLabel={`${title} Primary RPC`}
                  onSwitch={() => on && setPrimaryRpcEnabled(id, !primaryOn)}
                />
                <Field
                  label="WSS Stream"
                  value={row.primaryWss}
                  onChange={(value) => patch(id, "primaryWss", value)}
                  placeholder="wss://…"
                  disabled={!on || !primaryOn}
                />
                <Field
                  label="Backup RPC (Fallback)"
                  value={row.backupRpc}
                  onChange={(value) => patch(id, "backupRpc", value)}
                  placeholder="https://… (cadangan)"
                  disabled={!on || !backupOn}
                  switchOn={backupOn}
                  switchLabel={`${title} Backup RPC`}
                  onSwitch={() => on && setBackupRpcEnabled(id, !backupOn)}
                />
              </div>
              {!primaryOn && backupOn ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                  Mode cadangan saja — scan & monitor harga/spread memakai Backup RPC, Primary OFF.
                </p>
              ) : null}
              {row.lastHealthyRpc ? (
                <p className="font-mono text-[10px] text-emerald-400/90">RPC aktif: {hostLabel(row.lastHealthyRpc)}</p>
              ) : (
                <p className="text-[10px] text-slate-600">
                  {on ? "Belum ada heartbeat RPC." : "Jaringan OFF — tidak ada request provider."}
                </p>
              )}
            </article>
          );
        })}
      </div>

      <div className="theme-panel overflow-hidden rounded-2xl">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-bold tracking-wide">Hasil ping blok & gas</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Hanya jaringan yang ON dan diizinkan Mode Publik/Hemat. EVM: blockNumber + gasPrice ·
            Solana: getSlot.
          </p>
        </div>
        <div className="touch-scroll">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 font-semibold">Jaringan</th>
                <th className="px-3 py-3 font-semibold">Peran</th>
                <th className="px-3 py-3 font-semibold">Jenis</th>
                <th className="px-3 py-3 font-semibold">Blok / slot</th>
                <th className="px-3 py-3 font-semibold">Gas</th>
                <th className="px-3 py-3 font-semibold">Latency</th>
                <th className="px-3 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {samples.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Jalankan Test Ping / Connection untuk memverifikasi node.
                  </td>
                </tr>
              ) : (
                samples.map((sample, index) => {
                  const chain = getChain(sample.chainId);
                  return (
                    <tr key={`${sample.chainId}-${sample.kind}-${sample.role}-${index}`}>
                      <td className="px-3 py-2 font-semibold text-slate-200">{chain.shortLabel}</td>
                      <td className="px-3 py-2 uppercase text-amber-300/90">{sample.role}</td>
                      <td className="px-3 py-2 font-mono uppercase text-slate-400">{sample.kind}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{sample.blockLabel ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{sample.gasLabel ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{sample.latencyMs} ms</td>
                      <td className="px-3 py-2">
                        {sample.ok ? (
                          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                            OK
                          </span>
                        ) : (
                          <span className="text-[11px] text-red-300" title={sample.error}>
                            {sample.error || "Gagal"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
