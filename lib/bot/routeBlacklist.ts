import type { Opportunity } from "@/lib/bot/types";
import type { ChainId } from "@/lib/chain/networks";

/** Dua kegagalan selector-kosong beruntun → rute di-blacklist beberapa blok. */
export const EMPTY_REVERT_STREAK_TO_BAN = 2;
export const EMPTY_REVERT_BAN_BLOCKS = 12;

const TYPICAL_BLOCK_MS: Partial<Record<ChainId, number>> = {
  ethereum: 12_000,
  bsc: 3_000,
  polygon: 2_000,
  arbitrum: 250,
  optimism: 2_000,
  base: 2_000,
};

type Entry = {
  streak: number;
  untilBlock: number;
  untilMs: number;
};

const routes = new Map<string, Entry>();

export function routeBlacklistKey(
  opp: Pick<Opportunity, "chainId" | "pairId" | "buyDex" | "sellDex">
): string {
  return `${opp.chainId}:${opp.pairId}:${opp.buyDex}->${opp.sellDex}`;
}

function banWindowMs(chainId?: string): number {
  const id = (chainId || "ethereum") as ChainId;
  const blockMs = TYPICAL_BLOCK_MS[id] ?? 2_000;
  return EMPTY_REVERT_BAN_BLOCKS * Math.max(250, blockMs);
}

function prune(key: string, currentBlock: number): void {
  const row = routes.get(key);
  if (!row) return;
  const blockExpired = currentBlock > 0 && row.untilBlock > 0 && currentBlock > row.untilBlock;
  const timeExpired = Date.now() >= row.untilMs;
  if (row.untilBlock <= 0 && row.untilMs <= 0) return;
  if ((blockExpired || currentBlock <= 0) && timeExpired && row.streak < EMPTY_REVERT_STREAK_TO_BAN) {
    routes.delete(key);
  }
  if (blockExpired && timeExpired) {
    routes.delete(key);
  }
}

export function isRouteTemporarilyBlacklisted(
  key: string,
  currentBlock: number
): { blocked: boolean; untilBlock: number; remainBlocks: number } {
  prune(key, currentBlock);
  const row = routes.get(key);
  if (!row || (row.untilBlock <= 0 && row.untilMs <= Date.now())) {
    return { blocked: false, untilBlock: 0, remainBlocks: 0 };
  }
  const blockHit = currentBlock > 0 && row.untilBlock > 0 && currentBlock <= row.untilBlock;
  const timeHit = Date.now() < row.untilMs;
  if (!blockHit && !timeHit) {
    routes.delete(key);
    return { blocked: false, untilBlock: 0, remainBlocks: 0 };
  }
  const remainBlocks =
    currentBlock > 0 && row.untilBlock > currentBlock ? row.untilBlock - currentBlock : EMPTY_REVERT_BAN_BLOCKS;
  return { blocked: true, untilBlock: row.untilBlock, remainBlocks };
}

export function noteEmptySelectorRevert(
  key: string,
  currentBlock: number,
  chainId?: string
): { blacklisted: boolean; streak: number; untilBlock: number } {
  const prev = routes.get(key) ?? { streak: 0, untilBlock: 0, untilMs: 0 };
  const streak = prev.streak + 1;
  const blacklisted = streak >= EMPTY_REVERT_STREAK_TO_BAN;
  const untilBlock = blacklisted && currentBlock > 0 ? currentBlock + EMPTY_REVERT_BAN_BLOCKS : prev.untilBlock;
  const untilMs = blacklisted ? Date.now() + banWindowMs(chainId) : prev.untilMs;
  routes.set(key, { streak, untilBlock, untilMs });
  return { blacklisted, streak, untilBlock };
}

export function clearRouteBlacklist(key: string): void {
  routes.delete(key);
}
