import { cookieStorage, createStorage, http } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  arbitrum,
  avalanche,
  base,
  bsc,
  evmos,
  mainnet,
  optimism,
  polygon,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { defineChain } from "viem";

/** Monad mainnet. Paket AppKit ini belum mengekspor chain 143. */
const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.monad.xyz"],
      webSocket: ["wss://rpc.monad.xyz"],
    },
  },
  blockExplorers: {
    default: { name: "Monadscan", url: "https://monadscan.com" },
  },
});

export const appKitProjectId = (
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ||
  process.env.NEXT_PUBLIC_PROJECT_ID ||
  ""
).trim();

/** Ethereum, Polygon, Arbitrum, Optimism, Avalanche, Cosmos/EVM (Evmos), Base, BNB Chain, Monad. */
export const appKitNetworks = [
  mainnet,
  polygon,
  arbitrum,
  optimism,
  avalanche,
  evmos,
  base,
  bsc,
  monad,
] as [AppKitNetwork, ...AppKitNetwork[]];

const defaultChain = (process.env.NEXT_PUBLIC_DEFAULT_CHAIN || "polygon").trim().toLowerCase();

export const appKitDefaultNetwork: AppKitNetwork =
  appKitNetworks.find((network) => {
    if (defaultChain === "ethereum" || defaultChain === "1") return network.id === mainnet.id;
    if (defaultChain === "polygon" || defaultChain === "137") return network.id === polygon.id;
    if (defaultChain === "arbitrum" || defaultChain === "42161") return network.id === arbitrum.id;
    if (defaultChain === "optimism" || defaultChain === "10") return network.id === optimism.id;
    if (defaultChain === "avalanche" || defaultChain === "43114") return network.id === avalanche.id;
    if (defaultChain === "cosmos" || defaultChain === "evmos" || defaultChain === "9001" || defaultChain === "solana") {
      return network.id === evmos.id;
    }
    if (defaultChain === "base" || defaultChain === "8453") return network.id === base.id;
    if (defaultChain === "bsc" || defaultChain === "bnb" || defaultChain === "56") return network.id === bsc.id;
    if (defaultChain === "monad" || defaultChain === "143") {
      return network.id === monad.id;
    }
    return false;
  }) ?? polygon;

const publicRpcs: Record<number, string> = {
  [mainnet.id]: "https://ethereum.publicnode.com",
  [polygon.id]: "https://polygon-bor.publicnode.com",
  [arbitrum.id]: "https://arb1.arbitrum.io/rpc",
  [optimism.id]: "https://mainnet.optimism.io",
  [avalanche.id]: "https://api.avax.network/ext/bc/C/rpc",
  [evmos.id]: "https://evmos.publicnode.com",
  [base.id]: "https://mainnet.base.org",
  [bsc.id]: "https://bsc-dataseed.binance.org",
  [monad.id]: "https://rpc.monad.xyz",
};

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId: appKitProjectId,
  networks: appKitNetworks,
  transports: {
    [mainnet.id]: http(publicRpcs[mainnet.id]),
    [polygon.id]: http(publicRpcs[polygon.id]),
    [arbitrum.id]: http(publicRpcs[arbitrum.id]),
    [optimism.id]: http(publicRpcs[optimism.id]),
    [avalanche.id]: http(publicRpcs[avalanche.id]),
    [evmos.id]: http(publicRpcs[evmos.id]),
    [base.id]: http(publicRpcs[base.id]),
    [bsc.id]: http(publicRpcs[bsc.id]),
    [monad.id]: http(publicRpcs[monad.id]),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export const appKitMetadata = {
  name: "MEV ARB",
  description: "Dashboard flashloan arbitrage lintas DEX",
  url: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
  icons: ["/favicon-32x32.png"],
};

/** MetaMask, Coinbase Wallet — urutan rekomendasi di modal AppKit. */
export const featuredWalletIds = [
  "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
  "fd20dc426fb37544d339da47a23dc75c176b2fe9b30a28d1a2d2c6e9ef998267",
];
