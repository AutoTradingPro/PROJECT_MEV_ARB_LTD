import { isAddress } from "viem";

/** Deployed MevVault asset: native USDC on Arbitrum One. */
export const MEV_VAULT_CHAIN_ID = 42161;
export const MEV_VAULT_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;

const PROXIES: Record<number, string | undefined> = {
  1: process.env.NEXT_PUBLIC_MEV_VAULT_1,
  10: process.env.NEXT_PUBLIC_MEV_VAULT_10,
  56: process.env.NEXT_PUBLIC_MEV_VAULT_56,
  137: process.env.NEXT_PUBLIC_MEV_VAULT_137,
  250: process.env.NEXT_PUBLIC_MEV_VAULT_250,
  8453: process.env.NEXT_PUBLIC_MEV_VAULT_8453,
  324: process.env.NEXT_PUBLIC_MEV_VAULT_324,
  42161: process.env.NEXT_PUBLIC_MEV_VAULT_42161,
  43114: process.env.NEXT_PUBLIC_MEV_VAULT_43114,
};

export function mevVaultProxy(chainId: number | null | undefined): `0x${string}` | null {
  if (chainId == null) return null;
  const raw = PROXIES[chainId]?.trim();
  if (!raw || !isAddress(raw)) return null;
  return raw;
}
