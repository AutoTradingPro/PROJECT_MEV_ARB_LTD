import {
  DEX_A_TO_B_ROUTES,
  TARGET_PAIR_COUNT,
  TARGET_PAIR_IDS,
} from "@/lib/scanOnly/config.js";
import { defaultDexIdsForChain, dexLabel } from "@/lib/bot/dexRegistry";
import type { DexId } from "@/lib/bot/types";
import { getPair, pairsForChain } from "@/lib/chain/tokenPairs";
import type { ChainId } from "@/lib/chain/networks";
import type { ScanOnlyTarget } from "@/lib/scanOnly/types";

function asDexId(value: string, fallback: DexId): DexId {
  return (value || fallback) as DexId;
}

export function scanOnlyTargetsForChain(chainId: ChainId): ScanOnlyTarget[] {
  const catalog = pairsForChain(chainId);
  const configuredIds = TARGET_PAIR_IDS[chainId] as string[] | undefined;
  const pairIds = (configuredIds?.length ? configuredIds : catalog.map((p) => p.id)).slice(
    0,
    TARGET_PAIR_COUNT
  );
  const routes = (DEX_A_TO_B_ROUTES[chainId] as Array<[string, string]> | undefined) || [];
  const defaults = defaultDexIdsForChain(chainId);
  const dexAFallback = defaults[0] || "uniswap-v2";
  const dexBFallback = defaults[1] || defaults[0] || "uniswap-v2";

  const targets: ScanOnlyTarget[] = [];
  for (let i = 0; i < pairIds.length; i++) {
    const pair = getPair(chainId, pairIds[i]) || catalog[i];
    if (!pair) continue;
    const route = routes[i] || routes[0];
    const dexA = asDexId(route?.[0] || dexAFallback, dexAFallback);
    const dexB = asDexId(route?.[1] || dexBFallback, dexBFallback);
    targets.push({
      no: targets.length + 1,
      pairId: pair.id,
      pairLabel: pair.label,
      quoteSymbol: pair.quoteSymbol,
      quoteDecimals: pair.quoteDecimals ?? 18,
      dexA,
      dexB,
    });
  }
  return targets;
}

export function scanOnlyDexIdsForChain(chainId: ChainId): DexId[] {
  const ids = new Set<DexId>();
  for (const target of scanOnlyTargetsForChain(chainId)) {
    ids.add(target.dexA);
    ids.add(target.dexB);
  }
  for (const id of defaultDexIdsForChain(chainId)) ids.add(id);
  return [...ids];
}

export function formatScanOnlyRoute(dexA: DexId, dexB: DexId): string {
  return `${dexLabel(dexA) || dexA} -> ${dexLabel(dexB) || dexB}`;
}
