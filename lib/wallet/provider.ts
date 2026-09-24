import { JsonRpcProvider, formatEther } from "ethers";
import type { ChainId } from "@/lib/chain/networks";
import { getChain, resolveChainRpc } from "@/lib/chain/networks";

export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (eventName: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (eventName: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function hasEthereumProvider(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function requestAccounts(): Promise<string[]> {
  if (!window.ethereum) throw new Error("MetaMask atau dompet Web3 tidak terdeteksi.");
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  return accounts ?? [];
}

export async function getWalletChainIdHex(): Promise<string | null> {
  if (!window.ethereum) return null;
  try {
    const hex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
    return hex || null;
  } catch {
    return null;
  }
}

export function parseChainIdHex(hex: string | null): number | null {
  if (!hex) return null;
  const parsed = Number.parseInt(hex, 16);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getConnectedAccounts(): Promise<string[]> {
  if (!window.ethereum) return [];
  try {
    const accounts = (await window.ethereum.request({
      method: "eth_accounts",
    })) as string[];
    return accounts ?? [];
  } catch {
    return [];
  }
}

export async function fetchNativeBalance(address: string, chainId: ChainId): Promise<string> {
  const chain = getChain(chainId);
  if (!chain.evm) return "0";

  const rpc = resolveChainRpc(chainId);
  if (!rpc) throw new Error(`RPC ${chain.shortLabel} belum dikonfigurasi.`);

  const provider = new JsonRpcProvider(rpc, chain.chainId);
  const balance = await provider.getBalance(address);
  return formatEther(balance);
}

export async function switchWalletChain(chainId: ChainId): Promise<void> {
  if (!window.ethereum) {
    throw new Error("MetaMask atau Rabby tidak terdeteksi.");
  }
  const chain = getChain(chainId);
  if (!chain.evm || !chain.chainId) {
    throw new Error(`Jaringan ${chain.shortLabel} tidak mendukung switch EVM.`);
  }

  const hexChainId = `0x${chain.chainId.toString(16)}`;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
  } catch (error) {
    const err = error as { code?: number };
    if (err.code === 4001) {
      throw error;
    }
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexChainId,
            chainName: chain.label,
            nativeCurrency: { name: chain.nativeSymbol, symbol: chain.nativeSymbol, decimals: 18 },
            rpcUrls: [chain.rpcUrl].filter(Boolean),
            blockExplorerUrls:
              chainId === "arbitrum"
                ? ["https://arbiscan.io"]
                : chainId === "bsc"
                  ? ["https://bscscan.com"]
                  : chainId === "polygon"
                    ? ["https://polygonscan.com"]
                    : chainId === "ethereum"
                      ? ["https://etherscan.io"]
                      : undefined,
          },
        ],
      });
      return;
    }
    throw error;
  }
}

export function formatNativeBalance(value: string, symbol: string, digits = 4): string {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) return `0.0000 ${symbol}`;
  if (num === 0) return `0.0000 ${symbol}`;
  // SOL kecil (~$1) sering < 0.01 — tampilkan lebih banyak digit agar tidak terlihat 0.0000.
  if (symbol === "SOL") {
    if (num < 0.000001) return `<0.000001 ${symbol}`;
    if (num < 0.01) return `${num.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} ${symbol}`;
    return `${num.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} ${symbol}`;
  }
  if (num < 0.0001) return `<0.0001 ${symbol}`;
  return `${num.toFixed(digits)} ${symbol}`;
}
