export type OwnerUserTier = "free" | "pro-1" | "pro-2" | "pro-3" | "affiliate";

export type OwnerUserListFilter =
  | "all"
  | "free"
  | "pro-1"
  | "pro-2"
  | "pro-3"
  | "staking"
  | "affiliate"
  | "suspended";

export interface OwnerUser {
  id: string;
  username: string;
  email: string;
  wallet: string;
  telegramId: string;
  telegramUsername?: string;
  mainBalanceUsd: number;
  affiliateBalanceUsd: number;
  stakingActive: boolean;
  stakedUsd: number;
  tier: OwnerUserTier;
  suspended?: boolean;
  registeredAt: string;
}

export const OWNER_TIER_LABEL: Record<OwnerUserTier, string> = {
  free: "Free",
  "pro-1": "Pro 1",
  "pro-2": "Pro 2",
  "pro-3": "Pro 3",
  affiliate: "Affiliate",
};

export const USER_LIST_FILTERS: { id: OwnerUserListFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "free", label: "Free" },
  { id: "pro-1", label: "User Pro 1" },
  { id: "pro-2", label: "User Pro 2" },
  { id: "pro-3", label: "User Pro 3" },
  { id: "staking", label: "User Staking" },
  { id: "affiliate", label: "User Affiliate" },
  { id: "suspended", label: "Suspended" },
];

export const OWNER_TIER_OPTIONS: { id: OwnerUserTier; label: string }[] = [
  { id: "free", label: "Free" },
  { id: "pro-1", label: "Pro 1" },
  { id: "pro-2", label: "Pro 2" },
  { id: "pro-3", label: "Pro 3" },
  { id: "affiliate", label: "Affiliate" },
];
