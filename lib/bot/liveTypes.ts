import type { ConsoleLine, FeedBadge, FeedRow } from "@/components/mev-core/types";

export type LiveServerMessage =
  | { type: "snapshot"; feed: FeedRow[]; logs: ConsoleLine[] }
  | { type: "feed"; rows: FeedRow[] }
  | { type: "log"; line: ConsoleLine }
  | { type: "ARBITRAGE_FEED"; rows: FeedRow[] }
  | { type: "CONSOLE_LOG"; line: ConsoleLine };

export type LivePublishMessage =
  | { type: "publish-feed"; rows: FeedRow[] }
  | { type: "publish-log"; line: ConsoleLine }
  | { type: "publish-status"; id: string; status: FeedBadge };

export const MEV_LIVE_PORT = Number(process.env.MEV_LIVE_PORT || process.env.NEXT_PUBLIC_MEV_LIVE_PORT || 4101);
