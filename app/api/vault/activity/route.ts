export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { isAddress } from "viem";
import { findUserByWallet } from "@/lib/db";
import { mevVaultProxy } from "@/lib/vault/mevVaultConfig";
import { queryVault, vaultPool } from "@/lib/vault/vaultIndexDb";

interface EventRow {
  kind: "deposit" | "withdraw" | "arb";
  user_address: string | null;
  assets: string | null;
  shares: string | null;
  profit: string | null;
  tx_hash: string;
  log_index: number;
  block_number: string;
  created_at: string;
}

interface CacheRow {
  user_id: string | null;
  shares: string;
  assets: string;
  updated_at: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet")?.trim() ?? "";
  const chainId = Number(url.searchParams.get("chainId"));
  if (!isAddress(wallet) || !Number.isInteger(chainId) || chainId <= 0) {
    return Response.json({ error: "wallet dan chainId wajib valid." }, { status: 400 });
  }
  const proxy = mevVaultProxy(chainId);
  if (!vaultPool() || !proxy) {
    return Response.json({ indexed: false, events: [], cache: null });
  }

  const walletKey = wallet.toLowerCase();
  const proxyKey = proxy.toLowerCase();
  const [events, cacheRows] = await Promise.all([
    queryVault<EventRow>(
      `SELECT kind, user_address, assets::text, shares::text, profit::text, tx_hash, log_index, block_number::text, created_at
       FROM vault_events
       WHERE chain_id = $1 AND proxy_address = $2 AND (user_address = $3 OR kind = 'arb')
       ORDER BY block_number DESC, log_index DESC
       LIMIT 40`,
      [chainId, proxyKey, walletKey],
    ),
    queryVault<CacheRow>(
      `SELECT user_id, shares::text, assets::text, updated_at
       FROM vault_position_cache
       WHERE chain_id = $1 AND proxy_address = $2 AND wallet_address = $3`,
      [chainId, proxyKey, walletKey],
    ),
  ]);

  const known = findUserByWallet(wallet);
  const cache = cacheRows[0]
    ? { ...cacheRows[0], user_id: cacheRows[0].user_id ?? known?.id ?? null }
    : null;
  return Response.json({ indexed: true, proxy, events, cache });
}
