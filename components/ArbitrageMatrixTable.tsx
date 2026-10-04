"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { LoaderCircle, Play } from "lucide-react";
import { useNetwork } from "@/context/NetworkContext";
import type { ProScanMode } from "@/context/TierContext";
import { pctToBps } from "@/lib/bot/configUnits";
import { formatBps } from "@/lib/bot/dexMath";
import { dexLabel } from "@/lib/bot/constants";
import { formatUsdPrice, spreadColorClass } from "@/lib/bot/pricing";
import { formatPoolLiquidityLabel } from "@/lib/bot/poolSafety";
import {
  PRICE_TABLE_COLUMN_COUNT,
  PRICE_TABLE_NO_SPREAD_STATUS,
  buildPriceTableRows,
  captureLastSpotQuotes,
  catalogPairsForTable,
  priceTableStatusMessage,
  type LastSpotQuote,
} from "@/lib/bot/priceTableRows";
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import type { TokenPairConfig } from "@/lib/chain/tokenPairs";

export interface ArbitrageMatrixTableProps {
  opportunities: Opportunity[];
  selectedPair: TokenPairConfig;
  availablePairs?: TokenPairConfig[];
  /** single = hanya pair terpilih; full = seluruh katalog rantai. */
  scanMode?: ProScanMode;
  onSelectPair?: (id: string) => void;
  minSpreadPct?: number;
  executingId?: string | null;
  walletConnected?: boolean;
  sandboxMode?: boolean;
  showExecute?: boolean;
  config?: BotConfig;
  onExecute?: (opp: Opportunity, config: BotConfig) => void;
  emptyMessage?: string;
  /** True while a scan cycle is in flight or the Pro scanner is armed. */
  scanning?: boolean;
  /** Hanya mode PRO: toggle collapse/expand seluruh baris data. */
  rowsToggle?: boolean;
}

function canExecuteRow(opp: Opportunity, _minSpreadBps: number): boolean {
  return opp.status === "ready" || opp.status === "validated";
}

function executeTitle(
  opp: Opportunity,
  config: BotConfig | undefined,
  walletConnected: boolean,
  sandboxMode: boolean
): string {
  if (!walletConnected && !sandboxMode) return "Hubungkan dompet MetaMask terlebih dahulu";
  const cfg = config;
  return [
    `Pair: ${opp.tokenPair}`,
    `Beli: ${opp.dexAName || opp.buyExchange} -> Jual: ${opp.dexBName || opp.sellExchange}`,
    `Price beli ${formatUsdPrice(opp.priceDexAUsd)} · Price jual ${formatUsdPrice(opp.priceDexBUsd)}`,
    `Spread: ${formatBps(opp.spreadBps)}`,
    `Liq min: ${formatPoolLiquidityLabel(opp.poolLiquidityUsd)} (beli ${formatPoolLiquidityLabel(opp.buyLiquidityUsd)} / jual ${formatPoolLiquidityLabel(opp.sellLiquidityUsd)})`,
    cfg ? `Min spread: ${cfg.minSpreadPct}% · Slippage: fleksibel (0.5%–1.0%) · Min profit loan × 0.05%` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function RowsVisibilitySwitch({
  showRows,
  onToggle,
}: {
  showRows: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={showRows}
      aria-label={showRows ? "Hide all data rows" : "Show all data rows"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className="relative z-10 inline-flex items-center gap-1.5 cursor-pointer select-none shrink-0"
      title={showRows ? "Hide all data rows" : "Show all data rows"}
    >
      <span className={`text-[9px] font-bold uppercase tracking-wide ${showRows ? "text-emerald-300" : "text-slate-500"}`}>
        {showRows ? "Show" : "Hide"}
      </span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          showRows ? "bg-emerald-500" : "bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            showRows ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function PairIcons({ pair }: { pair: TokenPairConfig }) {
  const baseSrc = pair.baseIcon?.trim() || "";
  const quoteSrc = pair.quoteIcon?.trim() || "";
  return (
    <div className="flex -space-x-1.5 shrink-0">
      {baseSrc ? (
        <Image
          src={baseSrc}
          alt={pair.baseSymbol}
          width={22}
          height={22}
          className="rounded-full border border-slate-700 bg-slate-900"
          unoptimized
        />
      ) : (
        <span className="inline-block h-[22px] w-[22px] rounded-full border border-slate-700 bg-slate-800" />
      )}
      {quoteSrc ? (
        <Image
          src={quoteSrc}
          alt={pair.quoteSymbol}
          width={22}
          height={22}
          className="rounded-full border border-slate-700 bg-slate-900"
          unoptimized
        />
      ) : (
        <span className="inline-block h-[22px] w-[22px] rounded-full border border-slate-700 bg-slate-800" />
      )}
    </div>
  );
}

export default function ArbitrageMatrixTable({
  opportunities,
  selectedPair,
  availablePairs,
  scanMode = "single",
  onSelectPair,
  minSpreadPct = 0,
  executingId = null,
  walletConnected = false,
  sandboxMode = false,
  showExecute = false,
  config,
  onExecute,
  emptyMessage = PRICE_TABLE_NO_SPREAD_STATUS,
  scanning = false,
  rowsToggle = false,
}: ArbitrageMatrixTableProps) {
  const { chainId } = useNetwork();
  const minSpreadBps = pctToBps(minSpreadPct);
  const [showRows, setShowRows] = useState(true);
  const lastQuotes = useRef<Map<string, LastSpotQuote>>(new Map());
  captureLastSpotQuotes(lastQuotes.current, opportunities);

  const catalog = catalogPairsForTable(availablePairs, selectedPair, scanMode);
  const rows = buildPriceTableRows({
    catalog,
    opportunities,
    lastQuotes: lastQuotes.current,
    chainId,
    activeDexIds: config?.activeDexIds,
  });
  const hasReady = opportunities.some((item) => item.status === "ready");
  const statusMessage =
    priceTableStatusMessage({ hasReady, rowCount: rows.length }) ?? emptyMessage;
  const rowsVisible = !rowsToggle || showRows;
  const showStatus = rowsVisible && !hasReady;
  const showPairRows = rowsVisible;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800/80 min-h-[280px]">
      <table className="w-full text-left border-collapse text-xs font-mono min-w-[960px]">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] bg-slate-950/50">
            <th className="py-3 px-3 w-10">No.</th>
            <th className="py-3 px-3 min-w-[140px]">Pasangan Pair</th>
            <th className="py-3 px-3">DEX beli</th>
            <th className="py-3 px-3 text-right">Price beli</th>
            <th className="py-3 px-3">DEX jual</th>
            <th className="py-3 px-3 text-right">Price jual</th>
            <th className="py-3 px-3 text-right">Spread %</th>
            <th className="py-3 px-3 text-right">Liq USD</th>
            <th className="py-3 px-3 text-right">
              <div className="inline-flex w-full items-center justify-end gap-2">
                <span>Select</span>
                {rowsToggle ? (
                  <RowsVisibilitySwitch
                    showRows={showRows}
                    onToggle={() => setShowRows((value) => !value)}
                  />
                ) : null}
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {showStatus ? (
            <tr data-price-table="status">
              <td
                colSpan={PRICE_TABLE_COLUMN_COUNT}
                className="py-3 px-4 text-amber-200/90 text-center font-sans bg-amber-500/5"
                aria-live="polite"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {scanning ? <LoaderCircle className="w-3.5 h-3.5 animate-spin shrink-0" /> : null}
                  {statusMessage}
                </span>
              </td>
            </tr>
          ) : !showPairRows ? (
            <tr data-price-table="status">
              <td
                colSpan={PRICE_TABLE_COLUMN_COUNT}
                className="py-3 px-4 text-slate-500 text-center font-sans"
              >
                Baris data disembunyikan
              </td>
            </tr>
          ) : null}

          {showPairRows &&
            rows.map((row, index) => {
              if (row.kind === "skeleton") {
                const highlighted = row.pair.id === selectedPair.id;
                return (
                  <tr
                    key={row.key}
                    data-price-table="skeleton"
                    className={`transition-colors align-middle ${
                      highlighted ? "bg-amber-500/10" : "hover:bg-slate-800/30"
                    }`}
                  >
                    <td className="py-3 px-3 text-slate-500 tabular-nums">{index + 1}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <PairIcons pair={row.pair} />
                        <button
                          type="button"
                          className="min-w-0 text-left cursor-pointer"
                          onClick={() => onSelectPair?.(row.pair.id)}
                        >
                          <span className="font-bold text-white block truncate">{row.pair.label}</span>
                          <span className="text-[9px] uppercase tracking-wide text-slate-500">
                            {row.dexAName} -&gt; {row.dexBName}
                          </span>
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-blue-400/80 font-semibold whitespace-nowrap">
                        {row.dexAName}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-200">
                      {formatUsdPrice(row.priceDexAUsd)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-amber-400/80 font-semibold whitespace-nowrap">
                        {row.dexBName}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-200">
                      {formatUsdPrice(row.priceDexBUsd)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-bold tabular-nums text-slate-500">
                        {typeof row.spreadBps === "number" && Number.isFinite(row.spreadBps)
                          ? formatBps(row.spreadBps)
                          : "—"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-500">—</td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-500">Memindai</span>
                    </td>
                  </tr>
                );
              }

              const opp = row.opportunity;
              const busy = executingId === opp.id;
              const eligible = canExecuteRow(opp, minSpreadBps);
              const canSend = walletConnected || sandboxMode;
              const disabled = !showExecute || !eligible || busy || !canSend || !onExecute || !config;
              const highlighted = opp.pairId === selectedPair.id;

              return (
                <tr
                  key={row.key}
                  data-price-table="quote"
                  className={`transition-colors align-middle ${
                    highlighted ? "bg-amber-500/10" : "hover:bg-slate-800/30"
                  }`}
                >
                  <td className="py-3 px-3 text-slate-500 tabular-nums">{index + 1}</td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <PairIcons pair={row.pair} />
                      <button
                        type="button"
                        className="min-w-0 text-left cursor-pointer"
                        onClick={() => onSelectPair?.(opp.pairId)}
                      >
                        <span className="font-bold text-white block truncate">{opp.tokenPair}</span>
                        <span className="text-[9px] uppercase tracking-wide text-slate-400">
                          {opp.dexAName || opp.buyExchange || dexLabel(opp.buyDex)} -&gt;{" "}
                          {opp.dexBName || opp.sellExchange || dexLabel(opp.sellDex)}
                        </span>
                        <span
                          className={`text-[9px] uppercase tracking-wide ${
                            opp.live ? "text-emerald-400" : "text-slate-500"
                          }`}
                        >
                          {opp.live ? "live" : "offline"}
                        </span>
                      </button>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="text-blue-400 font-semibold whitespace-nowrap">
                      {opp.dexAName || opp.buyExchange || dexLabel(opp.buyDex)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-slate-200">
                    {formatUsdPrice(opp.priceDexAUsd)}
                  </td>

                  <td className="py-3 px-3">
                    <span className="text-amber-400 font-semibold whitespace-nowrap">
                      {opp.dexBName || opp.sellExchange || dexLabel(opp.sellDex)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-slate-200">
                    {formatUsdPrice(opp.priceDexBUsd)}
                  </td>

                  <td className="py-3 px-3 text-right">
                    <span className={`font-bold tabular-nums ${spreadColorClass(opp.spreadBps, minSpreadBps)}`}>
                      {formatBps(opp.spreadBps)}
                    </span>
                  </td>

                  <td
                    className="py-3 px-3 text-right tabular-nums text-slate-200"
                    title={`Beli ${formatPoolLiquidityLabel(opp.buyLiquidityUsd)} · Jual ${formatPoolLiquidityLabel(opp.sellLiquidityUsd)}`}
                  >
                    {formatPoolLiquidityLabel(opp.poolLiquidityUsd)}
                  </td>

                  <td className="py-3 px-3 text-right">
                    {showExecute && config && onExecute ? (
                      <button
                        type="button"
                        disabled={disabled}
                        title={executeTitle(opp, config, walletConnected, sandboxMode)}
                        onClick={() => onExecute(opp, config)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          eligible && canSend
                            ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 hover:from-amber-300 hover:to-yellow-200 shadow-lg shadow-amber-400/15"
                            : "bg-slate-800 text-slate-500 border border-slate-700"
                        }`}
                      >
                        {busy ? (
                          <LoaderCircle className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3 fill-current" />
                        )}
                        {busy ? "Signing…" : sandboxMode && eligible ? "Mock Exec" : eligible ? "Execute" : "Rejected"}
                      </button>
                    ) : (
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          opp.status === "ready" || opp.status === "validated"
                            ? "text-emerald-400"
                            : "text-slate-500"
                        }`}
                      >
                        {opp.status === "validated"
                          ? "Validated"
                          : opp.status === "ready"
                            ? "Siap"
                            : "Rejected"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
