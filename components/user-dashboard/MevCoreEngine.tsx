"use client";

import { useState } from "react";
import { useAccount, useChainId, useConfig, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { mevVaultAbi } from "@/lib/vault/mevVaultAbi";
import { MEV_VAULT_CHAIN_ID, MEV_VAULT_USDC, mevVaultProxy } from "@/lib/vault/mevVaultConfig";

const NETWORKS = [
  { id: 42161, name: "Arbitrum One" },
  { id: 1, name: "Ethereum" },
  { id: 10, name: "Optimism" },
  { id: 137, name: "Polygon" },
  { id: 8453, name: "Base" },
  { id: 56, name: "BSC" },
  { id: 43114, name: "Avalanche" },
  { id: 143, name: "Monad" },
  { id: 324, name: "zkSync Era" },
] as const;

const SWITCHABLE = new Set<number>([1, 10, 56, 137, 143, 8453, 42161, 43114]);

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

export default function MevCoreEngine() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const config = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState<"network" | "approve" | "deposit" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = NETWORKS.find((network) => network.id === chainId) ?? null;
  const proxy = mevVaultProxy(MEV_VAULT_CHAIN_ID);
  const usdc = MEV_VAULT_USDC;
  const canRead = Boolean(isConnected && address);

  const walletUsdc = useReadContract({
    address: usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: MEV_VAULT_CHAIN_ID,
    query: { enabled: canRead, refetchInterval: 4_000 },
  });
  const usdcDecimals = useReadContract({
    address: usdc,
    abi: erc20Abi,
    functionName: "decimals",
    chainId: MEV_VAULT_CHAIN_ID,
    query: { enabled: canRead },
  });
  const vaultAssets = useReadContract({
    address: proxy ?? undefined,
    abi: mevVaultAbi,
    functionName: "assetsOf",
    args: address ? [address] : undefined,
    chainId: MEV_VAULT_CHAIN_ID,
    query: { enabled: canRead && Boolean(proxy && address), refetchInterval: 4_000 },
  });
  const vaultAsset = useReadContract({
    address: proxy ?? undefined,
    abi: mevVaultAbi,
    functionName: "asset",
    chainId: MEV_VAULT_CHAIN_ID,
    query: { enabled: canRead && Boolean(proxy) },
  });
  const vaultDecimals = useReadContract({
    address: vaultAsset.data,
    abi: erc20Abi,
    functionName: "decimals",
    chainId: MEV_VAULT_CHAIN_ID,
    query: { enabled: canRead && Boolean(vaultAsset.data) },
  });

  const walletDecimals = usdcDecimals.data ?? 6;
  const assetDecimals = vaultDecimals.data ?? walletDecimals;
  const parsed = parseAmount(amount, assetDecimals);

  async function onSelect(nextChainId: number) {
    setError(null);
    if (!SWITCHABLE.has(nextChainId)) {
      setError("zkSync Era belum dipasang di konektor dompet. Delapan jaringan lain bisa diganti dari sini.");
      return;
    }
    if (!isConnected) {
      setError("Hubungkan dompet sebelum mengganti jaringan.");
      return;
    }
    if (chainId === nextChainId) return;
    setPending("network");
    try {
      await switchChainAsync({ chainId: nextChainId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengganti jaringan.");
    } finally {
      setPending(null);
    }
  }

  async function ensureArbitrum() {
    if (chainId === MEV_VAULT_CHAIN_ID) return;
    setPending("network");
    await switchChainAsync({ chainId: MEV_VAULT_CHAIN_ID });
  }

  async function onDeposit() {
    if (!proxy || !address || !parsed) return;
    setError(null);
    if (vaultAsset.data && vaultAsset.data.toLowerCase() !== usdc.toLowerCase()) {
      setError("MevVault Arbitrum tidak memakai USDC 0xaf88…5831.");
      return;
    }
    try {
      await ensureArbitrum();
      const allowance = await readContract(config, {
        address: usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, proxy],
        chainId: MEV_VAULT_CHAIN_ID,
      });
      if (allowance < parsed) {
        setPending("approve");
        const approved = await writeContractAsync({
          account: address,
          address: usdc,
          abi: erc20Abi,
          functionName: "approve",
          args: [proxy, parsed],
        });
        await waitForTransactionReceipt(config, { hash: approved });
      }
      setPending("deposit");
      // Live proxy: deposit(uint256). Shares go to msg.sender, the connected wallet.
      const deposited = await writeContractAsync({
        account: address,
        address: proxy,
        abi: mevVaultAbi,
        functionName: "deposit",
        args: [parsed],
      });
      await waitForTransactionReceipt(config, { hash: deposited });
      setAmount("");
      void walletUsdc.refetch();
      void vaultAssets.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit gagal.");
    } finally {
      setPending(null);
    }
  }

  async function onWithdraw() {
    if (!proxy || !address || !parsed) return;
    setError(null);
    try {
      await ensureArbitrum();
      setPending("withdraw");
      // Live proxy: withdraw(uint256). Tokens return to msg.sender, who is both owner and receiver.
      const hash = await writeContractAsync({
        account: address,
        address: proxy,
        abi: mevVaultAbi,
        functionName: "withdraw",
        args: [parsed],
      });
      await waitForTransactionReceipt(config, { hash });
      setAmount("");
      void walletUsdc.refetch();
      void vaultAssets.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Penarikan gagal.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="theme-panel rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-100">MevVault</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Token dasar: USDC · Arbitrum One · {MEV_VAULT_CHAIN_ID}
            {active && active.id !== MEV_VAULT_CHAIN_ID ? ` · dompet di ${active.name}` : ""}
          </p>
        </div>
        <p className="text-[11px] text-slate-500">
          {address ? `Pemilik · ${address.slice(0, 6)}…${address.slice(-4)}` : "Ditandatangani dompet Anda"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {NETWORKS.map((network) => {
          const selected = network.id === chainId;
          return (
            <button
              key={network.id}
              type="button"
              onClick={() => void onSelect(network.id)}
              disabled={pending != null}
              className={`rounded-xl border px-2 py-2 text-left cursor-pointer disabled:opacity-50 ${
                selected
                  ? "border-amber-400/70 bg-amber-400/15 text-amber-100"
                  : "border-slate-700 bg-black/30 text-slate-300 hover:border-slate-500"
              }`}
            >
              <span className="block text-[11px] font-bold leading-tight">{network.name}</span>
              <span className="mt-1 block font-mono text-[10px] text-slate-500">
                {network.id === MEV_VAULT_CHAIN_ID ? "USDC · " : ""}
                {selected ? "Aktif · " : ""}
                {network.id}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-black/40 px-4 py-4">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Saldo USDC di dompet · live</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-100">
            {show(walletUsdc.data, walletDecimals)} USDC
          </p>
          <p className="mt-1 break-all font-mono text-[10px] text-slate-500">{usdc}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-black/40 px-4 py-4">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Saldo USDC di Vault · live</p>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-300">
            {proxy ? show(vaultAssets.data, assetDecimals) : "—"} USDC
          </p>
          <p className="mt-1 break-all font-mono text-[10px] text-slate-500">{proxy ?? "Proxy belum diisi"}</p>
        </div>
      </div>

      {!isConnected ? (
        <p className="text-sm text-slate-400">Hubungkan dompet untuk membaca saldo dan menandatangani transaksi.</p>
      ) : !proxy ? (
        <p className="text-sm text-amber-300">
          Proxy MevVault Arbitrum belum diisi (NEXT_PUBLIC_MEV_VAULT_{MEV_VAULT_CHAIN_ID}).
        </p>
      ) : null}

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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!proxy || !parsed || pending != null || !isConnected}
          onClick={() => void onDeposit()}
          className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40"
        >
          {pending === "approve" ? "Approve USDC…" : pending === "deposit" ? "Deposit USDC…" : "Deposit USDC"}
        </button>
        <button
          type="button"
          disabled={!proxy || !parsed || pending != null || !isConnected}
          onClick={() => void onWithdraw()}
          className="rounded-lg border border-amber-400/70 px-4 py-2 text-sm font-bold text-amber-200 disabled:opacity-40"
        >
          {pending === "withdraw" ? "Withdraw USDC…" : "Withdraw USDC"}
        </button>
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        Deposit menyetujui USDC Arbitrum ({usdc}) ke MevVault, lalu memanggil deposit. Withdraw mengembalikan USDC yang sama ke dompet ini. Keduanya ditandatangani pemilik dana.
      </p>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </section>
  );
}
