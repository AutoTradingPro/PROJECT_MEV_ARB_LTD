/**
 * Deteksi & koneksi dompet Solana (Phantom / Solflare / window.solana).
 * Dipakai saat Flashloan Provider Kamino diaktifkan → minta konfirmasi di wallet.
 */

export type SolanaWalletProvider = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isConnected?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString(): string } }>;
  disconnect?: () => Promise<void>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

declare global {
  interface Window {
    solana?: SolanaWalletProvider;
    solflare?: SolanaWalletProvider;
    phantom?: { solana?: SolanaWalletProvider };
  }
}

export function detectSolanaProviders(): SolanaWalletProvider[] {
  if (typeof window === "undefined") return [];
  const list: SolanaWalletProvider[] = [];
  const phantom = window.phantom?.solana;
  if (phantom) list.push(phantom);
  if (window.solflare) list.push(window.solflare);
  if (window.solana && window.solana !== phantom && window.solana !== window.solflare) {
    list.push(window.solana);
  }
  return list;
}

export function getSolanaProvider(): SolanaWalletProvider | null {
  const list = detectSolanaProviders();
  return list.find((p) => p.isPhantom) || list.find((p) => p.isSolflare) || list[0] || null;
}

export function hasSolanaProvider(): boolean {
  return Boolean(getSolanaProvider());
}

export async function connectSolanaWallet(): Promise<{ address: string; providerName: string }> {
  const provider = getSolanaProvider();
  if (!provider) {
    throw new Error(
      "Dompet Solana tidak ditemukan. Install Phantom atau Solflare, lalu aktifkan lagi Kamino."
    );
  }
  const connectPromise = provider.connect().then((result) => {
    const address =
      result?.publicKey?.toString() || provider.publicKey?.toString() || "";
    if (!address) {
      throw new Error("Koneksi Solana ditolak atau tidak mengembalikan public key.");
    }
    const providerName = provider.isPhantom
      ? "Phantom"
      : provider.isSolflare
        ? "Solflare"
        : "Solana Wallet";
    return { address, providerName };
  });
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(
      () => reject(new Error("Timeout koneksi Solana. Buka Phantom/Solflare lalu coba lagi.")),
      45_000
    );
  });
  return Promise.race([connectPromise, timeout]);
}

/**
 * Pastikan cluster mainnet bila wallet mendukung request switch
 * (beberapa wallet mengabaikan — koneksi tetap cukup sebagai konfirmasi).
 */
export async function ensureSolanaMainnet(provider: SolanaWalletProvider): Promise<void> {
  if (typeof provider.request !== "function") return;
  const attempt = async () => {
    try {
      await provider.request!({
        method: "wallet_switchNetwork",
        params: { chain: "mainnet-beta" },
      });
    } catch {
      try {
        await provider.request!({
          method: "wallet_requestNetwork",
          params: { genesisHash: "mainnet-beta" },
        });
      } catch {
        /* Phantom klasik: connect = konfirmasi; cluster biasanya mainnet */
      }
    }
  };
  await Promise.race([
    attempt(),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 2500);
    }),
  ]);
}

export async function ensureSolanaWalletReady(): Promise<{
  address: string;
  providerName: string;
}> {
  const provider = getSolanaProvider();
  if (!provider) {
    throw new Error(
      "Dompet Solana tidak ditemukan. Install Phantom atau Solflare untuk Kamino (Solana Mainnet)."
    );
  }
  let address = provider.publicKey?.toString() || "";
  if (!provider.isConnected || !address) {
    const connected = await connectSolanaWallet();
    address = connected.address;
    await ensureSolanaMainnet(provider);
    return connected;
  }
  await ensureSolanaMainnet(provider);
  const providerName = provider.isPhantom
    ? "Phantom"
    : provider.isSolflare
      ? "Solflare"
      : "Solana Wallet";
  return { address, providerName };
}
