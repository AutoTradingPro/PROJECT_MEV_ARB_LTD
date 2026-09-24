import type { Opportunity } from "./types";
import { compareDirectedOpportunities } from "./dexDirections";

/** Urutan: pair katalog, lalu kedua arah DEX yang sama bersebelahan (A→B kemudian B→A). */
export function orderOpportunitiesByPairList(
  opportunities: Opportunity[],
  pairIds: string[]
): Opportunity[] {
  const index = new Map(pairIds.map((id, i) => [id, i]));
  return [...opportunities].sort((a, b) => {
    const da = index.get(a.pairId) ?? Number.MAX_SAFE_INTEGER;
    const db = index.get(b.pairId) ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    const directed = compareDirectedOpportunities(a, b);
    if (directed !== 0) return directed;
    return a.id.localeCompare(b.id);
  });
}
