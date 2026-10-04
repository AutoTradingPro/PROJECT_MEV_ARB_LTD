"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId, useConfig, useReadContract, useReadContracts, useSwitchChain } from "wagmi";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { useWriteContract } from "wagmi";
import { mevVaultAbi } from "@/lib/vault/mevVaultAbi";
import { MEV_VAULT_CHAIN_ID, MEV_VAULT_USDC, mevVaultProxy } from "@/lib/vault/mevVaultConfig";

interface VaultEventRow {
  kind: "deposit" | "withdraw" | "arb";
  user_address: string | null;
  assets: string | null;
  shares: string | null;
  profit: string | null;
  tx_hash: string;
  log_index: number;
  block_number: string;
}

function parseAmount(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return null;
  try {
    const amount = parseUnits(trimmed, decimals);
    return amount > 0n ? amount : null;
  } catch {
    return null;
  }
}

function show(raw: bigint | undefined, decimals: number): string {
  if (raw == null) return "—";
  const numeric = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(numeric)) return formatUnits(raw, decimals);
  return numeric.toLocaleString("en-US", { maximumFractionDigits: numeric >= 1 ? 4 : 6 });
}

export default function MevVaultPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const proxy = mevVaultProxy(MEV_VAULT_CHAIN_ID);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState<"approve" | "deposit" | "withdraw" | "redeem" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<VaultEventRow[]>([]);
  const [indexed, setIndexed] = useState(false);
  const [tick, setTick] = useState(0);

  const position = useReadContracts({
    allowFailure: false,
    contracts: proxy && address
      ? [
          { address: proxy, abi: mevVaultAbi, functionName: "userBalances", args: [address], chainId: MEV_VAULT_CHAIN_ID },
          { address: proxy, abi: mevVaultAbi, functionName: "assetsOf", args: [address], chainId: MEV_VAULT_CHAIN_ID },
          { address: proxy, abi: mevVaultAbi, functionName: "asset", chainId: MEV_VAULT_CHAIN_ID },
        ]
      : [],
    query: { enabled: Boolean(proxy && address) },
  });

  const shares = position.data?.[0];
  const assets = position.data?.[1];
  const asset = position.data?.[2];
  const assetIsUsdc = asset?.toLowerCase() === MEV_VAULT_USDC.toLowerCase();
  const decimalsQuery = useReadContract({
    address: MEV_VAULT_USDC,
    abi: erc20Abi,
    functionName: "decimals",
    chainId: MEV_VAULT_CHAIN_ID,
    query: { enabled: Boolean(proxy) },
  });
  const decimals = decimalsQuery.data ?? 6;
  const symbol = "USDC";
  const parsed = parseAmount(amount, decimals);
  const preview = useReadContract({
    address: proxy ?? undefined,
    abi: mevVaultAbi,
    functionName: "previewDeposit",
    args: parsed ? [parsed] : undefined,
    chainId: MEV_VAULT_CHAIN_ID,
    query: { enabled: Boolean(proxy && parsed) },
  });

  useEffect(() => {
    if (!address) return;
    let cancel = false;
    fetch(`/api/vault/activity?wallet=${address}&chainId=${MEV_VAULT_CHAIN_ID}`)
      .then((res) => res.json())
      .then((body: { indexed?: boolean; events?: VaultEventRow[] }) => {
        if (cancel) return;
        setIndexed(Boolean(body.indexed));
        setEvents(body.events ?? []);
      })
      .catch(() => {
        if (!cancel) setEvents([]);
      });
    return () => {
      cancel = true;
    };
  }, [address, tick]);

  async function ensureArbitrum() {
    if (chainId === MEV_VAULT_CHAIN_ID) return;
    await switchChainAsync({ chainId: MEV_VAULT_CHAIN_ID });
  }

  async function onDeposit() {
    if (!proxy || !address || !parsed) return;
    setError(null);
    if (asset && !assetIsUsdc) {
      setError("MevVault Arbitrum tidak memakai USDC 0xaf88…5831.");
      return;
    }
    try {
      await ensureArbitrum();
      const allowance = await readContract(config, {
        address: MEV_VAULT_USDC,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, proxy],
        chainId: MEV_VAULT_CHAIN_ID,
      });
      if (allowance < parsed) {
        setPending("approve");
        const approved = await writeContractAsync({
          address: MEV_VAULT_USDC,
          abi: erc20Abi,
          functionName: "approve",
          args: [proxy, parsed],
          chainId: MEV_VAULT_CHAIN_ID,
        });
        await waitForTransactionReceipt(config, { hash: approved });
      }
      setPending("deposit");
      const deposited = await writeContractAsync({
        address: proxy,
        abi: mevVaultAbi,
        functionName: "deposit",
        args: [parsed],
        chainId: MEV_VAULT_CHAIN_ID,
      });
      await waitForTransactionReceipt(config, { hash: deposited });
      setAmount("");
      setTick((value) => value + 1);
      void position.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit gagal.");
    } finally {
      setPending(null);
    }
  }

  async function onWithdraw(mode: "withdraw" | "redeem") {
    if (!proxy || !address) return;
    const value = mode === "redeem" ? shares : parsed;
    if (value == null || value <= 0n) return;
    setError(null);
    try {
      await ensureArbitrum();
      setPending(mode);
      const hash = await writeContractAsync({
        address: proxy,
        abi: mevVaultAbi,
        functionName: mode,
        args: [value],
        chainId: MEV_VAULT_CHAIN_ID,
      });
      await waitForTransactionReceipt(config, { hash });
      if (mode === "withdraw") setAmount("");
      setTick((value) => value + 1);
      void position.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Penarikan gagal.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="theme-panel rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide">MevVault</h2>
        <p className="text-[11px] text-slate-500">USDC · Arbitrum One · {MEV_VAULT_USDC}</p>
      </div>
      {!isConnected ? (
        <p className="text-sm text-slate-400">Hubungkan dompet untuk membaca share dan menyetor.</p>
      ) : !proxy ? (
        <p className="text-sm text-amber-300">
          Proxy MevVault Arbitrum belum diisi (NEXT_PUBLIC_MEV_VAULT_{MEV_VAULT_CHAIN_ID}).
        </p>
      ) : (
        <>
          <p className="break-all font-mono text-[11px] text-slate-500">{proxy}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-cyan-500/20 bg-black/40 px-4 py-4">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Vault shares</p>
              <p className="mt-1 font-mono text-lg font-bold text-cyan-200">{show(shares, decimals)}</p>
              <p className="mt-1 text-[10px] text-slate-500">Satuan internal, termasuk offset virtual.</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-black/40 px-4 py-4">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Saldo USDC di Vault</p>
              <p className="mt-1 font-mono text-lg font-bold text-emerald-300">
                {show(assets, decimals)} {symbol}
              </p>
            </div>
          </div>
          <label className="block max-w-sm space-y-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Nominal USDC</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0.00 USDC"
              className="theme-input w-full rounded-lg px-3 py-2 font-mono text-sm"
            />
          </label>
          <p className="text-xs text-slate-400">
            Pratinjau share: {preview.data != null ? show(preview.data, decimals) : "—"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!parsed || pending != null}
              onClick={() => void onDeposit()}
              className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40"
            >
              {pending === "approve" ? "Approve USDC…" : pending === "deposit" ? "Deposit USDC…" : "Deposit USDC"}
            </button>
            <button
              type="button"
              disabled={!parsed || pending != null}
              onClick={() => void onWithdraw("withdraw")}
              className="rounded-lg border border-amber-400/70 px-4 py-2 text-sm font-bold text-amber-200 disabled:opacity-40"
            >
              {pending === "withdraw" ? "Withdraw USDC…" : "Withdraw USDC"}
            </button>
            <button
              type="button"
              disabled={!shares || shares === 0n || pending != null}
              onClick={() => void onWithdraw("redeem")}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 disabled:opacity-40"
            >
              {pending === "redeem" ? "Redeem…" : "Redeem semua"}
            </button>
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Riwayat event</p>
            {!indexed ? (
              <p className="mt-2 text-xs text-slate-500">Indexer belum terhubung. Saldo di atas tetap dibaca dari kontrak.</p>
            ) : events.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Belum ada event untuk dompet ini.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {events.map((event) => (
                  <li key={`${event.tx_hash}-${event.log_index}`} className="flex justify-between gap-3 font-mono text-[11px] text-slate-300">
                    <span className="uppercase text-slate-400">{event.kind}</span>
                    <span className="truncate">{event.tx_hash}</span>
                    <span>#{event.block_number}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
