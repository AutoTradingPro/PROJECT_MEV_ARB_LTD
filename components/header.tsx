"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LogIn, Search, User, Wallet, LogOut, Copy, Check, AlertCircle, LoaderCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLiveBlock } from "@/hooks/useLiveBlock";
import { parseBlockNumber } from "@/lib/chain/publicEnv";
import { useNetwork } from "@/context/NetworkContext";
import { useWallet } from "@/context/WalletContext";
import { useRpcLiveFeed } from "@/context/RpcLiveFeedContext";
import MainNav from "@/components/navigation/MainNav";
import MevArbHeaderLogo from "@/components/brand/MevArbHeaderLogo";
import TierModeSwitcher from "@/components/tier/TierModeSwitcher";
import SettingsButton from "@/components/settings/SettingsButton";
import { useSettings } from "@/context/SettingsContext";
import { useSandbox } from "@/context/SandboxContext";
import { formatNativeAmount, usdToNative } from "@/lib/bot/bnbQuote";
import { stableWeiToUsd } from "@/lib/bot/configUnits";

export default function Header() {
  const { theme } = useSettings();
  const isLight = theme === "light";
  const { chain, chainId, activeNetwork } = useNetwork();
  const { liveFeedActive, chains } = useRpcLiveFeed();
  const { blockNumber, transport } = useLiveBlock(chainId, chain.evm || chainId === "solana");
  const headerBlock = parseBlockNumber(blockNumber);
  const chainFeedOn =
    chainId in chains ? chains[chainId as keyof typeof chains] === true : liveFeedActive;
  /** EVM + Solana (Ankr RPC/WSS) punya live head; rantai non-EVM lain tetap N/A. */
  const supportsLiveHead = chain.evm || chainId === "solana";
  const rpcSignalLive = supportsLiveHead && chainFeedOn && transport !== "offline";
  const liveHeadLabel = chainId === "solana" ? "Slot Langsung" : "Blok Langsung";
  const liveHeadValue =
    supportsLiveHead && headerBlock > 0
      ? `#${headerBlock}`
      : supportsLiveHead
        ? "—"
        : "Non-EVM";
  const liveTransportHint = !supportsLiveHead
    ? "· N/A"
    : !rpcSignalLive
      ? "· Offline"
      : transport === "ws"
        ? "· WS"
        : "· RPC";
  const {
    address,
    isConnected,
    isConnecting,
    shortAddress,
    balance,
    balanceLabel,
    error: walletError,
    connect,
    disconnect,
  } = useWallet();

  const { user, openModal, logout } = useAuth();
  const { isSandbox, realizedProfitWei } = useSandbox();

  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleWalletClick = async () => {
    if (isConnected) {
      setShowDropdown((v) => !v);
      return;
    }
    // Di Solana jangan blokir klik meski spinner aktif (hindari tombol terkunci).
    if (isConnecting && chainId !== "solana") return;
    await connect();
  };

  const handleDisconnect = () => {
    const ok = window.confirm("Putus koneksi dompet dari portal ini?");
    if (ok) {
      disconnect();
      setShowDropdown(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const profitNative = usdToNative(stableWeiToUsd(realizedProfitWei), chain.nativeSymbol);
  const walletNative = Number.parseFloat(balance) || 0;
  const displayBalanceLabel = isSandbox
    ? formatNativeAmount(walletNative + profitNative, chain.nativeSymbol)
    : balanceLabel;
  const showBalanceChip = isConnected || (isSandbox && profitNative > 0);

  return (
    <header className="theme-header border-b w-full sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-2 space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
          <Link href="/markets" className="flex min-w-0 items-center gap-3">
            <MevArbHeaderLogo />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h1 className="text-lg font-black tracking-wider text-amber-400">MEV ARB</h1>
                <span className="hidden text-xs font-medium tracking-wide text-amber-500/90 sm:inline">
                  Flashloan Arbitrage Technology
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Institutional Grade Multi-DEX Execution Portal
              </p>
            </div>
          </Link>

            <div className="flex items-center gap-2 flex-wrap justify-center relative">
            <TierModeSwitcher />

            {showBalanceChip && (
              <div className="flex items-center gap-2 bg-slate-900/90 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-mono">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase">
                    {isSandbox ? "Saldo Testnet" : "Saldo Dompet"}
                  </span>
                  <span key={chainId} className="text-emerald-400 font-bold tabular-nums">
                    {displayBalanceLabel}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono">
              <div>
                <div className="text-[9px] text-slate-400 uppercase">RPC Jaringan</div>
                <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      rpcSignalLive ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                    }`}
                    title={
                      rpcSignalLive
                        ? transport === "ws"
                          ? "Live via WebSocket"
                          : "Live via HTTP RPC"
                        : "RPC offline / feed dimatikan"
                    }
                  />
                  <span suppressHydrationWarning className={`font-semibold ${chain.accentClass}`}>
                    {activeNetwork.shortLabel}
                  </span>
                </div>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <div className="text-[9px] text-slate-400 uppercase">
                  {liveHeadLabel} {liveTransportHint}
                </div>
                <div className="text-amber-400 font-bold tabular-nums" suppressHydrationWarning>
                  {liveHeadValue}
                </div>
              </div>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => void handleWalletClick()}
                disabled={isConnecting && chainId !== "solana"}
                className={`px-4 py-2 rounded-lg font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-lg min-w-36 cursor-pointer disabled:opacity-60 ${
                  isConnected
                    ? "bg-slate-900 border border-emerald-500/50 text-emerald-400 hover:bg-slate-800 shadow-emerald-500/10"
                    : "text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 shadow-amber-400/20"
                }`}
              >
                {isConnecting ? (
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                ) : (
                  <Wallet className="w-4 h-4" />
                )}
                {isConnecting
                  ? "Menghubungkan..."
                  : isConnected
                    ? shortAddress
                    : "Connect Wallet"}
              </button>

              {isConnected && showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 text-xs font-mono">
                  <div className="px-4 py-2 border-b border-slate-800 text-slate-400">
                    <span className="block text-[10px] uppercase">Akun Aktif</span>
                    <span className="text-white font-bold truncate block">{shortAddress}</span>
                    <span className="text-emerald-400 text-[10px] block mt-1">{displayBalanceLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyAddress()}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-800 flex items-center gap-2.5 text-slate-300 transition-all cursor-pointer"
                  >
                    {copied ? (
                      <span className="flex items-center gap-2 text-emerald-400">
                        <Check className="w-4 h-4" />
                        Alamat Disalin!
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-slate-300">
                        <Copy className="w-4 h-4 text-amber-400" />
                        Salin Alamat
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-500/10 flex items-center gap-2.5 text-red-400 transition-all border-t border-slate-800/60 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Putus Koneksi
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {walletError && (
          <p className="flex items-center gap-1.5 text-[11px] text-amber-400/90 font-mono bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {walletError}
          </p>
        )}

        <div
          className={`flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 pt-1.5 border-t ${
            isLight ? "border-slate-200" : "border-slate-900"
          }`}
        >
          <MainNav />

            <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
            <div className="relative flex-1 sm:flex-initial min-w-0">
              <span
                className={`absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none ${
                  isLight ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Cari token atau pasangan..."
                className={`w-full sm:w-48 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none transition-colors ${
                  isLight
                    ? "bg-slate-100 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400"
                    : "bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:border-amber-400/50"
                }`}
              />
            </div>

            {user ? (
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
                    isLight
                      ? "bg-slate-50 border-slate-200 text-slate-700"
                      : "bg-slate-900 border-slate-800"
                  }`}
                >
                  <User className={`w-3.5 h-3.5 ${isLight ? "text-blue-600" : "text-amber-400"}`} />
                  <span
                    className={`font-mono font-bold truncate max-w-[100px] ${
                      isLight ? "text-slate-800" : "text-amber-300"
                    }`}
                  >
                    {user.username}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                    isLight
                      ? "border-slate-300 text-slate-600 hover:text-red-500 hover:border-red-300"
                      : "border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/40"
                  }`}
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openModal("login")}
                className="shrink-0 h-10 px-5 rounded-lg bg-blue-600 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                Log In
              </button>
            )}

            <SettingsButton />
          </div>
        </div>
      </div>
    </header>
  );
}
