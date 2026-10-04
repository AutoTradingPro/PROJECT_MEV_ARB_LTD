export type FeedBadge = "validated" | "ready" | "queued" | "executed" | "reverted" | "skipped";

export interface FeedRow {
  id: string;
  pair: string;
  route: string;
  /** Spread dalam persen. 0.16 berarti 0.16%. */
  spreadPct: number;
  gasEth: number;
  netEth: number;
  netUsd: number;
  status: FeedBadge;
  live?: boolean;
  chainId?: string;
  /** Nominal pinjaman dalam USD. */
  loanUsd?: number;
  /** Biaya gas dalam USD. */
  gasUsd?: number;
  /** Tip/bribe dalam USD. */
  bribeUsd?: number;
}

export interface ConsoleLine {
  id: string;
  time: string;
  tag: string;
  message: string;
  tone: "ok" | "warn" | "muted" | "info" | "error";
  chainId?: string;
}
