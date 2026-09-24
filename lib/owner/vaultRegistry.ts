import type { ChainId } from "@/lib/chain/networks";
import { CHAINS } from "@/lib/chain/networks";
import { publicArbitrumArbitrageExecutor, publicBscVaultContract } from "@/lib/chain/publicEnv";
import { ARBITRUM_BALANCER_FLASH_ARB, BALANCER_V2_VAULT } from "@/config/networks";

export interface VaultRegistry {
  vaultContracts: Record<ChainId, string>;
  operationalWallets: Record<ChainId, string>;
}

type RegistryGlobal = typeof globalThis & {
  __mevVaultRegistry?: VaultRegistry;
};

function emptyAddresses(): Record<ChainId, string> {
  return Object.fromEntries(CHAINS.map((chain) => [chain.id, ""])) as Record<ChainId, string>;
}

function seedRegistry(): VaultRegistry {
  const vaultContracts = emptyAddresses();
  vaultContracts.bsc = publicBscVaultContract().trim();
  const arb =
    publicArbitrumArbitrageExecutor().trim() || ARBITRUM_BALANCER_FLASH_ARB;
  vaultContracts.arbitrum =
    arb.toLowerCase() === BALANCER_V2_VAULT.toLowerCase() ? ARBITRUM_BALANCER_FLASH_ARB : arb;
  vaultContracts.polygon = (
    process.env.NEXT_PUBLIC_POLYGON_ARBITRAGE_EXECUTOR ||
    process.env.POLYGON_BALANCER_FLASH_ARB ||
    ""
  ).trim();
  vaultContracts.ethereum = (
    process.env.NEXT_PUBLIC_ETHEREUM_ARBITRAGE_EXECUTOR ||
    process.env.ETHEREUM_BALANCER_FLASH_ARB ||
    ""
  ).trim();
  return {
    vaultContracts,
    operationalWallets: emptyAddresses(),
  };
}

export function getVaultRegistry(): VaultRegistry {
  const g = globalThis as RegistryGlobal;
  if (!g.__mevVaultRegistry) {
    g.__mevVaultRegistry = seedRegistry();
    return g.__mevVaultRegistry;
  }
  if (!g.__mevVaultRegistry.vaultContracts.arbitrum) {
    g.__mevVaultRegistry.vaultContracts.arbitrum = seedRegistry().vaultContracts.arbitrum;
  }
  return g.__mevVaultRegistry;
}

export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function isSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

export function normalizeVaultAddress(chainId: ChainId, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (chainId === "solana") {
    if (!isSolanaAddress(trimmed)) {
      throw new Error("Alamat Solana tidak valid.");
    }
    return trimmed;
  }
  if (chainId === "cosmos") {
    if (!/^cosmos1[0-9a-z]{38,}$/i.test(trimmed)) {
      throw new Error("Alamat Cosmos Hub harus bech32 cosmos1…");
    }
    return trimmed;
  }
  if (!isEvmAddress(trimmed)) {
    throw new Error("Alamat EVM harus 42 karakter (0x…).");
  }
  return trimmed;
}

export function patchVaultRegistry(input: {
  vaultContracts?: Partial<Record<ChainId, string>>;
  operationalWallets?: Partial<Record<ChainId, string>>;
}): VaultRegistry {
  const current = getVaultRegistry();
  const next: VaultRegistry = {
    vaultContracts: { ...current.vaultContracts },
    operationalWallets: { ...current.operationalWallets },
  };

  for (const chain of CHAINS) {
    if (input.vaultContracts && chain.id in input.vaultContracts) {
      next.vaultContracts[chain.id] = normalizeVaultAddress(
        chain.id,
        input.vaultContracts[chain.id] ?? ""
      );
    }
    if (input.operationalWallets && chain.id in input.operationalWallets) {
      next.operationalWallets[chain.id] = normalizeVaultAddress(
        chain.id,
        input.operationalWallets[chain.id] ?? ""
      );
    }
  }

  (globalThis as RegistryGlobal).__mevVaultRegistry = next;
  return next;
}
