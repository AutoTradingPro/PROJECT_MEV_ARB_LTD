import { dexLabel } from "@/lib/bot/constants";
import type { DexId, Opportunity } from "@/lib/bot/types";

export type DirectedDexRoute = {
  buyDex: DexId;
  sellDex: DexId;
};

/** Semua pasangan DEX aktif, kedua arah (A→B dan B→A) dalam tick yang sama. */
export function directedDexRoutes(active: DexId[]): DirectedDexRoute[] {
  const unique: DexId[] = [];
  const seen = new Set<DexId>();
  for (const id of active) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  const routes: DirectedDexRoute[] = [];
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const a = unique[i];
      const b = unique[j];
      routes.push({ buyDex: a, sellDex: b });
      routes.push({ buyDex: b, sellDex: a });
    }
  }
  return routes;
}

export function undirectedDexKey(buyDex: string, sellDex: string): string {
  return buyDex < sellDex ? `${buyDex}|${sellDex}` : `${sellDex}|${buyDex}`;
}

export function formatDexArrow(buyName: string, sellName: string): string {
  const buy = (buyName || "—").trim() || "—";
  const sell = (sellName || "—").trim() || "—";
  return `${buy} -> ${sell}`;
}

export function opportunityRouteLabel(
  opp: Pick<Opportunity, "buyDex" | "sellDex" | "buyExchange" | "sellExchange" | "dexAName" | "dexBName">
): string {
  const buy = opp.dexAName || opp.buyExchange || dexLabel(opp.buyDex);
  const sell = opp.dexBName || opp.sellExchange || dexLabel(opp.sellDex);
  return formatDexArrow(buy, sell);
}

export function compareDirectedOpportunities(a: Opportunity, b: Opportunity): number {
  const undirected = undirectedDexKey(a.buyDex, a.sellDex).localeCompare(undirectedDexKey(b.buyDex, b.sellDex));
  if (undirected !== 0) return undirected;
  const buy = String(a.buyDex).localeCompare(String(b.buyDex));
  if (buy !== 0) return buy;
  return String(a.sellDex).localeCompare(String(b.sellDex));
}
