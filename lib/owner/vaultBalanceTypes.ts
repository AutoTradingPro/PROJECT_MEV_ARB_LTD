import type { ChainId } from "@/lib/chain/networks";

export interface AddressBalance {
  chainId: ChainId;
  address: string;
  symbol: string;
  label: string;
  error?: string;
}

export interface VaultBalanceSnapshot {
  vaults: AddressBalance[];
  wallets: AddressBalance[];
}
