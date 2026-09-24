/**
 * Client-safe Solana balance fetch via server API (RPC credentials stay server-only).
 */
export async function fetchSolanaWalletBalance(address: string): Promise<{
  balance: string;
  lamports: string;
}> {
  const addr = (address || "").trim();
  if (!addr) return { balance: "0", lamports: "0" };
  const res = await fetch(`/api/wallet/solana-balance?address=${encodeURIComponent(addr)}`, {
    cache: "no-store",
  });
  const json = (await res.json()) as {
    ok?: boolean;
    balance?: string;
    lamports?: string;
    error?: string;
  };
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return {
    balance: typeof json.balance === "string" ? json.balance : "0",
    lamports: typeof json.lamports === "string" ? json.lamports : "0",
  };
}
