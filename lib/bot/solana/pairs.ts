/**
 * 10 pasangan populer Solana + konstanta fee Kamino K-Lend (0.001%).
 * Sumber kanonik untuk worker Solana (terpisah dari katalog EVM).
 */
import { pairsForChain, type TokenPairConfig } from "@/lib/chain/tokenPairs";

/** Fee flash borrow Kamino K-Lend — 0.001%. */
export const SOLANA_KAMINO_FLASH_FEE_PCT = 0.001;

export const SOLANA_POPULAR_PAIR_IDS = [
  "sol-usdc",
  "sol-usdt",
  "jup-usdc",
  "bonk-sol",
  "wif-sol",
  "pyth-usdc",
  "ray-usdc",
  "jto-sol",
  "msol-sol",
  "bsol-sol",
] as const;

export type SolanaPopularPairId = (typeof SOLANA_POPULAR_PAIR_IDS)[number];

export function solanaPopularPairs(): TokenPairConfig[] {
  const all = pairsForChain("solana");
  return SOLANA_POPULAR_PAIR_IDS.map((id) => all.find((p) => p.id === id)).filter(
    (p): p is TokenPairConfig => Boolean(p)
  );
}

export function defaultSolanaPairIds(requested?: string[]): string[] {
  if (requested?.length) {
    const allowed = new Set(SOLANA_POPULAR_PAIR_IDS as readonly string[]);
    const filtered = requested.filter((id) => allowed.has(id));
    if (filtered.length) return filtered;
  }
  return [...SOLANA_POPULAR_PAIR_IDS];
}
