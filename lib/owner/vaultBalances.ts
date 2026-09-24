import { formatEther } from "ethers";
import { createJsonRpcProvider } from "@/lib/bot/rpc";
import type { ChainId } from "@/lib/chain/networks";
import { CHAINS, getChain, resolveChainRpc } from "@/lib/chain/networks";
import { rpcCandidates } from "@/lib/owner/nodeEndpoints";
import { getVaultRegistry } from "@/lib/owner/vaultRegistry";
import { isChainFeedEnabled } from "@/lib/owner/chainQuota";
import { hydrateChainQuotaFromDisk } from "@/lib/owner/chainQuotaPersist";
import { isForeignScanChain } from "@/lib/bot/scanRuntime";
import { readBotState } from "@/lib/bot/store";
import type { AddressBalance, VaultBalanceSnapshot } from "@/lib/owner/vaultBalanceTypes";

export type { AddressBalance, VaultBalanceSnapshot };

async function fetchSolanaNative(rpc: string, address: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address],
      }),
      signal: controller.signal,
    });
    const json = (await response.json()) as { result?: { value?: number }; error?: { message?: string } };
    if (json.error?.message) throw new Error(json.error.message);
    const lamports = json.result?.value;
    if (typeof lamports !== "number") throw new Error("Respons saldo Solana tidak valid.");
    return (lamports / 1_000_000_000).toFixed(6);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchNativeLabel(chainId: ChainId, address: string): Promise<AddressBalance> {
  const chain = getChain(chainId);
  const base: AddressBalance = {
    chainId,
    address,
    symbol: chain.nativeSymbol,
    label: `0 ${chain.nativeSymbol}`,
  };
  if (!address) return { ...base, error: "Alamat belum diisi." };
  if (!isChainFeedEnabled(chainId) || isForeignScanChain(chainId)) {
    return { ...base, error: "Jaringan OFF / Mode Hemat — RPC ditahan." };
  }

  try {
    if (!chain.evm) {
      if (chainId === "cosmos") {
        return { ...base, error: "Saldo ATOM tidak di-query lewat JSON-RPC EVM." };
      }
      const amount = await fetchSolanaNative(chain.rpcUrl, address);
      return { ...base, label: `${amount} ${chain.nativeSymbol}` };
    }
    const endpoints = rpcCandidates(chainId);
    const queue = endpoints.length > 0 ? endpoints : [resolveChainRpc(chainId)].filter(Boolean);
    let lastError: unknown;
    for (const rpc of queue) {
      try {
        const provider = createJsonRpcProvider(rpc, chain.chainId ?? 1);
        const wei = await provider.getBalance(address);
        return { ...base, label: `${formatEther(wei)} ${chain.nativeSymbol}` };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Semua RPC gagal.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membaca saldo.";
    return { ...base, error: message };
  }
}

export async function fetchVaultBalanceSnapshot(): Promise<VaultBalanceSnapshot> {
  try {
    hydrateChainQuotaFromDisk();
    await readBotState();
  } catch {
    /* hydrate kunci Strict Single-Chain dari bot-state */
  }
  const registry = getVaultRegistry();
  const vaults = await Promise.all(
    CHAINS.map((chain) => fetchNativeLabel(chain.id, registry.vaultContracts[chain.id]))
  );
  const wallets = await Promise.all(
    CHAINS.map((chain) => fetchNativeLabel(chain.id, registry.operationalWallets[chain.id]))
  );
  return { vaults, wallets };
}
