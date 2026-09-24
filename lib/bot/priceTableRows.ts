import type { ChainId } from "@/lib/chain/networks";
import type { TokenPairConfig } from "@/lib/chain/tokenPairs";
import { defaultDexIdsForChain, dexLabel } from "./constants";
import { undirectedDexKey } from "./dexDirections";
import type { DexId, Opportunity } from "./types";

export const PRICE_TABLE_COLUMN_COUNT = 9;

/** Status row shown when no ready/valid-spread route (including wait-and-see). */
export const PRICE_TABLE_NO_SPREAD_STATUS =
  "Memindai... Tidak ada spread valid ditemukan saat ini";

export type LastSpotQuote = {
  pairId: string;
  routeKey: string;
  dexAName: string;
  dexBName: string;
  priceDexAUsd?: number;
  priceDexBUsd?: number;
  spreadBps?: number;
  live?: boolean;
};

export type PriceTableRow =
  | {
      kind: "quote";
      key: string;
      pair: TokenPairConfig;
      opportunity: Opportunity;
    }
  | {
      kind: "skeleton";
      key: string;
      pair: TokenPairConfig;
      dexAName: string;
      dexBName: string;
      priceDexAUsd?: number;
      priceDexBUsd?: number;
      spreadBps?: number;
      live?: boolean;
    };

export function catalogPairsForTable(
  availablePairs: TokenPairConfig[] | undefined,
  selectedPair: TokenPairConfig,
  scanMode: "single" | "full" = "single"
): TokenPairConfig[] {
  if (scanMode === "full" && availablePairs && availablePairs.length > 0) return availablePairs;
  return [selectedPair];
}

export function placeholderDexPair(
  chainId: string,
  activeDexIds?: DexId[]
): { dexA: string; dexB: string } {
  const allowed = new Set(defaultDexIdsForChain(chainId as ChainId));
  const selected = (activeDexIds ?? []).filter((id) => allowed.has(id) || Boolean(id));
  const ids =
    selected.length >= 2 ? selected : selected.length === 1 ? [...selected, ...defaultDexIdsForChain(chainId as ChainId)] : defaultDexIdsForChain(chainId as ChainId);
  const unique = [...new Set(ids.filter(Boolean))];
  const dexAId = unique[0];
  const dexBId = unique.find((id) => id !== dexAId) ?? unique[0];
  return {
    dexA: dexAId ? dexLabel(dexAId) : "DEX A",
    dexB: dexBId ? dexLabel(dexBId) : "DEX B",
  };
}

function quoteRouteKey(opp: Opportunity): string {
  return `${opp.pairId}::${opp.buyDex}::${opp.sellDex}`;
}

/** Persist last RPC spot quotes so empty scans still show prices instead of blank cells. */
export function captureLastSpotQuotes(
  store: Map<string, LastSpotQuote>,
  opportunities: Opportunity[]
): void {
  for (const opp of opportunities) {
    if (!opp.pairId) continue;
    const hasPrice =
      (typeof opp.priceDexAUsd === "number" && opp.priceDexAUsd > 0) ||
      (typeof opp.priceDexBUsd === "number" && opp.priceDexBUsd > 0);
    if (!hasPrice) continue;
    const routeKey = quoteRouteKey(opp);
    store.set(routeKey, {
      pairId: opp.pairId,
      routeKey,
      dexAName: opp.dexAName || opp.buyExchange || "",
      dexBName: opp.dexBName || opp.sellExchange || "",
      priceDexAUsd: opp.priceDexAUsd,
      priceDexBUsd: opp.priceDexBUsd,
      spreadBps: opp.spreadBps,
      live: opp.live,
    });
  }
}

function sortQuotes(a: Opportunity, b: Opportunity): number {
  const undirected = undirectedDexKey(a.buyDex, a.sellDex).localeCompare(undirectedDexKey(b.buyDex, b.sellDex));
  if (undirected !== 0) return undirected;
  return String(a.buyDex).localeCompare(String(b.buyDex));
}

/**
 * One or more rows per catalog pair: both DEX directions when quotes exist.
 */
export function buildPriceTableRows(input: {
  catalog: TokenPairConfig[];
  opportunities: Opportunity[];
  lastQuotes: Map<string, LastSpotQuote>;
  chainId: string;
  activeDexIds?: DexId[];
}): PriceTableRow[] {
  const { catalog, opportunities, lastQuotes, chainId, activeDexIds } = input;
  const placeholders = placeholderDexPair(chainId, activeDexIds);
  const allowed = new Set(catalog.map((pair) => pair.id));
  const byPair = new Map<string, Opportunity[]>();

  for (const opp of opportunities) {
    if (!allowed.has(opp.pairId)) continue;
    const list = byPair.get(opp.pairId);
    if (list) list.push(opp);
    else byPair.set(opp.pairId, [opp]);
  }

  const rows: PriceTableRow[] = [];
  for (const pair of catalog) {
    const quotes = byPair.get(pair.id);
    if (quotes && quotes.length > 0) {
      for (const opportunity of [...quotes].sort(sortQuotes)) {
        rows.push({
          kind: "quote",
          key: opportunity.id,
          pair,
          opportunity,
        });
      }
      continue;
    }
    const lastForPair = [...lastQuotes.values()].filter((item) => item.pairId === pair.id);
    if (lastForPair.length > 0) {
      for (const last of lastForPair) {
        rows.push({
          kind: "skeleton",
          key: `skeleton-${last.routeKey}`,
          pair,
          dexAName: last.dexAName || placeholders.dexA,
          dexBName: last.dexBName || placeholders.dexB,
          priceDexAUsd: last.priceDexAUsd,
          priceDexBUsd: last.priceDexBUsd,
          spreadBps: last.spreadBps,
          live: last.live,
        });
      }
      continue;
    }
    rows.push({
      kind: "skeleton",
      key: `skeleton-${pair.id}-fwd`,
      pair,
      dexAName: placeholders.dexA,
      dexBName: placeholders.dexB,
    });
    if (placeholders.dexA !== placeholders.dexB) {
      rows.push({
        kind: "skeleton",
        key: `skeleton-${pair.id}-rev`,
        pair,
        dexAName: placeholders.dexB,
        dexBName: placeholders.dexA,
      });
    }
  }
  return rows;
}

export function priceTableStatusMessage(input: {
  hasReady: boolean;
  rowCount: number;
}): string | null {
  if (input.hasReady) return null;
  if (input.rowCount <= 0) return PRICE_TABLE_NO_SPREAD_STATUS;
  return PRICE_TABLE_NO_SPREAD_STATUS;
}
