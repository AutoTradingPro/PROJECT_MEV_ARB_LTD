/**
 * Saldo Solana (lamports + SPL USDC/USDT) via Ankr/QuickNode JSON-RPC.
 */
import { SOLANA_TOKENS, envSolanaRpcUrl } from "@/config/networks";
import { resolveChainRpc } from "@/lib/chain/networks";
import { redactEndpoint } from "@/lib/bot/rpc";
import { solanaAutonomousSignerStatus } from "@/lib/bot/solana/signer";

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

/** Alamat vault / owner Solana (base58) dari env — bukan 0x EVM. */
export function solanaVaultAddress(): string {
  return firstEnv(
    "SOLANA_VAULT_ADDRESS",
    "NEXT_PUBLIC_SOLANA_VAULT_ADDRESS",
    "SOLANA_OWNER_ADDRESS",
    "OWNER_SOLANA_ADDRESS"
  );
}

export function solanaSignerAddress(): string {
  // Utamakan alamat yang diturunkan dari PRIVATE_KEY_SOLANA bila ada.
  try {
    const fromKey = solanaAutonomousSignerStatus().address?.trim();
    if (fromKey) return fromKey;
  } catch {
    /* ignore — modul signer opsional saat bootstrap */
  }
  return firstEnv(
    "SOLANA_SIGNER_ADDRESS",
    "SOLANA_WALLET_ADDRESS",
    "NEXT_PUBLIC_SOLANA_WALLET",
    solanaVaultAddress()
  );
}

function rpcUrl(): string {
  return (resolveChainRpc("solana") || envSolanaRpcUrl() || "").trim();
}

async function solRpc<T>(method: string, params: unknown[]): Promise<T | null> {
  const url = rpcUrl();
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
    });
    const json = (await res.json()) as { result?: T; error?: { message?: string } };
    if (json.error?.message) throw new Error(json.error.message);
    return (json.result ?? null) as T | null;
  } catch (error) {
    console.warn(
      `[SOLANA-BAL] ${method} gagal @ ${redactEndpoint(url)}: ${
        error instanceof Error ? error.message : "unknown"
      }`
    );
    return null;
  }
}

export async function fetchSolanaLamports(address: string): Promise<bigint> {
  if (!address) return 0n;
  const result = await solRpc<{ value?: number } | number>("getBalance", [
    address,
    { commitment: "confirmed" },
  ]);
  if (result == null) return 0n;
  const lamports =
    typeof result === "number"
      ? result
      : typeof result === "object" && typeof result.value === "number"
        ? result.value
        : 0;
  return BigInt(Math.max(0, Math.floor(lamports)));
}

/** Saldo SPL token (amount already in token base units). */
export async function fetchSplTokenBalance(
  owner: string,
  mint: string
): Promise<{ amount: bigint; decimals: number }> {
  if (!owner || !mint) return { amount: 0n, decimals: 0 };
  const result = await solRpc<{
    value?: Array<{
      account?: {
        data?: {
          parsed?: {
            info?: {
              tokenAmount?: { amount?: string; decimals?: number; uiAmount?: number };
              mint?: string;
            };
          };
        };
      };
    }>;
  }>("getTokenAccountsByOwner", [
    owner,
    { mint },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);

  const rows = result?.value || [];
  let total = 0n;
  let decimals = 0;
  for (const row of rows) {
    const info = row.account?.data?.parsed?.info;
    if (!info || info.mint !== mint) continue;
    const ta = info.tokenAmount;
    if (!ta?.amount) continue;
    try {
      total += BigInt(ta.amount);
      decimals = typeof ta.decimals === "number" ? ta.decimals : decimals;
    } catch {
      /* skip */
    }
  }
  return { amount: total, decimals };
}

export function formatSolBalance(lamports: bigint): string {
  const n = Number(lamports) / 1e9;
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (n >= 0.0001) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

export function formatSplUi(amount: bigint, decimals: number): string {
  if (decimals <= 0) return amount.toString();
  const n = Number(amount) / 10 ** decimals;
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

export interface SolanaVaultBalances {
  address: string;
  solLamports: bigint;
  solFormatted: string;
  usdcAmount: bigint;
  usdcFormatted: string;
  usdtAmount: bigint;
  usdtFormatted: string;
}

export async function fetchSolanaVaultBalances(
  address = solanaVaultAddress() || solanaSignerAddress()
): Promise<SolanaVaultBalances | null> {
  if (!address) {
    console.log(
      "[SOLANA-BAL] Alamat vault kosong — set SOLANA_VAULT_ADDRESS / SOLANA_OWNER_ADDRESS di .env.local"
    );
    return null;
  }
  const [solLamports, usdc, usdt] = await Promise.all([
    fetchSolanaLamports(address),
    fetchSplTokenBalance(address, SOLANA_TOKENS.usdc),
    fetchSplTokenBalance(address, SOLANA_TOKENS.usdt),
  ]);
  const data: SolanaVaultBalances = {
    address,
    solLamports,
    solFormatted: formatSolBalance(solLamports),
    usdcAmount: usdc.amount,
    usdcFormatted: formatSplUi(usdc.amount, usdc.decimals || 6),
    usdtAmount: usdt.amount,
    usdtFormatted: formatSplUi(usdt.amount, usdt.decimals || 6),
  };
  console.log(
    `[SOLANA-BAL] ${address.slice(0, 4)}…${address.slice(-4)} · SOL ${data.solFormatted}` +
      ` · USDC ${data.usdcFormatted} · USDT ${data.usdtFormatted}`
  );
  return data;
}
