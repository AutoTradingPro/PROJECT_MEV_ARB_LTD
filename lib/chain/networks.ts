import {
  ETHEREUM_PUBLIC_RPC_URL,
  ETHEREUM_PUBLIC_RPC_URL_FALLBACK,
  ETHEREUM_PUBLIC_WS_URL,
  POLYGON_CHAIN_ID,
  POLYGON_PUBLIC_RPC_URL,
  POLYGON_PUBLIC_RPC_URL_FALLBACK,
  POLYGON_PUBLIC_WS_URL,
  TRADING_NETWORKS,
  envArbitrumRpcUrl,
  envArbitrumRpcUrlFallback,
  envArbitrumWsUrl,
  envArbitrumWsUrlFallback,
  envAvalancheRpcUrl,
  envAvalancheRpcUrlFallback,
  envAvalancheWsUrl,
  envAvalancheWsUrlFallback,
  envBscRpcUrl,
  envBscRpcUrlFallback,
  envBscWsUrl,
  envBscWsUrlFallback,
  envEthereumRpcUrl,
  envEthereumRpcUrlFallback,
  envEthereumWsUrl,
  envEthereumWsUrlFallback,
  envOptimismRpcUrl,
  envOptimismRpcUrlFallback,
  envOptimismWsUrl,
  envOptimismWsUrlFallback,
  envPolygonRpcUrl,
  envPolygonRpcUrlFallback,
  envPolygonWsUrl,
  envPolygonWsUrlFallback,
  envSolanaRpcUrl,
  envSolanaRpcUrlFallback,
  envSolanaWsUrl,
  envSolanaWsUrlFallback,
  isTradingChainId,
} from "@/config/networks";
import {
  publicArbitrumRpcUrl,
  publicArbitrumRpcUrlFallback,
  publicArbitrumWsUrl,
  publicArbitrumWsUrlFallback,
  publicBscRpcUrl,
  publicBscRpcUrlFallback,
  publicBscWsUrl,
  publicBscWsUrlFallback,
} from "./publicEnv";

export type ChainId =
  | "bsc"
  | "ethereum"
  | "solana"
  | "base"
  | "arbitrum"
  | "avalanche"
  | "polygon"
  | "optimism"
  | "monad"
  | "linea"
  | "cosmos";

export interface ChainConfig {
  id: ChainId;
  label: string;
  shortLabel: string;
  nativeSymbol: string;
  rpcUrl: string;
  wsUrl: string;
  chainId?: number;
  evm: boolean;
  accentClass: string;
  logoUrl: string;
}

const TW = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";

export const CHAINS: ChainConfig[] = [
  {
    id: "bsc",
    label: TRADING_NETWORKS.bsc.name,
    shortLabel: TRADING_NETWORKS.bsc.shortLabel,
    nativeSymbol: TRADING_NETWORKS.bsc.nativeSymbol,
    rpcUrl: publicBscRpcUrl() || TRADING_NETWORKS.bsc.rpcUrl,
    wsUrl: publicBscWsUrl() || TRADING_NETWORKS.bsc.wsUrl,
    chainId: TRADING_NETWORKS.bsc.chainId,
    evm: true,
    accentClass: "text-amber-400",
    logoUrl: TW + "/smartchain/info/logo.png",
  },
  {
    id: "ethereum",
    label: TRADING_NETWORKS.ethereum.name,
    shortLabel: TRADING_NETWORKS.ethereum.shortLabel,
    nativeSymbol: TRADING_NETWORKS.ethereum.nativeSymbol,
    rpcUrl: ETHEREUM_PUBLIC_RPC_URL,
    wsUrl: ETHEREUM_PUBLIC_WS_URL,
    chainId: TRADING_NETWORKS.ethereum.chainId,
    evm: true,
    accentClass: "text-indigo-400",
    logoUrl: TW + "/ethereum/info/logo.png",
  },
  {
    id: "solana",
    label: "Solana",
    shortLabel: "Solana Mainnet",
    nativeSymbol: "SOL",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    wsUrl: "wss://api.mainnet-beta.solana.com",
    evm: false,
    accentClass: "text-purple-400",
    logoUrl: TW + "/solana/info/logo.png",
  },
  {
    id: "base",
    label: "Base",
    shortLabel: "Base Mainnet",
    nativeSymbol: "ETH",
    rpcUrl: "https://mainnet.base.org",
    wsUrl: "wss://base.publicnode.com",
    chainId: 8453,
    evm: true,
    accentClass: "text-blue-400",
    logoUrl: TW + "/base/info/logo.png",
  },
  {
    id: "arbitrum",
    label: TRADING_NETWORKS.arbitrum.name,
    shortLabel: TRADING_NETWORKS.arbitrum.shortLabel,
    nativeSymbol: TRADING_NETWORKS.arbitrum.nativeSymbol,
    rpcUrl: publicArbitrumRpcUrl() || TRADING_NETWORKS.arbitrum.rpcUrl,
    wsUrl: publicArbitrumWsUrl() || TRADING_NETWORKS.arbitrum.wsUrl,
    chainId: TRADING_NETWORKS.arbitrum.chainId,
    evm: true,
    accentClass: "text-sky-400",
    logoUrl: TW + "/arbitrum/info/logo.png",
  },
  {
    id: "polygon",
    label: TRADING_NETWORKS.polygon.name,
    shortLabel: "Polygon PoS",
    nativeSymbol: TRADING_NETWORKS.polygon.nativeSymbol,
    rpcUrl: POLYGON_PUBLIC_RPC_URL,
    wsUrl: POLYGON_PUBLIC_WS_URL,
    chainId: POLYGON_CHAIN_ID,
    evm: true,
    accentClass: "text-violet-400",
    logoUrl: TW + "/polygon/info/logo.png",
  },
  {
    id: "avalanche",
    label: "Avalanche",
    shortLabel: "Avalanche C-Chain",
    nativeSymbol: "AVAX",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    wsUrl: "wss://avalanche-c-chain.publicnode.com",
    chainId: 43114,
    evm: true,
    accentClass: "text-red-400",
    logoUrl: TW + "/avalanchec/info/logo.png",
  },
  {
    id: "optimism",
    label: "Optimism",
    shortLabel: "OP Mainnet",
    nativeSymbol: "ETH",
    rpcUrl: "https://mainnet.optimism.io",
    wsUrl: "wss://optimism.publicnode.com",
    chainId: 10,
    evm: true,
    accentClass: "text-rose-400",
    logoUrl: TW + "/optimism/info/logo.png",
  },
  {
    id: "monad",
    label: "Monad",
    shortLabel: "Monad Mainnet",
    nativeSymbol: "MON",
    rpcUrl: "https://rpc.monad.xyz",
    wsUrl: "wss://rpc.monad.xyz",
    chainId: 143,
    evm: true,
    accentClass: "text-violet-300",
    logoUrl: TW + "/monad/info/logo.png",
  },
  {
    id: "linea",
    label: "Linea",
    shortLabel: "Linea Mainnet",
    nativeSymbol: "ETH",
    rpcUrl: "https://rpc.linea.build",
    wsUrl: "wss://rpc.linea.build",
    chainId: 59144,
    evm: true,
    accentClass: "text-cyan-300",
    logoUrl: TW + "/linea/info/logo.png",
  },
  {
    id: "cosmos",
    label: "Cosmos-based Chain",
    shortLabel: "Cosmos Hub",
    nativeSymbol: "ATOM",
    rpcUrl: "https://cosmos-rpc.publicnode.com:443",
    wsUrl: "wss://cosmos-rpc.publicnode.com:443/websocket",
    evm: false,
    accentClass: "text-indigo-300",
    logoUrl: TW + "/cosmos/info/logo.png",
  },
];

export function getChain(id: ChainId): ChainConfig {
  return CHAINS.find((c) => c.id === id) ?? CHAINS[0];
}

function serverPolygonRpc(): string {
  return envPolygonRpcUrl();
}

function serverPolygonRpcFallback(): string {
  return envPolygonRpcUrlFallback();
}

function serverPolygonWs(): string {
  return envPolygonWsUrl();
}

function serverPolygonWsFallback(): string {
  return envPolygonWsUrlFallback();
}

function serverEthereumRpc(): string {
  return envEthereumRpcUrl();
}

function serverEthereumRpcFallback(): string {
  return envEthereumRpcUrlFallback();
}

function serverEthereumWs(): string {
  return envEthereumWsUrl();
}

function serverEthereumWsFallback(): string {
  return envEthereumWsUrlFallback();
}

export function resolveChainRpc(id: ChainId): string {
  if (id === "bsc") {
    return envBscRpcUrl() || publicBscRpcUrl() || getChain("bsc").rpcUrl;
  }
  if (id === "arbitrum") {
    return envArbitrumRpcUrl() || publicArbitrumRpcUrl() || TRADING_NETWORKS.arbitrum.rpcUrl;
  }
  if (id === "polygon") {
    return serverPolygonRpc() || POLYGON_PUBLIC_RPC_URL;
  }
  if (id === "ethereum") {
    return serverEthereumRpc() || ETHEREUM_PUBLIC_RPC_URL;
  }
  if (id === "optimism") {
    return envOptimismRpcUrl() || getChain(id).rpcUrl;
  }
  if (id === "avalanche") {
    return envAvalancheRpcUrl() || getChain(id).rpcUrl;
  }
  if (id === "solana") {
    return envSolanaRpcUrl() || getChain("solana").rpcUrl;
  }
  return getChain(id).rpcUrl;
}

export function resolveChainRpcFallback(id: ChainId): string {
  if (id === "bsc") {
    return envBscRpcUrlFallback() || publicBscRpcUrlFallback() || TRADING_NETWORKS.bsc.rpcUrlFallback;
  }
  if (id === "arbitrum") {
    return envArbitrumRpcUrlFallback() || publicArbitrumRpcUrlFallback() || TRADING_NETWORKS.arbitrum.rpcUrlFallback;
  }
  if (id === "polygon") {
    return serverPolygonRpcFallback() || POLYGON_PUBLIC_RPC_URL_FALLBACK;
  }
  if (id === "ethereum") {
    return serverEthereumRpcFallback() || ETHEREUM_PUBLIC_RPC_URL_FALLBACK;
  }
  if (id === "optimism") {
    return envOptimismRpcUrlFallback();
  }
  if (id === "avalanche") {
    return envAvalancheRpcUrlFallback();
  }
  if (id === "solana") {
    return envSolanaRpcUrlFallback() || "https://api.mainnet-beta.solana.com";
  }
  return "";
}

export function resolveChainWs(id: ChainId): string {
  if (id === "bsc") {
    return envBscWsUrl() || publicBscWsUrl() || TRADING_NETWORKS.bsc.wsUrl;
  }
  if (id === "arbitrum") {
    return envArbitrumWsUrl() || publicArbitrumWsUrl() || TRADING_NETWORKS.arbitrum.wsUrl;
  }
  if (id === "polygon") {
    return serverPolygonWs() || POLYGON_PUBLIC_WS_URL;
  }
  if (id === "ethereum") {
    return serverEthereumWs() || ETHEREUM_PUBLIC_WS_URL;
  }
  if (id === "optimism") {
    return envOptimismWsUrl() || getChain(id).wsUrl;
  }
  if (id === "avalanche") {
    return envAvalancheWsUrl() || getChain(id).wsUrl;
  }
  if (id === "solana") {
    return envSolanaWsUrl() || getChain("solana").wsUrl;
  }
  return getChain(id).wsUrl;
}

export function resolveChainWsFallback(id: ChainId): string {
  if (id === "bsc") {
    return envBscWsUrlFallback() || publicBscWsUrlFallback() || TRADING_NETWORKS.bsc.wsUrlFallback;
  }
  if (id === "arbitrum") {
    return envArbitrumWsUrlFallback() || publicArbitrumWsUrlFallback() || TRADING_NETWORKS.arbitrum.wsUrlFallback;
  }
  if (id === "polygon") {
    return serverPolygonWsFallback();
  }
  if (id === "ethereum") {
    return serverEthereumWsFallback();
  }
  if (id === "optimism") {
    return envOptimismWsUrlFallback();
  }
  if (id === "avalanche") {
    return envAvalancheWsUrlFallback();
  }
  if (id === "solana") {
    return envSolanaWsUrlFallback() || "wss://api.mainnet-beta.solana.com";
  }
  return "";
}

export { isTradingChainId };
