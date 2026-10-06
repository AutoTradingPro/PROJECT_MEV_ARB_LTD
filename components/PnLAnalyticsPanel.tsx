"use client";

import { useMemo, useState } from "react";
import { Activity, Fuel, TrendingUp } from "lucide-react";
import TransactionTraceModal from "@/components/TransactionTraceModal";
import { formatStableWeiAsBnb } from "@/lib/bot/bnbQuote";
import { formatGasNetworkDisplay } from "@/lib/bot/autoExecute";
import { DEFAULT_BOT_CONFIG } from "@/lib/bot/constants";
import { resolveTradeTrace, type TradeTraceContext } from "@/lib/bot/transactionTrace";
import type { TradeRecord } from "@/lib/bot/types";
import { shortenTxHash } from "@/lib/chain/explorer";

interface PnLAnalyticsPanelProps {
  realizedProfitWei: string;
  gasPriceWei: string;
  lastBlock: number;
  trades: TradeRecord[];
  gasLimit?: number;
  aaveFeePct?: number;
  loanAmountUsd?: number;
  isSandbox?: boolean;
  isPro?: boolean;
  nativeSymbol?: string;
}

export default function PnLAnalyticsPanel({
  realizedProfitWei,
  gasPriceWei,
  lastBlock,
  trades,
  gasLimit = DEFAULT_BOT_CONFIG.gasLimit,
  aaveFeePct = DEFAULT_BOT_CONFIG.aaveFeePct,
  loanAmountUsd = DEFAULT_BOT_CONFIG.loanAmountUsd,
  isSandbox = false,
  isPro = true,
  nativeSymbol = "BNB",
}: PnLAnalyticsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const gasDisplay = formatGasNetworkDisplay(gasPriceWei, nativeSymbol);

  const traceCtx: TradeTraceContext = useMemo(
    () => ({
      lastBlock,
      gasPriceWei,
      gasLimit,
      aaveFeePct,
      loanAmountUsd,
      isSandbox,
      isPro,
    }),
    [lastBlock, gasPriceWei, gasLimit, aaveFeePct, loanAmountUsd, isSandbox, isPro]
  );

  const selectedTrade = trades.find((trade) => trade.id === selectedId) ?? null;
  const resolvedTrace = selectedTrade ? resolveTradeTrace(selectedTrade, traceCtx) : null;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold tracking-wide">P&amp;L Analytics</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Profit bersih
          </span>
          <p className="font-mono text-emerald-400 font-bold mt-1">
            {formatStableWeiAsBnb(realizedProfitWei, 4, nativeSymbol)}
          </p>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
            <Fuel className="w-3 h-3" /> Gas jaringan
          </span>
          <p className="font-mono text-amber-400 font-bold mt-1">{gasDisplay.primary}</p>
          {gasDisplay.secondary ? (
            <p className="mt-0.5 font-mono text-[10px] text-slate-500">{gasDisplay.secondary}</p>
          ) : null}
        </div>
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <span className="text-[10px] uppercase text-slate-500 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Blok
          </span>
          <p className="font-mono text-slate-100 font-bold mt-1">#{lastBlock || "—"}</p>
        </div>
      </div>
      <div className="touch-scroll">
        <table className="w-full text-left text-[11px] font-mono">
          <thead>
            <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
              <th className="py-2 pr-3">Waktu</th>
              <th className="py-2 pr-3">Rute</th>
              <th className="py-2 pr-3">Hasil</th>
              <th className="py-2 pr-3">Tx Hash</th>
              <th className="py-2">Net</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-slate-500">
                  Belum ada transaksi. Mode Testnet menambahkan baris di sini setelah eksekusi flashloan (manual di Free, auto-exec di Pro).
                </td>
              </tr>
            )}
            {trades.map((trade) => {
              const clickable = trade.outcome === "success" && Boolean(trade.txHash);
              return (
                <tr key={trade.id} className="border-b border-slate-800/60">
                  <td className="py-2 pr-3 text-slate-400">{new Date(trade.at).toLocaleTimeString()}</td>
                  <td className="py-2 pr-3 text-slate-200">{trade.route}</td>
                  <td className="py-2 pr-3 text-slate-300">{trade.outcome}</td>
                  <td className="py-2 pr-3">
                    {trade.txHash ? (
                      clickable ? (
                        <button
                          type="button"
                          onClick={() => setSelectedId(trade.id)}
                          className="text-sky-400 hover:text-sky-300 underline decoration-sky-700/70 underline-offset-2 cursor-pointer"
                          title="Buka jejak transaksi"
                        >
                          {shortenTxHash(trade.txHash)}
                        </button>
                      ) : (
                        <span className="text-slate-500">{shortenTxHash(trade.txHash)}</span>
                      )
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-2 text-emerald-400">{formatStableWeiAsBnb(trade.netProfitWei)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TransactionTraceModal
        open={Boolean(selectedTrade)}
        onClose={() => setSelectedId(null)}
        trace={resolvedTrace}
        sandbox={isSandbox}
      />
    </div>
  );
}
