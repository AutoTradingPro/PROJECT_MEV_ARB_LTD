"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAppKit, useDisconnect } from "@reown/appkit/react";
import { useAccount, useConnect, useSwitchChain, type Connector } from "wagmi";
import { injected } from "wagmi/connectors";
import { useNetwork } from "@/context/NetworkContext";
import { getChain, type ChainId } from "@/lib/chain/networks";
import { executorConfigForChainId, portalChainFromEvmId } from "@/lib/vault/executors";
import { formatWalletError } from "@/lib/wallet/rpcError";
import {
  fetchNativeBalance,
  formatNativeBalance,
  hasEthereumProvider,
  shortenAddress,
  switchWalletChain,
} from "@/lib/wallet/provider";
import {
  ensureSolanaWalletReady,
  hasSolanaProvider,
} from "@/lib/wallet/solanaWallet";
import { fetchSolanaWalletBalance } from "@/lib/wallet/solanaBalance";

interface WalletContextValue {
  address: string;
  shortAddress: string;
  isConnected: boolean;
  isConnecting: boolean;
  balance: string;
  balanceLabel: string;
  error: string | null;
  providerAvailable: boolean;
  /** Chain ID EVM dari wagmi / AppKit. */
  evmChainId: number | null;
  /** Alamat Solana (Phantom/Solflare) bila terhubung. */
  solanaAddress: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  /**
   * Prompt switch / connect jaringan wallet sesuai target FlashLoan Provider.
   * EVM → wagmi/AppKit switchChain; Solana → Phantom/Solflare connect (+ mainnet bila didukung).
   */
  ensureWalletChain: (target: ChainId) => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function isInjectedConnector(connector: any): boolean {
  return connector?.type === "injected" || connector?.id === "injected" || connector?.id === "io.metamask";
}

function pickMetaMaskConnector(connectors: readonly Connector[]): Connector | undefined {
  const injectedConnectors = connectors.filter(isInjectedConnector);
  return (
    injectedConnectors.find((connector: any) => connector?.id === "io.metamask") ??
    injectedConnectors.find((connector: any) => /metamask/i.test(connector?.name ?? "")) ??
    injectedConnectors[0]
  );
}

function connectErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (/user rejected|user denied|rejected the request/i.test(raw)) {
    return "Permintaan koneksi ditolak di MetaMask. Buka MetaMask lalu setujui akun.";
  }
  if (/provider not found|no provider|metamask/i.test(raw) && /not (found|installed|detected)/i.test(raw)) {
    return "MetaMask tidak terdeteksi. Pastikan ekstensi aktif, lalu muat ulang halaman.";
  }
  return formatWalletError(err);
}

async function connectInjectedMetaMask(
  connectors: readonly Connector[],
  connectAsync: (parameters: { connector: any }) => Promise<unknown>,
  openModal: () => Promise<void>,
) {
  if (!hasEthereumProvider()) {
    await openModal();
    return;
  }
  const connector =
    pickMetaMaskConnector(connectors) ??
    injected({
      target: "metaMask",
      shimDisconnect: true,
    });
  const connAny = connector as any;
  console.log(`[WALLET] MetaMask injected · ${connAny.id || connAny.name}`);
  await connectAsync({ connector: connAny });
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { chain, chainId } = useNetwork();
  const { open } = useAppKit();
  const { disconnect: disconnectAppKit } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { connectors, connectAsync } = useConnect();
  const { address: wagmiAddress, isConnected, isReconnecting, chainId: wagmiChainId } = useAccount();

  const address = wagmiAddress ?? "";
  const evmChainId = typeof wagmiChainId === "number" ? wagmiChainId : null;
  const [balance, setBalance] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isOpeningModal, setIsOpeningModal] = useState(false);
  const [providerAvailable] = useState(true);
  const [solanaAddress, setSolanaAddress] = useState("");

  const refreshBalance = useCallback(async (overrideSolanaAddress?: string) => {
    if (chainId === "solana") {
      const addr = (overrideSolanaAddress || solanaAddress || "").trim();
      if (!addr) {
        setBalance("0");
        return;
      }
      try {
        setError(null);
        const { balance: next } = await fetchSolanaWalletBalance(addr);
        setBalance(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Gagal membaca saldo Solana.";
        setError(message);
      }
      return;
    }
    if (!address) {
      setBalance("0");
      return;
    }
    const walletPortal = portalChainFromEvmId(evmChainId);
    const balanceChain = walletPortal ?? (chain.evm ? chainId : null);
    if (!balanceChain) {
      setBalance("0");
      if (!chain.evm) setError("Saldo native Solana memerlukan Phantom atau Solflare.");
      return;
    }
    try {
      setError(null);
      const value = await fetchNativeBalance(address, balanceChain);
      setBalance(value);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal membaca saldo dompet.";
      setError(message);
    }
  }, [address, chain.evm, chainId, evmChainId, solanaAddress]);

  const connect = useCallback(async () => {
    setError(null);
    if (chainId === "solana") {
      if (isOpeningModal) return;
      setIsOpeningModal(true);
      try {
        const connected = await ensureSolanaWalletReady();
        setSolanaAddress(connected.address);
        setError(null);
        await refreshBalance(connected.address);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Koneksi Solana ditolak.");
      } finally {
        setIsOpeningModal(false);
      }
      return;
    }
    setIsOpeningModal(true);
    try {
      await connectInjectedMetaMask(connectors, connectAsync as any, () => open({ view: "Connect" }));
    } catch (err) {
      setError(connectErrorMessage(err));
    } finally {
      setIsOpeningModal(false);
    }
  }, [chainId, connectors, connectAsync, isOpeningModal, open, refreshBalance]);

  const disconnect = useCallback(() => {
    void disconnectAppKit();
    setSolanaAddress("");
    setBalance("0");
    setError(null);
    setIsOpeningModal(false);
  }, [disconnectAppKit]);

  const ensureWalletChain = useCallback(
    async (target: ChainId) => {
      const next = getChain(target);

      // Solana (Kamino): Phantom / Solflare — prompt connect + mainnet bila didukung.
      if (target === "solana" || !next.evm) {
        setIsOpeningModal(true);
        try {
          setError(null);
          if (!hasSolanaProvider()) {
            setError(
              "Dompet Solana tidak ditemukan. Install Phantom atau Solflare, lalu aktifkan Kamino lagi."
            );
            return;
          }
          const connected = await ensureSolanaWalletReady();
          setSolanaAddress(connected.address);
          console.log(
            `[WALLET] Solana Mainnet · ${connected.providerName} · ${connected.address.slice(0, 4)}…${connected.address.slice(-4)}`
          );
          await refreshBalance(connected.address);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Gagal menghubungkan dompet Solana.");
        } finally {
          setIsOpeningModal(false);
        }
        return;
      }

      // EVM: connect bila perlu, lalu switchChain.
      if (!isConnected || !address) {
        setIsOpeningModal(true);
        try {
          setError(null);
          await connectInjectedMetaMask(connectors, connectAsync as any, () => open({ view: "Connect" }));
        } catch (err) {
          setError(connectErrorMessage(err));
          return;
        } finally {
          setIsOpeningModal(false);
        }
      }
      if (!next.chainId) return;
      if (evmChainId === next.chainId) {
        void refreshBalance();
        return;
      }
      try {
        setError(null);
        console.log(`[WALLET] Switch EVM → ${next.shortLabel} (chainId ${next.chainId})`);
        await switchChainAsync({ chainId: next.chainId });
        void refreshBalance();
      } catch (err) {
        if (hasEthereumProvider()) {
          try {
            await switchWalletChain(target);
            void refreshBalance();
            return;
          } catch (injectedErr) {
            setError(formatWalletError(injectedErr));
            return;
          }
        }
        setError(formatWalletError(err));
      }
    },
    [address, connectors, connectAsync, evmChainId, isConnected, open, refreshBalance, switchChainAsync]
  );

  // Reset status connecting saat pindah jaringan agar tombol header tidak terkunci.
  useEffect(() => {
    setIsOpeningModal(false);
  }, [chainId]);

  useEffect(() => {
    if (chainId === "solana") {
      if (!solanaAddress) {
        setBalance("0");
        return;
      }
      void refreshBalance();
      const id = window.setInterval(() => {
        void refreshBalance();
      }, 12000);
      return () => window.clearInterval(id);
    }
    if (!address) {
      setBalance("0");
      return;
    }
    void refreshBalance();
    const id = window.setInterval(() => {
      void refreshBalance();
    }, 12000);
    return () => window.clearInterval(id);
  }, [address, chainId, refreshBalance, solanaAddress]);

  const walletPortal = portalChainFromEvmId(evmChainId);
  const nativeSymbol =
    (walletPortal ? getChain(walletPortal).nativeSymbol : undefined) ??
    executorConfigForChainId(evmChainId)?.nativeSymbol ??
    chain.nativeSymbol;

  const displayAddress = chainId === "solana" ? solanaAddress : address;
  const walletConnected =
    chainId === "solana" ? Boolean(solanaAddress) : isConnected;
  /** Di Solana jangan ikut status reconnect wagmi/EVM — itu membuat tombol Connect terkunci. */
  const connecting =
    chainId === "solana" ? isOpeningModal : isOpeningModal || isReconnecting;

  const value = useMemo(
    () => ({
      address: displayAddress,
      shortAddress: displayAddress ? shortenAddress(displayAddress) : "",
      isConnected: walletConnected,
      isConnecting: connecting,
      balance,
      balanceLabel: formatNativeBalance(balance, nativeSymbol),
      error,
      providerAvailable,
      evmChainId,
      solanaAddress,
      connect,
      disconnect,
      refreshBalance,
      ensureWalletChain,
    }),
    [
      displayAddress,
      walletConnected,
      connecting,
      balance,
      nativeSymbol,
      error,
      providerAvailable,
      evmChainId,
      solanaAddress,
      connect,
      disconnect,
      refreshBalance,
      ensureWalletChain,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet harus dipakai di dalam WalletProvider");
  return ctx;
}
