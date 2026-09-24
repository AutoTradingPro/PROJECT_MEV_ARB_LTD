export type UserDashboardTab = "profile" | "money" | "staking" | "affiliate";

export const USER_DASHBOARD_TABS: { id: UserDashboardTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "money", label: "Money Management" },
  { id: "staking", label: "Staking" },
  { id: "affiliate", label: "Affiliate" },
];

export function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function affiliateLinkForUsername(username: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?ref=${encodeURIComponent(username)}`;
}
