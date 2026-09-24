"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Landmark,
  LoaderCircle,
  RefreshCw,
  Shield,
  Wallet,
} from "lucide-react";
import TxNotifyToast, { type TxNotify } from "@/components/TxNotifyToast";
import { useBotConfig } from "@/context/BotConfigContext";
import { useNetwork } from "@/context/NetworkContext";
import { useRpcLiveFeed } from "@/context/RpcLiveFeedContext";
import { useWallet } from "@/context/WalletContext";
import { formatUsd } from "@/lib/bot/configUnits";
import {
  estimateVaultDeposit,
  formatDepositAmount,
} from "@/lib/bot/vaultDeposit";
import {
  flashLoanProviderLabel,
  getFlashLoanPlatform,
  isFlashLoanProviderId,
  mergeFlashLoanPlatforms,
  normalizeFlashLoanProviderId,
  resolveFlashLoanFeePct,
} from "@/lib/bot/flashLoanProviders";
import { explorerTxUrl } from "@/lib/chain/explorer";
import { getChain } from "@/lib/chain/networks";
import {
  ARBITRUM_EVM_CHAIN_ID,
  BSC_EVM_CHAIN_ID,
  ETHEREUM_EVM_CHAIN_ID,
  assetSymbol,
  depositToVault,
  fetchVaultBalances,
  formatVaultError,
  isNativeAsset,
  maxWithdrawInputFromBalances,
  rawVaultError,
  tokenAddressForAsset,
  withdrawFromVault,
  type VaultAsset,
  type VaultBalances,
} from "@/lib/vault/client";
import {
  ARBITRUM_EXECUTOR_ADDRESS,
  ETHEREUM_EXECUTOR_ADDRESS,
  executorConfigForChainId,
  isExecutorConfigured,
} from "@/lib/vault/executors";
import {
  getConnectedAccounts,
  getWalletChainIdHex,
  parseChainIdHex,
  shortenAddress,
} from "@/lib/wallet/provider";
import GasStrategyPanel from "@/components/admin/GasStrategyPanel";
import TelegramTestPanel from "@/components/admin/TelegramTestPanel";
import FlashLoanProviderCard from "@/components/tier/FlashLoanProviderCard";

function networkLabel(evmChainId: number | null): string {
  if (evmChainId === ARBITRUM_EVM_CHAIN_ID) return "Arbitrum One (chainId 42161)";
  if (evmChainId === BSC_EVM_CHAIN_ID) return "BSC Mainnet (chainId 56)";
  if (evmChainId === ETHEREUM_EVM_CHAIN_ID) return "Ethereum Mainnet (chainId 1)";
  if (evmChainId == null) return "Tidak terdeteksi";
  const known = getChain("bsc");
  if (evmChainId === known.chainId) return known.shortLabel;
  return `Chain ID ${evmChainId}`;
}

function portalTradingChain(chainId: string): "bsc" | "arbitrum" | "ethereum" | "polygon" {
  if (chainId === "arbitrum") return "arbitrum";
  if (chainId === "ethereum") return "ethereum";
  if (chainId === "polygon") return "polygon";
  return "bsc";
}

function defaultAsset(chainId: string): VaultAsset {
  return chainId === "arbitrum" ? "usdc" : "usdt";
}

function explorerLinkLabel(chain: string): string {
  if (chain === "arbitrum") return "Buka Arbiscan";
  if (chain === "ethereum") return "Buka Etherscan";
  if (chain === "polygon") return "Buka Polygonscan";
  return "Buka BscScan";
}

interface AdminViewProps {
  embedded?: boolean;
}

export default function AdminView({ embedded = false }: AdminViewProps) {
  const { chain, chainId } = useNetwork();
  const { config, setConfig, setLoanAmountUsd } = useBotConfig();
  const { wssEnabled, rpcFallbackEnabled, chains } = useRpcLiveFeed();
  const {
    address,
    shortAddress,
    isConnected,
    isConnecting,
    balanceLabel,
    providerAvailable,
    connect,
    evmChainId,
  } = useWallet();

  const portalTrading = portalTradingChain(chainId);
  const walletChainId = evmChainId;
  const activeEvmId =
    walletChainId ??
    (portalTrading === "arbitrum"
      ? ARBITRUM_EVM_CHAIN_ID
      : portalTrading === "ethereum"
        ? ETHEREUM_EVM_CHAIN_ID
        : BSC_EVM_CHAIN_ID);
  const executor = executorConfigForChainId(activeEvmId);
  const trading = executor?.portalChain ?? portalTrading;
  const vaultAddress = isExecutorConfigured(executor) ? executor!.address : "";
  const expectedEvmId = executor?.evmChainId ?? activeEvmId;
  const nativeSymbol = executor?.nativeSymbol ?? chain.nativeSymbol;
  const supportedWalletChain = Boolean(executorConfigForChainId(walletChainId));

  const [gasPriceWei, setGasPriceWei] = useState("0");
  const [balances, setBalances] = useState<VaultBalances | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [asset, setAsset] = useState<VaultAsset>(defaultAsset(trading));
  const [depositOverride, setDepositOverride] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pending, setPending] = useState<"deposit" | "withdraw" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txNotify, setTxNotify] = useState<TxNotify | null>(null);

  const onTargetChain = walletChainId === expectedEvmId;
  const symbol = assetSymbol(trading, asset);
  const selectedFlashFeePct = resolveFlashLoanFeePct(
    mergeFlashLoanPlatforms(config.flashLoanPlatforms),
    config.flashLoanProvider
  ).feePct;
  const selectedBalance = useMemo(() => {
    if (!balances) return { label: loadingBalances ? "…" : "—", zero: false, known: false };
    if (isNativeAsset(asset)) return { label: balances.nativeLabel, zero: balances.nativeWei <= 0n, known: true };
    if (asset === "usdc") return { label: balances.usdcLabel, zero: balances.usdcRaw <= 0n, known: true };
    return { label: balances.usdtLabel, zero: balances.usdtRaw <= 0n, known: true };
  }, [asset, balances, loadingBalances]);

  const notify = useCallback((tone: TxNotify["tone"], title: string, message: string, href?: string) => {
    setTxNotify({
      id: `${Date.now()}`,
      tone,
      title,
      message,
      href,
      linkLabel: explorerLinkLabel(trading),
    });
  }, [trading]);

  const fail = useCallback(
    (message: string, title = "Withdraw gagal", original?: unknown) => {
      if (original !== undefined) {
        console.error(`[admin] ${title}`, original);
      } else {
        console.error(`[admin] ${title}`, message);
      }
      setError(message);
      notify("error", title, message);
      if (typeof window !== "undefined") {
        window.alert(`${title}\n\n${message}`);
      }
      return false;
    },
    [notify]
  );

  const depositEstimate = useMemo(
    () =>
      estimateVaultDeposit({
        loanAmountUsd: config.loanAmountUsd,
        aaveFeePct: selectedFlashFeePct,
        gasLimit: config.gasLimit,
        gasPriceWei,
      }),
    [config.loanAmountUsd, config.gasLimit, selectedFlashFeePct, gasPriceWei]
  );

  const suggestedDeposit = isNativeAsset(asset) ? depositEstimate.bnbAmount : depositEstimate.usdtAmount;
  const autoDepositAmount = formatDepositAmount(suggestedDeposit, isNativeAsset(asset) ? 8 : 6);
  const depositAmount = depositOverride ?? autoDepositAmount;

  useEffect(() => {
    setAsset(defaultAsset(trading));
    setDepositOverride(null);
    setWithdrawAmount("");
  }, [trading]);

  useEffect(() => {
    setDepositOverride(null);
  }, [config.loanAmountUsd, asset]);

  const refreshVault = useCallback(async () => {
    if (!vaultAddress) {
      setBalances(null);
      if (walletChainId != null && !executorConfigForChainId(walletChainId)) {
        setBalanceError(
          `Chain ID ${walletChainId} tidak didukung. Ganti MetaMask ke Ethereum Mainnet (1), BSC (56), atau Arbitrum One (42161).`
        );
      } else if (activeEvmId === ARBITRUM_EVM_CHAIN_ID) {
        setBalanceError(
          `Executor Arbitrum belum diisi. Ganti ARBITRUM_EXECUTOR_ADDRESS (${ARBITRUM_EXECUTOR_ADDRESS}) atau NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR.`
        );
      } else if (activeEvmId === ETHEREUM_EVM_CHAIN_ID) {
        setBalanceError(
          `Executor Ethereum belum diisi. Set NEXT_PUBLIC_ETHEREUM_ARBITRAGE_EXECUTOR (${ETHEREUM_EXECUTOR_ADDRESS}).`
        );
      } else {
        setBalanceError("Alamat kontrak executor belum dikonfigurasi.");
      }
      return;
    }
    setLoadingBalances(true);
    try {
      const next = await fetchVaultBalances(vaultAddress, trading);
      setBalances(next);
      setBalanceError(null);
    } catch (err) {
      setBalances(null);
      setBalanceError(formatVaultError(err));
    } finally {
      setLoadingBalances(false);
    }
  }, [vaultAddress, trading, walletChainId, activeEvmId]);

  useEffect(() => {
    setBalances(null);
    setBalanceError(null);
    void refreshVault();
    const id = window.setInterval(() => {
      void refreshVault();
    }, 12000);
    return () => window.clearInterval(id);
  }, [refreshVault, vaultAddress, trading]);

  useEffect(() => {
    let cancelled = false;
    const loadGas = async () => {
      try {
        const res = await fetch(`/api/chain/head?chain=${chainId}`, { cache: "no-store" });
        const json = (await res.json()) as { gasPriceWei?: string };
        if (!cancelled && json.gasPriceWei) setGasPriceWei(json.gasPriceWei);
      } catch {
        /* pakai fallback gwei */
      }
    };
    void loadGas();
    const id = window.setInterval(() => void loadGas(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [chainId, wssEnabled, rpcFallbackEnabled, chains]);

  useEffect(() => {
    if (!window.ethereum) return;
    const onChainChanged = (...args: unknown[]) => {
      try {
        setBalances(null);
        setBalanceError(null);
        setError(null);
        setStatus(null);
        const hex = typeof args[0] === "string" ? args[0] : null;
        const parsed = parseChainIdHex(hex);
        if (parsed == null) {
          void getWalletChainIdHex();
        }
      } catch (err) {
        console.warn("[admin] chainChanged", err);
      }
    };
    window.ethereum.on("chainChanged", onChainChanged);
    return () => window.ethereum?.removeListener("chainChanged", onChainChanged);
  }, []);

  const ensureReady = async (actionTitle: string): Promise<boolean> => {
    setError(null);
    setStatus(null);
    if (!providerAvailable) {
      return fail("Instal MetaMask atau Rabby terlebih dahulu.", "Dompet tidak terdeteksi");
    }
    if (!isConnected || !address) {
      try {
        await connect();
      } catch (err) {
        return fail(formatVaultError(err), "Koneksi dompet gagal");
      }
      const accounts = await getConnectedAccounts();
      if (!accounts[0]) {
        return fail(
          "Hubungkan MetaMask atau Rabby, pilih akun, lalu tekan Withdraw lagi.",
          "Dompet belum terhubung"
        );
      }
    }
    if (!vaultAddress) {
      if (activeEvmId === ARBITRUM_EVM_CHAIN_ID) {
        return fail(
          "Executor Arbitrum belum diisi. Ganti ARBITRUM_EXECUTOR_ADDRESS atau NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR.",
          actionTitle
        );
      }
      if (activeEvmId === ETHEREUM_EVM_CHAIN_ID) {
        return fail(
          "Executor Ethereum belum diisi. Set NEXT_PUBLIC_ETHEREUM_ARBITRAGE_EXECUTOR di .env.local.",
          actionTitle
        );
      }
      return fail("Alamat kontrak executor belum dikonfigurasi.", actionTitle);
    }
    if (walletChainId != null && !supportedWalletChain) {
      return fail(
        `Dompet di chainId ${walletChainId}. Ganti MetaMask ke Ethereum Mainnet (1), BSC (56), atau Arbitrum One (42161).`,
        "Jaringan tidak didukung"
      );
    }
    try {
      await getWalletChainIdHex();
    } catch (err) {
      return fail(formatVaultError(err), "Gagal membaca jaringan dompet");
    }
    return true;
  };

  const runDeposit = async () => {
    const ready = await ensureReady("Deposit gagal");
    if (!ready || !address) return;
    if (!depositAmount.trim()) {
      fail("Masukkan nominal deposit.", "Deposit gagal");
      return;
    }
    setPending("deposit");
    try {
      const hash = await depositToVault({
        vaultAddress,
        asset,
        amount: depositAmount,
        ownerAddress: address,
        chainId: trading,
        tokenDecimals: asset === "usdc" ? balances?.usdcDecimals : balances?.usdtDecimals,
      });
      const href = explorerTxUrl(hash, trading);
      setStatus(`Deposit ${symbol} terkirim. Tx: ${hash}`);
      notify("success", `Deposit ${symbol} terkirim`, hash, href);
      setDepositOverride(null);
      await refreshVault();
    } catch (err) {
      fail(formatVaultError(err), "Deposit gagal");
    } finally {
      setPending(null);
    }
  };

  const runWithdraw = async () => {
    setError(null);
    setStatus(null);
    setPending("withdraw");
    try {
      const ready = await ensureReady("Withdraw gagal");
      if (!ready) return;
      const owner = address || (await getConnectedAccounts())[0];
      if (!owner) {
        fail("Hubungkan MetaMask, lalu tekan Withdraw lagi.", "Dompet belum terhubung");
        return;
      }
      if (selectedBalance.known && selectedBalance.zero) {
        fail(
          `Saldo riil kontrak untuk ${symbol} = 0. Deposit dulu atau pilih aset lain. Transaksi tidak dikirim ke MetaMask.`,
          "Saldo kontrak kosong"
        );
        return;
      }
      notify("info", "Menunggu MetaMask", `Signer akan menarik ${symbol} dari ${vaultAddress.slice(0, 10)}… ke dompet Anda.`);
      let liveBalances = balances;
      try {
        liveBalances = await fetchVaultBalances(vaultAddress, trading);
        setBalances(liveBalances);
      } catch {
        /* lanjut; kontrak tetap bisa dipanggil */
      }
      const hash = await withdrawFromVault({
        vaultAddress,
        asset,
        amount: withdrawAmount,
        ownerAddress: owner,
        chainId: trading,
        tokenDecimals: asset === "usdc" ? liveBalances?.usdcDecimals : liveBalances?.usdtDecimals,
        balances: liveBalances,
      });
      const href = explorerTxUrl(hash, trading);
      setStatus(`Withdraw ${symbol} terkirim. Tx: ${hash}`);
      notify("success", `Withdraw ${symbol} terkirim`, hash, href);
      setWithdrawAmount("");
      await refreshVault();
    } catch (err) {
      const raw = rawVaultError(err);
      console.error("[admin] withdraw gagal (error asli)", err);
      fail(`${formatVaultError(err)}\n\nDetail: ${raw}`, "Withdraw gagal", err);
    } finally {
      setPending(null);
    }
  };

  const fillMaxWithdraw = () => {
    if (!balances) return;
    setWithdrawAmount(maxWithdrawInputFromBalances(balances, asset, trading));
  };

  return (
    <div className={embedded ? "w-full space-y-5" : "mx-auto w-full max-w-5xl space-y-5"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-sky-400">Uji coba vault</p>
          {embedded ? (
            <h2 className="mt-1 flex items-center gap-2 text-lg font-black tracking-tight">
              <Shield className="h-5 w-5 text-sky-400" />
              Vault & eksekusi
            </h2>
          ) : (
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight">
              <Shield className="h-6 w-6 text-sky-400" />
              Admin
            </h1>
          )}
          <p className="mt-1 text-sm text-slate-400">
            Deposit dan penarikan mengikuti jaringan aktif di MetaMask
            {executor ? ` (${executor.label})` : ""}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshVault()}
          disabled={loadingBalances}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingBalances ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <FlashLoanProviderCard config={config} onChange={setConfig} />

      <GasStrategyPanel liveGasWei={gasPriceWei} />

      <TelegramTestPanel />

      <section className="theme-panel rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide">Dompet terhubung</h2>
        {!isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              Hubungkan MetaMask, Coinbase Wallet, atau WalletConnect untuk membaca jaringan dan menandatangani transaksi vault.
            </p>
            <button
              type="button"
              onClick={() => void connect()}
              disabled={isConnecting}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 cursor-pointer disabled:opacity-50"
            >
              {isConnecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Connect Wallet
            </button>
          </div>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="theme-panel-muted rounded-xl px-3 py-3">
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">Alamat wallet</dt>
              <dd className="mt-1 font-mono text-sm font-semibold break-all">{address}</dd>
              <dd className="mt-0.5 text-[11px] text-slate-500">{shortAddress}</dd>
            </div>
            <div className="theme-panel-muted rounded-xl px-3 py-3">
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">Jaringan dompet</dt>
              <dd className={`mt-1 text-sm font-semibold ${onTargetChain ? "text-emerald-400" : "text-amber-300"}`}>
                {networkLabel(walletChainId)}
              </dd>
              <dd className="mt-0.5 text-[11px] text-slate-500">
                Native {nativeSymbol} · saldo dompet {balanceLabel}
              </dd>
            </div>
          </dl>
        )}
        {isConnected && walletChainId != null && !supportedWalletChain && (
          <p className="flex items-start gap-2 text-xs text-amber-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Executor hanya untuk BSC (56) dan Arbitrum One (42161). Ganti jaringan di MetaMask.
          </p>
        )}
      </section>

      <section className="theme-panel rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide">Saldo kontrak executor</h2>
        {vaultAddress ? (
          <p className="font-mono text-[11px] text-slate-500 break-all">
            Executor: {vaultAddress}
            {executor ? ` · ${executor.label} · native ${executor.nativeSymbol}` : ""}
          </p>
        ) : (
          <p className="text-sm text-amber-300">
            {activeEvmId === ARBITRUM_EVM_CHAIN_ID
              ? "Executor Arbitrum belum diisi. Ganti ARBITRUM_EXECUTOR_ADDRESS di lib/vault/executors.ts atau NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR (jangan pakai alamat BSC)."
              : walletChainId != null && !supportedWalletChain
                ? `Chain ID ${walletChainId} tidak didukung. Ganti MetaMask ke BSC (56) atau Arbitrum (42161).`
                : "Alamat kontrak executor belum diisi."}
          </p>
        )}
        {balanceError && (
          <p className="flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {balanceError}
          </p>
        )}
        <div className={`grid gap-3 ${trading === "arbitrum" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <div className="rounded-xl border border-amber-500/20 bg-black/40 px-4 py-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{nativeSymbol}</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-amber-300">
              {balances ? balances.nativeLabel : loadingBalances ? "…" : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-black/40 px-4 py-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">USDT</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-400">
              {balances ? balances.usdtLabel : loadingBalances ? "…" : "—"}
            </p>
            <p className="mt-1 font-mono text-[10px] text-slate-600 break-all">
              {shortenAddress(tokenAddressForAsset(trading, "usdt"))}
            </p>
          </div>
          {trading === "arbitrum" ? (
            <div className="rounded-xl border border-sky-500/20 bg-black/40 px-4 py-4">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">USDC</p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums text-sky-300">
                {balances ? balances.usdcLabel : loadingBalances ? "…" : "—"}
              </p>
              <p className="mt-1 font-mono text-[10px] text-slate-600 break-all">
                {shortenAddress(tokenAddressForAsset(trading, "usdc"))}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="theme-panel rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <Landmark className="h-4 w-4 text-amber-400" />
            Jumlah Pinjaman (Loan Amount)
          </h2>
          <span className="text-[10px] font-mono text-slate-500">Sinkron dengan Konfigurasi Operasional</span>
        </div>
        <label className="block max-w-sm space-y-1.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            Nominal USDT · pinjaman kilat {flashLoanProviderLabel(config.flashLoanProvider)}
          </span>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500">$</span>
            <input
              type="number"
              min={0}
              step={100}
              value={config.loanAmountUsd}
              suppressHydrationWarning
              onChange={(event) => {
                const next = Number(event.target.value);
                setLoanAmountUsd(Number.isFinite(next) ? next : 0);
              }}
              className="theme-input w-full rounded-lg py-2 pl-6 pr-2 font-mono text-sm focus:outline-none focus:border-amber-400/40"
            />
          </div>
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="theme-panel-muted rounded-xl px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              Fee {flashLoanProviderLabel(config.flashLoanProvider)}{" "}
              {
                getFlashLoanPlatform(
                  isFlashLoanProviderId(
                    normalizeFlashLoanProviderId(config.flashLoanProvider) ?? config.flashLoanProvider
                  )
                    ? (normalizeFlashLoanProviderId(config.flashLoanProvider) ?? "aave")
                    : "aave"
                ).feeLabel
              }
            </p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-violet-200">
              {formatUsd(depositEstimate.flashFeeUsd)}
            </p>
          </div>
          <div className="theme-panel-muted rounded-xl px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              Gas ({depositEstimate.gasLimit.toLocaleString("en-US")} · {depositEstimate.gasPriceGwei.toFixed(2)} gwei)
            </p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-amber-300">
              {formatUsd(depositEstimate.gasUsd)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-emerald-400/80">
              Deposit vault (fee + gas) × {depositEstimate.safetyMultiplier}
            </p>
            <p className="mt-1 font-mono text-sm font-bold tabular-nums text-emerald-300">
              {isNativeAsset(asset)
                ? `${formatDepositAmount(depositEstimate.bnbAmount, 8)} ${nativeSymbol}`
                : formatUsd(depositEstimate.usdtAmount)}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Loan ${config.loanAmountUsd.toLocaleString("en-US")} USDT · deposit otomatis = (premi flashloan + estimasi
          gas) × {depositEstimate.safetyMultiplier} cadangan pengaman.
        </p>
      </section>

      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <section className="theme-panel flex h-full min-h-[22rem] flex-col rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <ArrowDownToLine className="h-4 w-4 text-emerald-400" />
            Deposit ke vault
          </h2>
          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
          <label className="block space-y-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Aset</span>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value as VaultAsset)}
              className="theme-input w-full rounded-lg px-3 py-2 text-sm"
            >
              <option value="native">{nativeSymbol}</option>
              <option value="usdt">USDT</option>
              {trading === "arbitrum" ? <option value="usdc">USDC</option> : null}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Deposit Vault · {symbol} (otomatis)
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder={isNativeAsset(asset) ? "0.05" : "10"}
              value={depositAmount}
              suppressHydrationWarning
              onChange={(e) => setDepositOverride(e.target.value)}
              className="theme-input w-full rounded-lg px-3 py-2 font-mono text-sm"
            />
          </label>
          <p className="min-h-[2.75rem] text-[11px] leading-relaxed text-slate-500">
            {nativeSymbol} memanggil <span className="font-mono text-slate-300">deposit()</span> (fallback: transfer
            native). Token memanggil <span className="font-mono text-slate-300">depositToken</span> setelah approve.
          </p>
          <div className="mt-auto">
            <div className="mb-1 flex h-5 justify-end" aria-hidden="true" />
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void runDeposit()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer disabled:opacity-40"
            >
              {pending === "deposit" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {pending === "deposit" ? "Mengirim deposit…" : `Deposit ${symbol}`}
            </button>
          </div>
          </div>
        </section>

        <section className="theme-panel flex h-full min-h-[22rem] flex-col rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <ArrowUpFromLine className="h-4 w-4 text-amber-300" />
            Withdraw ke wallet terhubung
          </h2>
          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
          <label className="block space-y-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Aset</span>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value as VaultAsset)}
              className="theme-input w-full rounded-lg px-3 py-2 text-sm"
            >
              <option value="native">{nativeSymbol}</option>
              <option value="usdt">USDT</option>
              {trading === "arbitrum" ? <option value="usdc">USDC</option> : null}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-slate-500">
              <span>Nominal {symbol}</span>
              <span className="font-mono font-medium normal-case tracking-normal text-slate-400">
                {selectedBalance.label}
              </span>
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="theme-input w-full rounded-lg px-3 py-2 font-mono text-sm"
            />
          </label>
          <p className="min-h-[2.75rem] text-[11px] leading-relaxed text-slate-500">
            Tarik dana ke wallet owner yang terhubung (`withdraw` / `withdrawToken`, `onlyOwner`). Kosongkan
            nominal untuk sapu sisa lewat `emergencyWithdraw` / `rescueETH`.
          </p>
          <div className="mt-auto">
            <div className="mb-1 flex h-5 items-center justify-end">
              <button
                id="admin-withdraw-max"
                type="button"
                disabled={pending !== null || !balances || (selectedBalance.known && selectedBalance.zero)}
                onClick={fillMaxWithdraw}
                className="text-[11px] font-bold uppercase tracking-wide text-amber-300 hover:text-amber-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                Max
              </button>
            </div>
            <button
              id="admin-withdraw-button"
              type="button"
              disabled={pending !== null || (selectedBalance.known && selectedBalance.zero)}
              onClick={() => void runWithdraw()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300 cursor-pointer disabled:opacity-40"
            >
              {pending === "withdraw" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {pending === "withdraw"
                ? "Menunggu tanda tangan…"
                : selectedBalance.known && selectedBalance.zero
                  ? `Saldo ${symbol} kosong`
                  : `Withdraw ${symbol}`}
            </button>
          </div>
          </div>
        </section>
      </div>

      {status && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-mono text-xs text-emerald-300 break-all">
          {status}
        </p>
      )}
      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-all">{error}</span>
        </p>
      )}

      <TxNotifyToast notify={txNotify} onDismiss={() => setTxNotify(null)} />
    </div>
  );
}
