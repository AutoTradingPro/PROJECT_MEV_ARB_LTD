"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CheckCircle2,
  CircleHelp,
  Clock,
  Copy,
  Cuboid,
  Fuel,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import type { ResolvedTradeTrace } from "@/lib/bot/transactionTrace";

interface TransactionTraceModalProps {
  open: boolean;
  onClose: () => void;
  trace: ResolvedTradeTrace | null;
  sandbox?: boolean;
}

function tokenTone(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s === "USDT") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (s === "USDC") return "bg-sky-500/20 text-sky-300 border-sky-500/40";
  if (s === "DAI") return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  if (s === "BUSD") return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  if (s.includes("BNB")) return "bg-yellow-400/20 text-yellow-200 border-yellow-400/40";
  if (s.includes("ETH")) return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
  return "bg-slate-700/60 text-slate-200 border-slate-500/40";
}

function protocolTone(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("aave")) return "bg-purple-500/15 text-purple-200 border-purple-500/40";
  if (n.includes("pancake")) return "bg-amber-500/15 text-amber-200 border-amber-500/40";
  if (n.includes("biswap") || n.includes("bi swap")) return "bg-lime-500/15 text-lime-200 border-lime-500/40";
  if (n.includes("uniswap")) return "bg-pink-500/15 text-pink-200 border-pink-500/40";
  if (n.includes("mdex")) return "bg-blue-500/15 text-blue-200 border-blue-500/40";
  if (n.includes("bakery")) return "bg-orange-500/15 text-orange-200 border-orange-500/40";
  return "bg-slate-800 text-slate-300 border-slate-600";
}

function protocolMark(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("aave")) return "A";
  if (n.includes("pancake")) return "P";
  if (n.includes("biswap") || n.includes("bi swap")) return "B";
  if (n.includes("uniswap")) return "U";
  if (n.includes("mdex")) return "M";
  return name.slice(0, 1).toUpperCase() || "·";
}

function TokenChip({ symbol }: { symbol: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-sky-300">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold ${tokenTone(symbol)}`}
      >
        {symbol.slice(0, 1).toUpperCase()}
      </span>
      {symbol}
    </span>
  );
}

function ProtocolChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold ${protocolTone(name)}`}
      >
        {protocolMark(name)}
      </span>
      {name}
    </span>
  );
}

export default function TransactionTraceModal({
  open,
  onClose,
  trace,
  sandbox = false,
}: TransactionTraceModalProps) {
  const titleId = useId();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    setCopied(false);
  }, [trace?.txHash, open]);

  if (!open || !trace || typeof document === "undefined") return null;

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(trace.txHash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const aaveLabel = sandbox ? `${trace.providerLabel} (Testnet)` : trace.providerLabel;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Tutup modal"
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl max-h-[min(92vh,860px)] overflow-y-auto rounded-2xl border border-slate-700/80 bg-[#0b1220] shadow-2xl shadow-black/60">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-800 bg-[#0b1220]/95 px-5 sm:px-6 py-3.5 backdrop-blur">
          <div>
            <h2 id={titleId} className="text-[15px] font-semibold tracking-wide text-white">
              Transaction Details
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {trace.pair} · {trace.route}
              {sandbox ? " · Testnet" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-4">
          <section className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300">
                <Zap className="w-4 h-4 fill-amber-300/80" />
              </span>
              <h3 className="text-[12px] font-bold tracking-[0.14em] text-slate-100">TRANSACTION ACTION</h3>
            </div>
            <ul className="divide-y divide-slate-800/80 text-[13px] leading-relaxed">
              <ActionRow>
                <span className="text-slate-400">Flash Loan</span>{" "}
                <span className="text-white font-medium">{trace.loanQtyLabel}</span>{" "}
                <TokenChip symbol={trace.loanToken} />{" "}
                <span className="text-slate-500">({trace.loanUsdLabel})</span>{" "}
                <span className="text-slate-400">From</span> <ProtocolChip name={aaveLabel} />
              </ActionRow>
              <ActionRow>
                <span className="text-slate-400">Swap</span>{" "}
                <span className="text-white font-medium">{trace.loanQtyLabel}</span>{" "}
                <TokenChip symbol={trace.loanToken} />{" "}
                <span className="text-slate-500">({trace.loanUsdLabel})</span>{" "}
                <span className="text-slate-400">For</span>{" "}
                <span className="text-white font-medium">{trace.buyQtyLabel}</span>{" "}
                <TokenChip symbol={trace.buyToken} />{" "}
                <span className="text-slate-500">({trace.buyUsdLabel})</span>{" "}
                <span className="text-slate-400">On</span> <ProtocolChip name={trace.buyDex} />
              </ActionRow>
              <ActionRow>
                <span className="text-slate-400">Swap</span>{" "}
                <span className="text-white font-medium">{trace.buyQtyLabel}</span>{" "}
                <TokenChip symbol={trace.buyToken} />{" "}
                <span className="text-slate-500">({trace.buyUsdLabel})</span>{" "}
                <span className="text-slate-400">For</span>{" "}
                <span className="text-white font-medium">{trace.sellQtyLabel}</span>{" "}
                <TokenChip symbol={trace.sellToken} />{" "}
                <span className="text-slate-500">({trace.sellUsdLabel})</span>{" "}
                <span className="text-slate-400">On</span> <ProtocolChip name={trace.sellDex} />
              </ActionRow>
              <ActionRow>
                <span className="text-slate-400">Repay</span>{" "}
                <span className="text-white font-medium">{trace.repayQtyLabel}</span>{" "}
                <TokenChip symbol={trace.loanToken} />{" "}
                <span className="text-slate-500">({trace.repayUsdLabel})</span>{" "}
                <span className="text-slate-400">To</span> <ProtocolChip name={aaveLabel} />
              </ActionRow>
            </ul>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
            <MetaRow
              label="Transaction Hash"
              hint="Hash unik transaksi on-chain / simulasi Testnet."
              icon={<Wallet className="w-3.5 h-3.5" />}
            >
              <span className="font-mono text-[12px] text-sky-300 break-all">{trace.txHash}</span>
              <button
                type="button"
                onClick={() => void copyHash()}
                className="ml-1.5 inline-flex items-center justify-center rounded-md p-1 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                title={copied ? "Tersalin" : "Salin hash"}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </MetaRow>
            <MetaRow label="Status" hint="Hasil eksekusi transaksi.">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-0.5 text-[12px] font-semibold text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Success
              </span>
            </MetaRow>
            <MetaRow
              label="Block"
              hint="Nomor blok saat transaksi disertakan."
              icon={<Cuboid className="w-3.5 h-3.5" />}
            >
              <span className="inline-flex items-center gap-2 flex-wrap">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-mono text-sky-300">{trace.blockNumber.toLocaleString("en-US")}</span>
                <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                  {trace.confirmations.toLocaleString("en-US")} Block Confirmations
                </span>
              </span>
            </MetaRow>
            <MetaRow
              label="Timestamp"
              hint="Waktu eksekusi (relatif dan UTC)."
              icon={<Clock className="w-3.5 h-3.5" />}
            >
              <span className="inline-flex items-center gap-2 flex-wrap text-[13px]">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-200">{trace.timestampRelative}</span>
                <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                  {trace.timestampUtc}
                </span>
              </span>
            </MetaRow>
            <MetaRow label="Value" hint="Nilai native yang dikirim bersama transaksi (flash loan = 0).">
              <span className="inline-flex items-center gap-1.5 text-slate-100">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-yellow-400/20 text-[9px] font-bold text-yellow-200">
                  {trace.nativeSymbol.slice(0, 1)}
                </span>
                {trace.valueNativeLabel}{" "}
                <span className="text-slate-500">({trace.valueUsdLabel})</span>
              </span>
            </MetaRow>
            <MetaRow
              label="Transaction Fee"
              hint="Biaya gas = gas used × gas price."
              icon={<Fuel className="w-3.5 h-3.5" />}
            >
              <span className="text-slate-100">
                {trace.gasFeeNative} {trace.nativeSymbol}{" "}
                <span className="ml-1 rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                  {trace.gasFeeUsdLabel}
                </span>
              </span>
            </MetaRow>
            <MetaRow label="Gas Price" hint="Harga gas per unit pada saat eksekusi." last>
              <span className="text-slate-100">
                {Number.isInteger(trace.gasPriceGwei)
                  ? `${trace.gasPriceGwei} Gwei`
                  : `${trace.gasPriceGwei.toFixed(4)} Gwei`}{" "}
                <span className="text-slate-500">({trace.gasPriceNativeLabel})</span>
              </span>
            </MetaRow>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ActionRow({ children }: { children: ReactNode }) {
  return <li className="px-4 py-2.5 text-slate-300">{children}</li>;
}

function MetaRow({
  label,
  hint,
  children,
  icon,
  last = false,
}: {
  label: string;
  hint: string;
  children: ReactNode;
  icon?: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-4 px-4 py-3 ${last ? "" : "border-b border-slate-800/80"}`}
    >
      <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
        {icon}
        <span>{label}</span>
        <span title={hint} className="text-slate-600">
          <CircleHelp className="w-3 h-3" />
        </span>
      </div>
      <div className="flex items-start sm:items-center min-w-0 text-[13px]">{children}</div>
    </div>
  );
}
