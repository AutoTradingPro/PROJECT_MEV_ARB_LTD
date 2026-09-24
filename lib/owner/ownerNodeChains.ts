import type { ChainId } from "@/lib/chain/networks";

/** Kartu Node RPC/WSS di Overview — termasuk rantai non-scanner. */
export const OWNER_NODE_CHAIN_IDS = [
  "ethereum",
  "polygon",
  "arbitrum",
  "optimism",
  "avalanche",
  "solana",
  "base",
  "bsc",
  "fantom",
] as const;

export type OwnerNodeChainId = (typeof OWNER_NODE_CHAIN_IDS)[number];

export function isOwnerNodeChainId(value: unknown): value is OwnerNodeChainId {
  return typeof value === "string" && (OWNER_NODE_CHAIN_IDS as readonly string[]).includes(value);
}

export function emptyOwnerChainFlags(value: boolean): Record<OwnerNodeChainId, boolean> {
  return Object.fromEntries(OWNER_NODE_CHAIN_IDS.map((id) => [id, value])) as Record<
    OwnerNodeChainId,
    boolean
  >;
}
