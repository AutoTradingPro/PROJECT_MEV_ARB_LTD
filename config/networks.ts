import {
  BLOCKMACHINE_HTTP,
  BLOCKMACHINE_WSS,
  appendBlockmachineWsAuth,
  blockmachineApiKey,
  isBlockmachineHost,
} from "@/config/blockmachine";

export type TradingChainId =
  | "optimism"
  | "avalanche"
  | "solana"
  | "base"
  | "bsc"
  | "monad"
  | "arbitrum"
  | "polygon"
  | "ethereum"
  | "linea";
export type ScannerChainId = TradingChainId;
export type NativeSymbol = "BNB" | "ETH" | "POL" | "AVAX" | "SOL" | "ATOM" | "MON";

export interface TokenPairConfig {
  id: string;
  label: string;
  baseSymbol: string;
  quoteSymbol: string;
  baseIcon: string;
  quoteIcon: string;
  baseAddress?: string;
  quoteAddress?: string;
  baseDecimals?: number;
  quoteDecimals?: number;
}

export interface TradingNetworkConfig {
  id: TradingChainId;
  name: string;
  shortLabel: string;
  chainId: number;
  nativeSymbol: NativeSymbol;
  nativeCurrency: string;
  rpcUrl: string;
  wsUrl: string;
  rpcUrlFallback: string;
  wsUrlFallback: string;
  explorerTx: string;
  wrappedNative: string;
  pairs: TokenPairConfig[];
}

const TW = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";
const CG = "https://assets.coingecko.com/coins/images";
const BSC = `${TW}/smartchain/assets`;
const ETH = `${TW}/ethereum/assets`;
const ARB = `${TW}/arbitrum/assets`;
const BASE = `${TW}/base/assets`;
const AVAX = `${TW}/avalanchec/assets`;

function envBscRpc(): string {
  const primary = process.env.NEXT_PUBLIC_BSC_RPC_URL?.trim() || "";
  if (primary && !isRetiredAnkrUrl(primary) && typeof window !== "undefined") return primary;
  if (typeof window === "undefined") {
    return envBscRpcUrl() || "https://bsc-dataseed.binance.org";
  }
  return primary && !isRetiredAnkrUrl(primary) ? primary : "https://bsc-dataseed.binance.org";
}

function envBscWs(): string {
  const ws = process.env.NEXT_PUBLIC_BSC_WS_URL?.trim() || "";
  return ws && !isRetiredAnkrUrl(ws) ? ws : "";
}

function envBscRpcFallback(): string {
  const url = process.env.NEXT_PUBLIC_BSC_RPC_URL_2?.trim() || process.env.RPC_HTTP_URL_2?.trim() || "";
  return url && !isRetiredAnkrUrl(url) ? url : "";
}

function envBscWsFallback(): string {
  const url = process.env.NEXT_PUBLIC_BSC_WS_URL_2?.trim() || process.env.RPC_WSS_URL_2?.trim() || "";
  return url && !isRetiredAnkrUrl(url) ? url : "";
}

function envArbRpc(): string {
  const url = process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL?.trim() || "";
  if (url && !isRetiredAnkrUrl(url)) return url;
  return "https://arb1.arbitrum.io/rpc";
}

function envArbWs(): string {
  const url = process.env.NEXT_PUBLIC_ARBITRUM_WS_URL?.trim() || "";
  if (url && !isRetiredAnkrUrl(url)) return url;
  return "wss://arbitrum-one.publicnode.com";
}

function envArbRpcFallback(): string {
  const url = process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL_2?.trim() || "";
  return url && !isRetiredAnkrUrl(url) ? url : "";
}

function envArbWsFallback(): string {
  const url = process.env.NEXT_PUBLIC_ARBITRUM_WS_URL_2?.trim() || "";
  return url && !isRetiredAnkrUrl(url) ? url : "";
}

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = (process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
}

/** Cadangan lama: Ankr boleh dipakai lagi sebagai Primary scanner (server-only, jangan NEXT_PUBLIC_). */
export function isRetiredAnkrUrl(_url: string): boolean {
  return false;
}

function serverRpcDefault(url: string): string {
  return typeof window === "undefined" ? url : "";
}

function isBlockmachineConfigured(url: string): boolean {
  try {
    return Boolean(url) && isBlockmachineHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

type BlockmachineKeyedChain = "arbitrum" | "ethereum" | "polygon" | "bsc" | "optimism" | "avalanche";

function preferBlockmachineHttp(
  chainId: BlockmachineKeyedChain,
  configured: string
): string {
  if (configured && !isBlockmachineConfigured(configured)) {
    return configured;
  }
  if (blockmachineApiKey(chainId) && (!configured || isBlockmachineConfigured(configured))) {
    return BLOCKMACHINE_HTTP[chainId];
  }
  return configured || serverRpcDefault(BLOCKMACHINE_HTTP[chainId]);
}

function preferBlockmachineWs(
  chainId: BlockmachineKeyedChain,
  configured: string
): string {
  if (configured && !isBlockmachineConfigured(configured)) {
    return configured;
  }
  const raw =
    blockmachineApiKey(chainId) && (!configured || isBlockmachineConfigured(configured))
      ? BLOCKMACHINE_WSS[chainId]
      : configured || serverRpcDefault(BLOCKMACHINE_WSS[chainId]);
  return appendBlockmachineWsAuth(raw, chainId);
}

/** Server-only BNB Chain HTTP (Blockmachine rpc-bsc). Jangan taruh kunci di NEXT_PUBLIC_. */
export function envBscRpcUrl(): string {
  return preferBlockmachineHttp(
    "bsc",
    firstEnv("BLOCKPI_RPC_BSC", "BSC_RPC_URL", "RPC_HTTP_URL_BSC", "RPC_HTTP_URL")
  );
}

function preferBlockmachineFallbackHttp(chainId: BlockmachineKeyedChain, configured: string): string {
  if (configured && !isBlockmachineConfigured(configured)) return configured;
  if (blockmachineApiKey(chainId)) return BLOCKMACHINE_HTTP[chainId];
  return configured;
}

function preferBlockmachineFallbackWs(chainId: BlockmachineKeyedChain, configured: string): string {
  const raw =
    configured && !isBlockmachineConfigured(configured)
      ? configured
      : blockmachineApiKey(chainId)
        ? BLOCKMACHINE_WSS[chainId]
        : configured;
  return raw ? appendBlockmachineWsAuth(raw, chainId) : "";
}

export function envBscRpcUrlFallback(): string {
  return firstEnv("BSC_RPC_URL_2", "RPC_HTTP_URL_BSC_2", "RPC_HTTP_URL_2", "NEXT_PUBLIC_BSC_RPC_URL_2");
}

export function envBscWsUrl(): string {
  return preferBlockmachineWs(
    "bsc",
    firstEnv("ONFINALITY_WSS_BSC", "BSC_WSS_URL", "RPC_WSS_URL_BSC", "RPC_WSS_URL")
  );
}

export function envBscWsUrlFallback(): string {
  return firstEnv("BSC_WSS_URL_2", "RPC_WSS_URL_BSC_2", "RPC_WSS_URL_2");
}

/** Server-only Arbitrum HTTP (ANKR scanner · Blockmachine cadangan). */
export function envArbitrumRpcUrl(): string {
  return preferBlockmachineHttp(
    "arbitrum",
    firstEnv(
      "BLOCKPI_RPC_ARBITRUM",
      "ANKR_ARBITRUM_RPC_URL",
      "ARBI_RPC_URL",
      "ARBITRUM_RPC_URL",
      "RPC_HTTP_URL_ARBITRUM"
    )
  );
}

export function envArbitrumRpcUrlFallback(): string {
  return preferBlockmachineFallbackHttp(
    "arbitrum",
    firstEnv("ARBITRUM_RPC_URL_2", "RPC_HTTP_URL_ARBITRUM_2", "NEXT_PUBLIC_ARBITRUM_RPC_URL_2")
  );
}

export function envArbitrumWsUrl(): string {
  return preferBlockmachineWs(
    "arbitrum",
    firstEnv(
      "ONFINALITY_WSS_ARBITRUM",
      "ANKR_ARBITRUM_WSS_URL",
      "ARBI_WSS_URL",
      "ARBITRUM_WSS_URL",
      "RPC_WSS_URL_ARBITRUM"
    )
  );
}

export function envArbitrumWsUrlFallback(): string {
  return preferBlockmachineFallbackWs(
    "arbitrum",
    firstEnv("ARBITRUM_WSS_URL_2", "RPC_WSS_URL_ARBITRUM_2", "NEXT_PUBLIC_ARBITRUM_WS_URL_2")
  );
}

/** Server-only Polygon HTTP (ANKR scanner · Blockmachine cadangan). */
export function envPolygonRpcUrl(): string {
  return preferBlockmachineHttp(
    "polygon",
    firstEnv(
      "BLOCKPI_RPC_POLYGON",
      "ANKR_POLYGON_RPC_URL",
      "POLY_RPC_URL",
      "POLYGON_RPC_URL",
      "RPC_HTTP_URL_POLYGON",
      "NEXT_PUBLIC_POLYGON_RPC_URL"
    )
  );
}

export function envPolygonRpcUrlFallback(): string {
  return preferBlockmachineFallbackHttp(
    "polygon",
    firstEnv("POLYGON_RPC_URL_2", "RPC_HTTP_URL_POLYGON_2")
  );
}

export function envPolygonWsUrl(): string {
  return preferBlockmachineWs(
    "polygon",
    firstEnv(
      "ONFINALITY_WSS_POLYGON",
      "ANKR_POLYGON_WSS_URL",
      "POLY_WSS_URL",
      "POLYGON_WSS_URL",
      "RPC_WSS_URL_POLYGON",
      "NEXT_PUBLIC_POLYGON_WS_URL",
      "NEXT_PUBLIC_POLIGON_WS_URL"
    )
  );
}

export function envPolygonWsUrlFallback(): string {
  return preferBlockmachineFallbackWs(
    "polygon",
    firstEnv("POLYGON_WSS_URL_2", "RPC_WSS_URL_POLYGON_2")
  );
}

/** Server-only Ethereum HTTP (ANKR scanner · Blockmachine cadangan). */
export function envEthereumRpcUrl(): string {
  return preferBlockmachineHttp(
    "ethereum",
    firstEnv(
      "BLOCKPI_RPC_ETHEREUM",
      "ANKR_ETHEREUM_RPC_URL",
      "ETHE_RPC_URL",
      "ETHEREUM_RPC_URL",
      "RPC_HTTP_URL_ETHEREUM",
      "NEXT_PUBLIC_ETHEREUM_RPC_URL"
    )
  );
}

export function envEthereumRpcUrlFallback(): string {
  return preferBlockmachineFallbackHttp(
    "ethereum",
    firstEnv("ETHEREUM_RPC_URL_2", "RPC_HTTP_URL_ETHEREUM_2")
  );
}

export function envEthereumWsUrl(): string {
  return preferBlockmachineWs(
    "ethereum",
    firstEnv(
      "ONFINALITY_WSS_ETHEREUM",
      "ANKR_ETHEREUM_WSS_URL",
      "ETHE_WSS_URL",
      "ETHEREUM_WSS_URL",
      "RPC_WSS_URL_ETHEREUM",
      "NEXT_PUBLIC_ETHEREUM_WS_URL"
    )
  );
}

export function envEthereumWsUrlFallback(): string {
  return preferBlockmachineFallbackWs(
    "ethereum",
    firstEnv("ETHEREUM_WSS_URL_2", "RPC_WSS_URL_ETHEREUM_2")
  );
}

/** Server-only Solana HTTP (Ankr primary). Jangan taruh kunci di NEXT_PUBLIC_. */
export function envSolanaRpcUrl(): string {
  return firstEnv(
    "ANKR_SOLANA_RPC_URL",
    "SOLANA_RPC_URL",
    "RPC_HTTP_URL_SOLANA",
    "NEXT_PUBLIC_SOLANA_RPC_URL"
  );
}

export function envSolanaRpcUrlFallback(): string {
  return firstEnv(
    "SOLANA_RPC_URL_2",
    "RPC_HTTP_URL_SOLANA_2",
    "NEXT_PUBLIC_SOLANA_RPC_URL_2"
  );
}

/** Server-only Solana WebSocket (Ankr primary). */
export function envSolanaWsUrl(): string {
  return firstEnv(
    "ONFINALITY_WSS_SOLANA",
    "ANKR_SOLANA_WSS_URL",
    "SOLANA_WS_URL",
    "SOLANA_WSS_URL",
    "RPC_WSS_URL_SOLANA",
    "NEXT_PUBLIC_SOLANA_WS_URL"
  );
}

export function envSolanaWsUrlFallback(): string {
  return firstEnv(
    "SOLANA_WS_URL_2",
    "SOLANA_WSS_URL_2",
    "RPC_WSS_URL_SOLANA_2",
    "NEXT_PUBLIC_SOLANA_WS_URL_2"
  );
}

/** QuickNode Solana executor HTTP — broadcast tx (terpisah dari Ankr scanner). */
export function envSolanaExecutorRpcUrl(): string {
  return firstEnv(
    "SOLANA_EXECUTOR_RPC_URL",
    "SOLANA_EXEC_RPC_URL",
    "QUICKNODE_SOLANA_RPC_URL"
  );
}

/** QuickNode Solana executor WSS — pantau slot/block/mempool real-time. */
export function envSolanaExecutorWsUrl(): string {
  return firstEnv(
    "SOLANA_EXECUTOR_WS_URL",
    "SOLANA_EXEC_WS_URL",
    "QUICKNODE_SOLANA_WS_URL"
  );
}

/** Server-only Jupiter Quote API key (hindari 429 pada live scan Solana). */
export function envJupiterApiKey(): string {
  return firstEnv("JUPITER_API_KEY", "JUP_API_KEY");
}

/** Server-only Optimism cadangan (Blockmachine rpc-optimism). */
export function envOptimismRpcUrl(): string {
  return firstEnv(
    "BLOCKPI_RPC_OPTIMISM",
    "OPTIMISM_RPC_URL",
    "RPC_HTTP_URL_OPTIMISM",
    "NEXT_PUBLIC_OPTIMISM_RPC_URL"
  );
}

export function envOptimismRpcUrlFallback(): string {
  return preferBlockmachineFallbackHttp(
    "optimism",
    firstEnv("OPTIMISM_RPC_URL_2", "RPC_HTTP_URL_OPTIMISM_2")
  );
}

export function envOptimismWsUrl(): string {
  return firstEnv(
    "ONFINALITY_WSS_OPTIMISM",
    "OPTIMISM_WSS_URL",
    "RPC_WSS_URL_OPTIMISM",
    "NEXT_PUBLIC_OPTIMISM_WS_URL"
  );
}

export function envOptimismWsUrlFallback(): string {
  return preferBlockmachineFallbackWs(
    "optimism",
    firstEnv("OPTIMISM_WSS_URL_2", "RPC_WSS_URL_OPTIMISM_2")
  );
}

/** Server-only Avalanche cadangan (Blockmachine rpc-avalanche). */
export function envAvalancheRpcUrl(): string {
  return firstEnv(
    "BLOCKPI_RPC_AVALANCHE",
    "AVALANCHE_RPC_URL",
    "RPC_HTTP_URL_AVALANCHE",
    "NEXT_PUBLIC_AVALANCHE_RPC_URL"
  );
}

/** Server-only Base HTTP. Primary = BlockPi. */
export function envBaseRpcUrl(): string {
  return firstEnv("BLOCKPI_RPC_BASE", "BASE_RPC_URL", "RPC_HTTP_URL_BASE");
}

/** Server-only Monad HTTP. Primary = BlockPi bila diisi, lalu RPC publik. */
export function envMonadRpcUrl(): string {
  return firstEnv("BLOCKPI_RPC_MONAD", "MONAD_RPC_URL", "RPC_HTTP_URL_MONAD");
}

/** Server-only Linea HTTP. Primary = BlockPi. */
export function envLineaRpcUrl(): string {
  return firstEnv("BLOCKPI_RPC_LINEA", "LINEA_RPC_URL", "RPC_HTTP_URL_LINEA");
}

/** WSS BlockPi dari URL HTTP yang sama (`/v1/rpc/` → `/v1/ws/`). */
export function envLineaWsUrl(): string {
  const http = envLineaRpcUrl();
  if (!http) return "";
  try {
    const url = new URL(http);
    if (!url.hostname.endsWith("blockpi.network")) return "";
    url.protocol = "wss:";
    url.pathname = url.pathname.replace("/v1/rpc/", "/v1/ws/");
    return url.toString();
  } catch {
    return "";
  }
}

export function envAvalancheRpcUrlFallback(): string {
  return preferBlockmachineFallbackHttp(
    "avalanche",
    firstEnv("AVALANCHE_RPC_URL_2", "RPC_HTTP_URL_AVALANCHE_2")
  );
}

export function envAvalancheWsUrl(): string {
  return firstEnv(
    "ONFINALITY_WSS_AVALANCHE",
    "AVALANCHE_WSS_URL",
    "RPC_WSS_URL_AVALANCHE",
    "NEXT_PUBLIC_AVALANCHE_WS_URL"
  );
}

export function envBaseWsUrl(): string {
  return firstEnv("ONFINALITY_WSS_BASE", "BASE_WSS_URL", "RPC_WSS_URL_BASE");
}

export function envMonadWsUrl(): string {
  return firstEnv("ONFINALITY_WSS_MONAD", "MONAD_WSS_URL", "RPC_WSS_URL_MONAD");
}

export function envAvalancheWsUrlFallback(): string {
  return preferBlockmachineFallbackWs(
    "avalanche",
    firstEnv("AVALANCHE_WSS_URL_2", "RPC_WSS_URL_AVALANCHE_2")
  );
}

export const BSC_TOKENS = {
  wbnb: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  usdt: "0x55d398326f99059fF775485246999027B3197955",
  busd: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  btcb: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
  weth: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
  cake: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  link: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD",
  uni: "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1",
  matic: "0xCC42724C6683B7E57334c4E856f4c9965ED682bD",
  xrp: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE",
  ada: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47",
  doge: "0xbA2ae424d960c26247Dd6c32edC70B295c744C43",
} as const;

/** Balancer V2 Vault — sama di Ethereum / Polygon / Arbitrum. Bukan executor kita. */
export const BALANCER_V2_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
/** BalancerFlashArb yang baru di-deploy di Arbitrum One. */
export const ARBITRUM_BALANCER_FLASH_ARB = "0x5b1E4177CA3115c9c4F480dB9649Bcdb50b0C435";
/** BalancerFlashArb / executor flashloan di Ethereum Mainnet. */
export const ETHEREUM_BALANCER_FLASH_ARB = "0x969fdD49FCb3E70a164511fFB3dDb19aed0821D6";

/** Polygon PoS (scanner catalog + deploy / vault mapping). */
export const POLYGON_CHAIN_ID = 137;
/** RPC publik tanpa kunci — hanya untuk UI/wallet. Scanner tetap Blockmachine. */
export const POLYGON_PUBLIC_RPC_URL = "https://polygon-bor.publicnode.com";
export const POLYGON_PUBLIC_RPC_URL_FALLBACK = "https://polygon-rpc.com";
export const POLYGON_PUBLIC_WS_URL = "wss://polygon-bor.publicnode.com";
export const POLYGON_EXPLORER_TX = "https://polygonscan.com/tx/";
/** WMATIC resmi Polygon PoS. */
export const POLYGON_WMATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
/** Vault Balancer V2 di chain 137 — alamat kanonik yang sama. */
export const POLYGON_BALANCER_VAULT = BALANCER_V2_VAULT;

export const ETHEREUM_CHAIN_ID = 1;
export const ETHEREUM_PUBLIC_RPC_URL = "https://ethereum.publicnode.com";
export const ETHEREUM_PUBLIC_RPC_URL_FALLBACK = "https://ethereum.publicnode.com";
export const ETHEREUM_PUBLIC_WS_URL = "wss://ethereum.publicnode.com";
export const ETHEREUM_EXPLORER_TX = "https://etherscan.io/tx/";

/** Vault Balancer V2 per EVM chain id (encode + deploy). */
export const BALANCER_V2_VAULT_BY_CHAIN_ID: Record<number, string> = {
  1: BALANCER_V2_VAULT,
  10: BALANCER_V2_VAULT,
  [POLYGON_CHAIN_ID]: POLYGON_BALANCER_VAULT,
  8453: BALANCER_V2_VAULT,
  42161: BALANCER_V2_VAULT,
  43114: BALANCER_V2_VAULT,
};

export function balancerVaultForChainId(evmChainId: number): string {
  return BALANCER_V2_VAULT_BY_CHAIN_ID[evmChainId] ?? BALANCER_V2_VAULT;
}

/** Kontrak kanonik Arbitrum One (checksum EIP-55). */
export const ARBITRUM_TOKENS = {
  weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  usdt: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  arb: "0x912CE59144191C1204E64559FE8253a0e49E6548",
  wbtc: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  link: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
  uni: "0xFa7F8980b0f1E64A2062791cc3b0879522BA1f12",
  gmx: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
  pendle: "0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8",
  dai: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  magic: "0x539bdE0d7Dbd336b79148AA742883198BBF60342",
} as const;

/** Token kanonik Polygon PoS (checksum EIP-55). USDC = native Circle, bukan USDC.e. */
export const POLYGON_TOKENS = {
  wmatic: POLYGON_WMATIC,
  weth: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  usdt: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  wbtc: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
  link: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39",
  aave: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B",
  dai: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  crv: "0x172370d5Cd63279eFa6d502DAB29171933a610AF",
  uni: "0xb33EaAd8d922B1083446DC59fF4c017b5Cf6C36E",
} as const;

/** Token kanonik Ethereum Mainnet (checksum EIP-55). */
export const ETHEREUM_TOKENS = {
  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  wbtc: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  dai: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  link: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  uni: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  aave: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
  crv: "0xD533a949740bb3306d119CC777fa900bA034cd52",
  ldo: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32",
  mkr: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
} as const;

export const OPTIMISM_TOKENS = {
  weth: "0x4200000000000000000000000000000000000006",
  usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  usdt: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  op: "0x4200000000000000000000000000000000000042",
  wbtc: "0x68f180fcCe3303253502493B7Ad43d59633118e7",
  dai: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  link: "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6",
  snx: "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4",
  aave: "0x76FB31fb4af56892A25e32cFC43De717950c9278",
  perp: "0x9e1028F5F1D5eDE59748FFceE5532509976840E0",
  ldo: "0xFdb794692724153d1488CcdBE0C56c252596735F",
} as const;

export const BASE_TOKENS = {
  weth: "0x4200000000000000000000000000000000000006",
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  usdbc: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
  cbeth: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
  aero: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
  toshi: "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4",
  brett: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
  degen: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
  dai: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  link: "0x88Fb150BDc53A443ae8368A65E43f6E3C58afd1C",
  wbtc: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
} as const;

export const AVALANCHE_TOKENS = {
  wavax: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
  usdce: "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664",
  usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  usdt: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
  weth: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
  wbtc: "0x50b7545627a5162F82A992c33b87aDc75187B218",
  joe: "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd",
  link: "0x5947BB275c521040051D82396192181b413227A3",
  daie: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70",
  aave: "0x63a72806098Bd3D9520cC43356dD78afe5D386D9",
  qi: "0x8729438EB15e2C8B576fCc6AeCdB6A45377BF2E5",
} as const;

/** Monad mainnet. WMON kanonik, USDC Circle, WETH dari market Aave V3. */
export const MONAD_TOKENS = {
  wmon: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
  usdc: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
  weth: "0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242",
} as const;

/** Pool Aave V3.7 Monad. Premi flash 0.09% (900 ppm). */
export const MONAD_AAVE_V3_POOL = "0x69a5F9AD4f96ebf0a0C792dD42a01cC5C0102fef";

/** Uniswap V3 Factory + SwapRouter02 di Monad. */
export const MONAD_UNISWAP_V3_FACTORY = "0x204faca1764b154221e35c0d20abb3c525710498";
export const MONAD_UNISWAP_V3_ROUTER = "0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900";

const ICONS = {
  wbnb: `${BSC}/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c/logo.png`,
  usdtBsc: `${BSC}/0x55d398326f99059fF775485246999027B3197955/logo.png`,
  busd: `${BSC}/0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56/logo.png`,
  usdcBsc: `${BSC}/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d/logo.png`,
  btcb: `${BSC}/0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c/logo.png`,
  cake: `${BSC}/0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82/logo.png`,
  wethBsc: `${BSC}/0x2170Ed0880ac9A755fd29B2688956BD959F933F8/logo.png`,
  linkBsc: `${BSC}/0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD/logo.png`,
  uniBsc: `${BSC}/0xBf5140A22578168FD562DCcF235E5D43A02ce9B1/logo.png`,
  maticBsc: `${BSC}/0xCC42724C6683B7E57334c4E856f4c9965ED682bD/logo.png`,
  xrp: `${BSC}/0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE/logo.png`,
  ada: `${BSC}/0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47/logo.png`,
  doge: `${BSC}/0xbA2ae424d960c26247Dd6c32edC70B295c744C43/logo.png`,
  weth: `${ETH}/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png`,
  usdt: `${ETH}/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png`,
  usdc: `${CG}/6319/small/usdc.png`,
  wbtc: `${ETH}/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png`,
  link: `${ETH}/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png`,
  uni: `${ETH}/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png`,
  arb: `${ARB}/0x912CE59144191C1204E64559FE8253a0e49E6548/logo.png`,
  gmx: `${ARB}/0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a/logo.png`,
  pendle: `${ETH}/0x808507121B80c02388fAd14726482e061B8da827/logo.png`,
  dai: `${ETH}/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png`,
  magic: `${ARB}/0x539bdE0d7Dbd336b79148AA742883198BBF60342/logo.png`,
  aave: `${ETH}/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png`,
  crv: `${ETH}/0xD533a949740bb3306d119CC777fa900bA034cd52/logo.png`,
  ldo: `${ETH}/0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32/logo.png`,
  mkr: `${ETH}/0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2/logo.png`,
  wmatic: `${TW}/polygon/assets/0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270/logo.png`,
  op: `${TW}/optimism/info/logo.png`,
  avax: `${TW}/avalanchec/info/logo.png`,
  mon: `${TW}/monad/info/logo.png`,
  atom: `${TW}/cosmos/info/logo.png`,
  cbeth: `${ETH}/0xBe9895146f7AF43049a1D1e81c6670dDA2CBd7E3/logo.png`,
  snx: `${ETH}/0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F/logo.png`,
  perp: `${ETH}/0xbC396689893D065F41bc2C6EcbeE5e0085233443/logo.png`,
  joe: `${AVAX}/0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd/logo.png`,
  qi: `${AVAX}/0x8729438EB15e2C8B576fCc6AeCdB6A45377BF2E5/logo.png`,
  aero: `${BASE}/0x940181a94A35A4569E4529A3CDfB74e38FD98631/logo.png`,
  toshi: `${BASE}/0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4/logo.png`,
  brett: `${BASE}/0x532f27101965dd16442E59d40670FaF5eBB142E4/logo.png`,
  degen: `${BASE}/0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed/logo.png`,
  osmo: `${TW}/osmosis/info/logo.png`,
  inj: `${TW}/injective/info/logo.png`,
  scrt: `${TW}/secret/info/logo.png`,
  juno: `${TW}/juno/info/logo.png`,
  akt: `${TW}/akash/info/logo.png`,
  kava: `${TW}/kava/info/logo.png`,
  dydx: `${CG}/17512/small/wMBc1cEF_400x400.jpg`,
  sol: `${TW}/solana/info/logo.png`,
  jup: `${CG}/27277/small/jup.png`,
  bonk: `${CG}/28600/small/bonk.jpg`,
  wif: `${CG}/33566/small/dogwifhat.jpg`,
  pyth: `${CG}/31924/small/pyth.png`,
  ray: `${CG}/13928/small/ray.png`,
  jto: `${CG}/33228/small/jito.png`,
  msol: `${CG}/17752/small/mSOL.png`,
  bsol: `${CG}/28605/small/blazestake.png`,
};

function pair(row: TokenPairConfig): TokenPairConfig {
  return row;
}

const BSC_PAIRS: TokenPairConfig[] = [
  pair({ id: "wbnb-usdt", label: "WBNB / USDT", baseSymbol: "WBNB", quoteSymbol: "USDT", baseIcon: ICONS.wbnb, quoteIcon: ICONS.usdtBsc, baseAddress: BSC_TOKENS.wbnb, quoteAddress: BSC_TOKENS.usdt, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "wbnb-busd", label: "WBNB / BUSD", baseSymbol: "WBNB", quoteSymbol: "BUSD", baseIcon: ICONS.wbnb, quoteIcon: ICONS.busd, baseAddress: BSC_TOKENS.wbnb, quoteAddress: BSC_TOKENS.busd, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "wbnb-usdc", label: "WBNB / USDC", baseSymbol: "WBNB", quoteSymbol: "USDC", baseIcon: ICONS.wbnb, quoteIcon: ICONS.usdcBsc, baseAddress: BSC_TOKENS.wbnb, quoteAddress: BSC_TOKENS.usdc, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "eth-wbnb", label: "ETH / WBNB", baseSymbol: "ETH", quoteSymbol: "WBNB", baseIcon: ICONS.wethBsc, quoteIcon: ICONS.wbnb, baseAddress: BSC_TOKENS.weth, quoteAddress: BSC_TOKENS.wbnb, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "btcb-wbnb", label: "BTCB / WBNB", baseSymbol: "BTCB", quoteSymbol: "WBNB", baseIcon: ICONS.btcb, quoteIcon: ICONS.wbnb, baseAddress: BSC_TOKENS.btcb, quoteAddress: BSC_TOKENS.wbnb, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "cake-wbnb", label: "CAKE / WBNB", baseSymbol: "CAKE", quoteSymbol: "WBNB", baseIcon: ICONS.cake, quoteIcon: ICONS.wbnb, baseAddress: BSC_TOKENS.cake, quoteAddress: BSC_TOKENS.wbnb, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "link-wbnb", label: "LINK / WBNB", baseSymbol: "LINK", quoteSymbol: "WBNB", baseIcon: ICONS.linkBsc, quoteIcon: ICONS.wbnb, baseAddress: BSC_TOKENS.link, quoteAddress: BSC_TOKENS.wbnb, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "xrp-wbnb", label: "XRP / WBNB", baseSymbol: "XRP", quoteSymbol: "WBNB", baseIcon: ICONS.xrp, quoteIcon: ICONS.wbnb, baseAddress: BSC_TOKENS.xrp, quoteAddress: BSC_TOKENS.wbnb, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "ada-wbnb", label: "ADA / WBNB", baseSymbol: "ADA", quoteSymbol: "WBNB", baseIcon: ICONS.ada, quoteIcon: ICONS.wbnb, baseAddress: BSC_TOKENS.ada, quoteAddress: BSC_TOKENS.wbnb, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "doge-wbnb", label: "DOGE / WBNB", baseSymbol: "DOGE", quoteSymbol: "WBNB", baseIcon: ICONS.doge, quoteIcon: ICONS.wbnb, baseAddress: BSC_TOKENS.doge, quoteAddress: BSC_TOKENS.wbnb, baseDecimals: 8, quoteDecimals: 18 }),
];

const ARBITRUM_PAIRS: TokenPairConfig[] = [
  pair({ id: "weth-usdc-arb", label: "WETH / USDC", baseSymbol: "WETH", quoteSymbol: "USDC", baseIcon: ICONS.weth, quoteIcon: ICONS.usdc, baseAddress: ARBITRUM_TOKENS.weth, quoteAddress: ARBITRUM_TOKENS.usdc, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "wbtc-weth-arb", label: "WBTC / WETH", baseSymbol: "WBTC", quoteSymbol: "WETH", baseIcon: ICONS.wbtc, quoteIcon: ICONS.weth, baseAddress: ARBITRUM_TOKENS.wbtc, quoteAddress: ARBITRUM_TOKENS.weth, baseDecimals: 8, quoteDecimals: 18 }),
  pair({ id: "arb-weth", label: "ARB / WETH", baseSymbol: "ARB", quoteSymbol: "WETH", baseIcon: ICONS.arb, quoteIcon: ICONS.weth, baseAddress: ARBITRUM_TOKENS.arb, quoteAddress: ARBITRUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "link-weth-arb", label: "LINK / WETH", baseSymbol: "LINK", quoteSymbol: "WETH", baseIcon: ICONS.link, quoteIcon: ICONS.weth, baseAddress: ARBITRUM_TOKENS.link, quoteAddress: ARBITRUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "uni-weth-arb", label: "UNI / WETH", baseSymbol: "UNI", quoteSymbol: "WETH", baseIcon: ICONS.uni, quoteIcon: ICONS.weth, baseAddress: ARBITRUM_TOKENS.uni, quoteAddress: ARBITRUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "gmx-weth-arb", label: "GMX / WETH", baseSymbol: "GMX", quoteSymbol: "WETH", baseIcon: ICONS.gmx, quoteIcon: ICONS.weth, baseAddress: ARBITRUM_TOKENS.gmx, quoteAddress: ARBITRUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "usdt-usdc-arb", label: "USDT / USDC", baseSymbol: "USDT", quoteSymbol: "USDC", baseIcon: ICONS.usdt, quoteIcon: ICONS.usdc, baseAddress: ARBITRUM_TOKENS.usdt, quoteAddress: ARBITRUM_TOKENS.usdc, baseDecimals: 6, quoteDecimals: 6 }),
  pair({ id: "dai-weth-arb", label: "DAI / WETH", baseSymbol: "DAI", quoteSymbol: "WETH", baseIcon: ICONS.dai, quoteIcon: ICONS.weth, baseAddress: ARBITRUM_TOKENS.dai, quoteAddress: ARBITRUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "magic-weth-arb", label: "MAGIC / WETH", baseSymbol: "MAGIC", quoteSymbol: "WETH", baseIcon: ICONS.magic, quoteIcon: ICONS.weth, baseAddress: ARBITRUM_TOKENS.magic, quoteAddress: ARBITRUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "pendle-weth-arb", label: "PENDLE / WETH", baseSymbol: "PENDLE", quoteSymbol: "WETH", baseIcon: ICONS.pendle, quoteIcon: ICONS.weth, baseAddress: ARBITRUM_TOKENS.pendle, quoteAddress: ARBITRUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
];

const POLYGON_PAIRS: TokenPairConfig[] = [
  pair({ id: "wmatic-usdc-pol", label: "WMATIC / USDC", baseSymbol: "WMATIC", quoteSymbol: "USDC", baseIcon: ICONS.wmatic, quoteIcon: ICONS.usdc, baseAddress: POLYGON_TOKENS.wmatic, quoteAddress: POLYGON_TOKENS.usdc, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "wmatic-usdt-pol", label: "WMATIC / USDT", baseSymbol: "WMATIC", quoteSymbol: "USDT", baseIcon: ICONS.wmatic, quoteIcon: ICONS.usdt, baseAddress: POLYGON_TOKENS.wmatic, quoteAddress: POLYGON_TOKENS.usdt, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "wmatic-weth-pol", label: "WMATIC / WETH", baseSymbol: "WMATIC", quoteSymbol: "WETH", baseIcon: ICONS.wmatic, quoteIcon: ICONS.weth, baseAddress: POLYGON_TOKENS.wmatic, quoteAddress: POLYGON_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "weth-usdc-pol", label: "WETH / USDC", baseSymbol: "WETH", quoteSymbol: "USDC", baseIcon: ICONS.weth, quoteIcon: ICONS.usdc, baseAddress: POLYGON_TOKENS.weth, quoteAddress: POLYGON_TOKENS.usdc, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "weth-usdt-pol", label: "WETH / USDT", baseSymbol: "WETH", quoteSymbol: "USDT", baseIcon: ICONS.weth, quoteIcon: ICONS.usdt, baseAddress: POLYGON_TOKENS.weth, quoteAddress: POLYGON_TOKENS.usdt, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "usdt-usdc-pol", label: "USDT / USDC", baseSymbol: "USDT", quoteSymbol: "USDC", baseIcon: ICONS.usdt, quoteIcon: ICONS.usdc, baseAddress: POLYGON_TOKENS.usdt, quoteAddress: POLYGON_TOKENS.usdc, baseDecimals: 6, quoteDecimals: 6 }),
  pair({ id: "wbtc-weth-pol", label: "WBTC / WETH", baseSymbol: "WBTC", quoteSymbol: "WETH", baseIcon: ICONS.wbtc, quoteIcon: ICONS.weth, baseAddress: POLYGON_TOKENS.wbtc, quoteAddress: POLYGON_TOKENS.weth, baseDecimals: 8, quoteDecimals: 18 }),
  pair({ id: "link-weth-pol", label: "LINK / WETH", baseSymbol: "LINK", quoteSymbol: "WETH", baseIcon: ICONS.link, quoteIcon: ICONS.weth, baseAddress: POLYGON_TOKENS.link, quoteAddress: POLYGON_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "aave-weth-pol", label: "AAVE / WETH", baseSymbol: "AAVE", quoteSymbol: "WETH", baseIcon: ICONS.aave, quoteIcon: ICONS.weth, baseAddress: POLYGON_TOKENS.aave, quoteAddress: POLYGON_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "matic-usdt-pol", label: "MATIC / USDT", baseSymbol: "MATIC", quoteSymbol: "USDT", baseIcon: ICONS.wmatic, quoteIcon: ICONS.usdt, baseAddress: POLYGON_TOKENS.wmatic, quoteAddress: POLYGON_TOKENS.usdt, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "dai-usdc-pol", label: "DAI / USDC", baseSymbol: "DAI", quoteSymbol: "USDC", baseIcon: ICONS.dai, quoteIcon: ICONS.usdc, baseAddress: POLYGON_TOKENS.dai, quoteAddress: POLYGON_TOKENS.usdc, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "crv-weth-pol", label: "CRV / WETH", baseSymbol: "CRV", quoteSymbol: "WETH", baseIcon: ICONS.crv, quoteIcon: ICONS.weth, baseAddress: POLYGON_TOKENS.crv, quoteAddress: POLYGON_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "uni-weth-pol", label: "UNI / WETH", baseSymbol: "UNI", quoteSymbol: "WETH", baseIcon: ICONS.uni, quoteIcon: ICONS.weth, baseAddress: POLYGON_TOKENS.uni, quoteAddress: POLYGON_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
];

const ETHEREUM_PAIRS: TokenPairConfig[] = [
  pair({ id: "weth-usdc-eth", label: "WETH / USDC", baseSymbol: "WETH", quoteSymbol: "USDC", baseIcon: ICONS.weth, quoteIcon: ICONS.usdc, baseAddress: ETHEREUM_TOKENS.weth, quoteAddress: ETHEREUM_TOKENS.usdc, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "weth-usdt-eth", label: "WETH / USDT", baseSymbol: "WETH", quoteSymbol: "USDT", baseIcon: ICONS.weth, quoteIcon: ICONS.usdt, baseAddress: ETHEREUM_TOKENS.weth, quoteAddress: ETHEREUM_TOKENS.usdt, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "wbtc-weth-eth", label: "WBTC / WETH", baseSymbol: "WBTC", quoteSymbol: "WETH", baseIcon: ICONS.wbtc, quoteIcon: ICONS.weth, baseAddress: ETHEREUM_TOKENS.wbtc, quoteAddress: ETHEREUM_TOKENS.weth, baseDecimals: 8, quoteDecimals: 18 }),
  pair({ id: "dai-usdc-eth", label: "DAI / USDC", baseSymbol: "DAI", quoteSymbol: "USDC", baseIcon: ICONS.dai, quoteIcon: ICONS.usdc, baseAddress: ETHEREUM_TOKENS.dai, quoteAddress: ETHEREUM_TOKENS.usdc, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "link-weth-eth", label: "LINK / WETH", baseSymbol: "LINK", quoteSymbol: "WETH", baseIcon: ICONS.link, quoteIcon: ICONS.weth, baseAddress: ETHEREUM_TOKENS.link, quoteAddress: ETHEREUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "uni-weth-eth", label: "UNI / WETH", baseSymbol: "UNI", quoteSymbol: "WETH", baseIcon: ICONS.uni, quoteIcon: ICONS.weth, baseAddress: ETHEREUM_TOKENS.uni, quoteAddress: ETHEREUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "aave-weth-eth", label: "AAVE / WETH", baseSymbol: "AAVE", quoteSymbol: "WETH", baseIcon: ICONS.aave, quoteIcon: ICONS.weth, baseAddress: ETHEREUM_TOKENS.aave, quoteAddress: ETHEREUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "crv-weth-eth", label: "CRV / WETH", baseSymbol: "CRV", quoteSymbol: "WETH", baseIcon: ICONS.crv, quoteIcon: ICONS.weth, baseAddress: ETHEREUM_TOKENS.crv, quoteAddress: ETHEREUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "ldo-weth-eth", label: "LDO / WETH", baseSymbol: "LDO", quoteSymbol: "WETH", baseIcon: ICONS.ldo, quoteIcon: ICONS.weth, baseAddress: ETHEREUM_TOKENS.ldo, quoteAddress: ETHEREUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "mkr-weth-eth", label: "MKR / WETH", baseSymbol: "MKR", quoteSymbol: "WETH", baseIcon: ICONS.mkr, quoteIcon: ICONS.weth, baseAddress: ETHEREUM_TOKENS.mkr, quoteAddress: ETHEREUM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
];

const OPTIMISM_PAIRS: TokenPairConfig[] = [
  pair({ id: "weth-usdc-op", label: "WETH / USDC", baseSymbol: "WETH", quoteSymbol: "USDC", baseIcon: ICONS.weth, quoteIcon: ICONS.usdc, baseAddress: OPTIMISM_TOKENS.weth, quoteAddress: OPTIMISM_TOKENS.usdc, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "op-weth", label: "OP / WETH", baseSymbol: "OP", quoteSymbol: "WETH", baseIcon: ICONS.op, quoteIcon: ICONS.weth, baseAddress: OPTIMISM_TOKENS.op, quoteAddress: OPTIMISM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "wbtc-weth-op", label: "WBTC / WETH", baseSymbol: "WBTC", quoteSymbol: "WETH", baseIcon: ICONS.wbtc, quoteIcon: ICONS.weth, baseAddress: OPTIMISM_TOKENS.wbtc, quoteAddress: OPTIMISM_TOKENS.weth, baseDecimals: 8, quoteDecimals: 18 }),
  pair({ id: "usdt-usdc-op", label: "USDT / USDC", baseSymbol: "USDT", quoteSymbol: "USDC", baseIcon: ICONS.usdt, quoteIcon: ICONS.usdc, baseAddress: OPTIMISM_TOKENS.usdt, quoteAddress: OPTIMISM_TOKENS.usdc, baseDecimals: 6, quoteDecimals: 6 }),
  pair({ id: "snx-weth-op", label: "SNX / WETH", baseSymbol: "SNX", quoteSymbol: "WETH", baseIcon: ICONS.snx, quoteIcon: ICONS.weth, baseAddress: OPTIMISM_TOKENS.snx, quoteAddress: OPTIMISM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "link-weth-op", label: "LINK / WETH", baseSymbol: "LINK", quoteSymbol: "WETH", baseIcon: ICONS.link, quoteIcon: ICONS.weth, baseAddress: OPTIMISM_TOKENS.link, quoteAddress: OPTIMISM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "dai-weth-op", label: "DAI / WETH", baseSymbol: "DAI", quoteSymbol: "WETH", baseIcon: ICONS.dai, quoteIcon: ICONS.weth, baseAddress: OPTIMISM_TOKENS.dai, quoteAddress: OPTIMISM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "aave-weth-op", label: "AAVE / WETH", baseSymbol: "AAVE", quoteSymbol: "WETH", baseIcon: ICONS.aave, quoteIcon: ICONS.weth, baseAddress: OPTIMISM_TOKENS.aave, quoteAddress: OPTIMISM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "perp-weth-op", label: "PERP / WETH", baseSymbol: "PERP", quoteSymbol: "WETH", baseIcon: ICONS.perp, quoteIcon: ICONS.weth, baseAddress: OPTIMISM_TOKENS.perp, quoteAddress: OPTIMISM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "ldo-weth-op", label: "LDO / WETH", baseSymbol: "LDO", quoteSymbol: "WETH", baseIcon: ICONS.ldo, quoteIcon: ICONS.weth, baseAddress: OPTIMISM_TOKENS.ldo, quoteAddress: OPTIMISM_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
];

const BASE_PAIRS: TokenPairConfig[] = [
  pair({ id: "weth-usdbc-base", label: "WETH / USDbC", baseSymbol: "WETH", quoteSymbol: "USDbC", baseIcon: ICONS.weth, quoteIcon: ICONS.usdc, baseAddress: BASE_TOKENS.weth, quoteAddress: BASE_TOKENS.usdbc, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "weth-usdc-base", label: "WETH / USDC", baseSymbol: "WETH", quoteSymbol: "USDC", baseIcon: ICONS.weth, quoteIcon: ICONS.usdc, baseAddress: BASE_TOKENS.weth, quoteAddress: BASE_TOKENS.usdc, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "cbeth-weth-base", label: "cbETH / WETH", baseSymbol: "cbETH", quoteSymbol: "WETH", baseIcon: ICONS.cbeth, quoteIcon: ICONS.weth, baseAddress: BASE_TOKENS.cbeth, quoteAddress: BASE_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "aero-weth-base", label: "AERO / WETH", baseSymbol: "AERO", quoteSymbol: "WETH", baseIcon: ICONS.aero, quoteIcon: ICONS.weth, baseAddress: BASE_TOKENS.aero, quoteAddress: BASE_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "toshi-weth-base", label: "TOSHI / WETH", baseSymbol: "TOSHI", quoteSymbol: "WETH", baseIcon: ICONS.toshi, quoteIcon: ICONS.weth, baseAddress: BASE_TOKENS.toshi, quoteAddress: BASE_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "brett-weth-base", label: "BRETT / WETH", baseSymbol: "BRETT", quoteSymbol: "WETH", baseIcon: ICONS.brett, quoteIcon: ICONS.weth, baseAddress: BASE_TOKENS.brett, quoteAddress: BASE_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "degen-weth-base", label: "DEGEN / WETH", baseSymbol: "DEGEN", quoteSymbol: "WETH", baseIcon: ICONS.degen, quoteIcon: ICONS.weth, baseAddress: BASE_TOKENS.degen, quoteAddress: BASE_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "link-weth-base", label: "LINK / WETH", baseSymbol: "LINK", quoteSymbol: "WETH", baseIcon: ICONS.link, quoteIcon: ICONS.weth, baseAddress: BASE_TOKENS.link, quoteAddress: BASE_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "dai-weth-base", label: "DAI / WETH", baseSymbol: "DAI", quoteSymbol: "WETH", baseIcon: ICONS.dai, quoteIcon: ICONS.weth, baseAddress: BASE_TOKENS.dai, quoteAddress: BASE_TOKENS.weth, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "wbtc-weth-base", label: "WBTC / WETH", baseSymbol: "WBTC", quoteSymbol: "WETH", baseIcon: ICONS.wbtc, quoteIcon: ICONS.weth, baseAddress: BASE_TOKENS.wbtc, quoteAddress: BASE_TOKENS.weth, baseDecimals: 8, quoteDecimals: 18 }),
];

const AVALANCHE_PAIRS: TokenPairConfig[] = [
  pair({ id: "wavax-usdce", label: "WAVAX / USDC.e", baseSymbol: "WAVAX", quoteSymbol: "USDC.e", baseIcon: ICONS.avax, quoteIcon: ICONS.usdc, baseAddress: AVALANCHE_TOKENS.wavax, quoteAddress: AVALANCHE_TOKENS.usdce, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "wavax-usdt", label: "WAVAX / USDT", baseSymbol: "WAVAX", quoteSymbol: "USDT", baseIcon: ICONS.avax, quoteIcon: ICONS.usdt, baseAddress: AVALANCHE_TOKENS.wavax, quoteAddress: AVALANCHE_TOKENS.usdt, baseDecimals: 18, quoteDecimals: 6 }),
  pair({ id: "wethe-wavax", label: "WETH.e / WAVAX", baseSymbol: "WETH.e", quoteSymbol: "WAVAX", baseIcon: ICONS.weth, quoteIcon: ICONS.avax, baseAddress: AVALANCHE_TOKENS.weth, quoteAddress: AVALANCHE_TOKENS.wavax, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "wbtce-wavax", label: "WBTC.e / WAVAX", baseSymbol: "WBTC.e", quoteSymbol: "WAVAX", baseIcon: ICONS.wbtc, quoteIcon: ICONS.avax, baseAddress: AVALANCHE_TOKENS.wbtc, quoteAddress: AVALANCHE_TOKENS.wavax, baseDecimals: 8, quoteDecimals: 18 }),
  pair({ id: "joe-wavax", label: "JOE / WAVAX", baseSymbol: "JOE", quoteSymbol: "WAVAX", baseIcon: ICONS.joe, quoteIcon: ICONS.avax, baseAddress: AVALANCHE_TOKENS.joe, quoteAddress: AVALANCHE_TOKENS.wavax, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "link-wavax", label: "LINK / WAVAX", baseSymbol: "LINK", quoteSymbol: "WAVAX", baseIcon: ICONS.link, quoteIcon: ICONS.avax, baseAddress: AVALANCHE_TOKENS.link, quoteAddress: AVALANCHE_TOKENS.wavax, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "daie-wavax", label: "DAI.e / WAVAX", baseSymbol: "DAI.e", quoteSymbol: "WAVAX", baseIcon: ICONS.dai, quoteIcon: ICONS.avax, baseAddress: AVALANCHE_TOKENS.daie, quoteAddress: AVALANCHE_TOKENS.wavax, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "aave-wavax", label: "AAVE / WAVAX", baseSymbol: "AAVE", quoteSymbol: "WAVAX", baseIcon: ICONS.aave, quoteIcon: ICONS.avax, baseAddress: AVALANCHE_TOKENS.aave, quoteAddress: AVALANCHE_TOKENS.wavax, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "qi-wavax", label: "QI / WAVAX", baseSymbol: "QI", quoteSymbol: "WAVAX", baseIcon: ICONS.qi, quoteIcon: ICONS.avax, baseAddress: AVALANCHE_TOKENS.qi, quoteAddress: AVALANCHE_TOKENS.wavax, baseDecimals: 18, quoteDecimals: 18 }),
  pair({ id: "usdc-usdt-avax", label: "USDC / USDT", baseSymbol: "USDC", quoteSymbol: "USDT", baseIcon: ICONS.usdc, quoteIcon: ICONS.usdt, baseAddress: AVALANCHE_TOKENS.usdc, quoteAddress: AVALANCHE_TOKENS.usdt, baseDecimals: 6, quoteDecimals: 6 }),
];

export const LINEA_TOKENS = {
  weth: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
  usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
} as const;

const LINEA_PAIRS: TokenPairConfig[] = [
  pair({
    id: "weth-usdc-linea",
    label: "WETH / USDC",
    baseSymbol: "WETH",
    quoteSymbol: "USDC",
    baseIcon: ICONS.weth,
    quoteIcon: ICONS.usdc,
    baseAddress: LINEA_TOKENS.weth,
    quoteAddress: LINEA_TOKENS.usdc,
    baseDecimals: 18,
    quoteDecimals: 6,
  }),
];

const MONAD_PAIRS: TokenPairConfig[] = [
  pair({
    id: "wmon-usdc",
    label: "WMON / USDC",
    baseSymbol: "WMON",
    quoteSymbol: "USDC",
    baseIcon: ICONS.mon,
    quoteIcon: ICONS.usdc,
    baseAddress: MONAD_TOKENS.wmon,
    quoteAddress: MONAD_TOKENS.usdc,
    baseDecimals: 18,
    quoteDecimals: 6,
  }),
  pair({
    id: "weth-usdc-monad",
    label: "WETH / USDC",
    baseSymbol: "WETH",
    quoteSymbol: "USDC",
    baseIcon: ICONS.weth,
    quoteIcon: ICONS.usdc,
    baseAddress: MONAD_TOKENS.weth,
    quoteAddress: MONAD_TOKENS.usdc,
    baseDecimals: 18,
    quoteDecimals: 6,
  }),
];

/** Mint kanonik Solana mainnet (base58). */
export const SOLANA_TOKENS = {
  sol: "So11111111111111111111111111111111111111112",
  usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  usdt: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  jup: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFOSxu3qHSwHgWWy",
  bonk: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  wif: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  pyth: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  ray: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  jto: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  msol: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  bsol: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
} as const;

const SOLANA_PAIRS: TokenPairConfig[] = [
  pair({
    id: "sol-usdc",
    label: "SOL / USDC",
    baseSymbol: "SOL",
    quoteSymbol: "USDC",
    baseIcon: ICONS.sol,
    quoteIcon: ICONS.usdc,
    baseAddress: SOLANA_TOKENS.sol,
    quoteAddress: SOLANA_TOKENS.usdc,
    baseDecimals: 9,
    quoteDecimals: 6,
  }),
  pair({
    id: "sol-usdt",
    label: "SOL / USDT",
    baseSymbol: "SOL",
    quoteSymbol: "USDT",
    baseIcon: ICONS.sol,
    quoteIcon: ICONS.usdt,
    baseAddress: SOLANA_TOKENS.sol,
    quoteAddress: SOLANA_TOKENS.usdt,
    baseDecimals: 9,
    quoteDecimals: 6,
  }),
  pair({
    id: "jup-usdc",
    label: "JUP / USDC",
    baseSymbol: "JUP",
    quoteSymbol: "USDC",
    baseIcon: ICONS.jup,
    quoteIcon: ICONS.usdc,
    baseAddress: SOLANA_TOKENS.jup,
    quoteAddress: SOLANA_TOKENS.usdc,
    baseDecimals: 6,
    quoteDecimals: 6,
  }),
  pair({
    id: "bonk-sol",
    label: "BONK / SOL",
    baseSymbol: "BONK",
    quoteSymbol: "SOL",
    baseIcon: ICONS.bonk,
    quoteIcon: ICONS.sol,
    baseAddress: SOLANA_TOKENS.bonk,
    quoteAddress: SOLANA_TOKENS.sol,
    baseDecimals: 5,
    quoteDecimals: 9,
  }),
  pair({
    id: "wif-sol",
    label: "WIF / SOL",
    baseSymbol: "WIF",
    quoteSymbol: "SOL",
    baseIcon: ICONS.wif,
    quoteIcon: ICONS.sol,
    baseAddress: SOLANA_TOKENS.wif,
    quoteAddress: SOLANA_TOKENS.sol,
    baseDecimals: 6,
    quoteDecimals: 9,
  }),
  pair({
    id: "pyth-usdc",
    label: "PYTH / USDC",
    baseSymbol: "PYTH",
    quoteSymbol: "USDC",
    baseIcon: ICONS.pyth,
    quoteIcon: ICONS.usdc,
    baseAddress: SOLANA_TOKENS.pyth,
    quoteAddress: SOLANA_TOKENS.usdc,
    baseDecimals: 6,
    quoteDecimals: 6,
  }),
  pair({
    id: "ray-usdc",
    label: "RAY / USDC",
    baseSymbol: "RAY",
    quoteSymbol: "USDC",
    baseIcon: ICONS.ray,
    quoteIcon: ICONS.usdc,
    baseAddress: SOLANA_TOKENS.ray,
    quoteAddress: SOLANA_TOKENS.usdc,
    baseDecimals: 6,
    quoteDecimals: 6,
  }),
  pair({
    id: "jto-sol",
    label: "JTO / SOL",
    baseSymbol: "JTO",
    quoteSymbol: "SOL",
    baseIcon: ICONS.jto,
    quoteIcon: ICONS.sol,
    baseAddress: SOLANA_TOKENS.jto,
    quoteAddress: SOLANA_TOKENS.sol,
    baseDecimals: 9,
    quoteDecimals: 9,
  }),
  pair({
    id: "msol-sol",
    label: "mSOL / SOL",
    baseSymbol: "mSOL",
    quoteSymbol: "SOL",
    baseIcon: ICONS.msol,
    quoteIcon: ICONS.sol,
    baseAddress: SOLANA_TOKENS.msol,
    quoteAddress: SOLANA_TOKENS.sol,
    baseDecimals: 9,
    quoteDecimals: 9,
  }),
  pair({
    id: "bsol-sol",
    label: "bSOL / SOL",
    baseSymbol: "bSOL",
    quoteSymbol: "SOL",
    baseIcon: ICONS.bsol,
    quoteIcon: ICONS.sol,
    baseAddress: SOLANA_TOKENS.bsol,
    quoteAddress: SOLANA_TOKENS.sol,
    baseDecimals: 9,
    quoteDecimals: 9,
  }),
];

export const COSMOS_LEGACY_PAIRS: TokenPairConfig[] = [
  pair({ id: "atom-usdc", label: "ATOM / USDC", baseSymbol: "ATOM", quoteSymbol: "USDC", baseIcon: ICONS.atom, quoteIcon: ICONS.usdc }),
  pair({ id: "osmo-atom", label: "OSMO / ATOM", baseSymbol: "OSMO", quoteSymbol: "ATOM", baseIcon: ICONS.osmo, quoteIcon: ICONS.atom }),
  pair({ id: "weth-usdc-cosmos", label: "WETH / USDC", baseSymbol: "WETH", quoteSymbol: "USDC", baseIcon: ICONS.weth, quoteIcon: ICONS.usdc }),
  pair({ id: "wbtc-usdc-cosmos", label: "WBTC / USDC", baseSymbol: "WBTC", quoteSymbol: "USDC", baseIcon: ICONS.wbtc, quoteIcon: ICONS.usdc }),
  pair({ id: "inj-atom", label: "INJ / ATOM", baseSymbol: "INJ", quoteSymbol: "ATOM", baseIcon: ICONS.inj, quoteIcon: ICONS.atom }),
  pair({ id: "scrt-atom", label: "SCRT / ATOM", baseSymbol: "SCRT", quoteSymbol: "ATOM", baseIcon: ICONS.scrt, quoteIcon: ICONS.atom }),
  pair({ id: "juno-atom", label: "JUNO / ATOM", baseSymbol: "JUNO", quoteSymbol: "ATOM", baseIcon: ICONS.juno, quoteIcon: ICONS.atom }),
  pair({ id: "akt-atom", label: "AKT / ATOM", baseSymbol: "AKT", quoteSymbol: "ATOM", baseIcon: ICONS.akt, quoteIcon: ICONS.atom }),
  pair({ id: "kava-usdc", label: "KAVA / USDC", baseSymbol: "KAVA", quoteSymbol: "USDC", baseIcon: ICONS.kava, quoteIcon: ICONS.usdc }),
  pair({ id: "dydx-usdc", label: "DYDX / USDC", baseSymbol: "DYDX", quoteSymbol: "USDC", baseIcon: ICONS.dydx, quoteIcon: ICONS.usdc }),
];

export const TRADING_NETWORKS: Record<TradingChainId, TradingNetworkConfig> = {
  bsc: {
    id: "bsc",
    name: "BNB Smart Chain",
    shortLabel: "BSC Mainnet",
    chainId: 56,
    nativeSymbol: "BNB",
    nativeCurrency: "BNB",
    rpcUrl: envBscRpc(),
    wsUrl: envBscWs(),
    rpcUrlFallback: envBscRpcFallback(),
    wsUrlFallback: envBscWsFallback(),
    explorerTx: "https://bscscan.com/tx/",
    wrappedNative: BSC_TOKENS.wbnb,
    pairs: BSC_PAIRS,
  },
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum One",
    shortLabel: "Arbitrum Mainnet",
    chainId: 42161,
    nativeSymbol: "ETH",
    nativeCurrency: "ETH",
    rpcUrl: envArbRpc(),
    wsUrl: envArbWs(),
    rpcUrlFallback: envArbRpcFallback(),
    wsUrlFallback: envArbWsFallback(),
    explorerTx: "https://arbiscan.io/tx/",
    wrappedNative: ARBITRUM_TOKENS.weth,
    pairs: ARBITRUM_PAIRS,
  },
  polygon: {
    id: "polygon",
    name: "Polygon PoS",
    shortLabel: "Polygon Mainnet",
    chainId: POLYGON_CHAIN_ID,
    nativeSymbol: "POL",
    nativeCurrency: "POL",
    rpcUrl: POLYGON_PUBLIC_RPC_URL,
    wsUrl: POLYGON_PUBLIC_WS_URL,
    rpcUrlFallback: POLYGON_PUBLIC_RPC_URL_FALLBACK,
    wsUrlFallback: "",
    explorerTx: POLYGON_EXPLORER_TX,
    wrappedNative: POLYGON_TOKENS.wmatic,
    pairs: POLYGON_PAIRS,
  },
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    shortLabel: "Ethereum Mainnet",
    chainId: ETHEREUM_CHAIN_ID,
    nativeSymbol: "ETH",
    nativeCurrency: "ETH",
    rpcUrl: ETHEREUM_PUBLIC_RPC_URL,
    wsUrl: ETHEREUM_PUBLIC_WS_URL,
    rpcUrlFallback: ETHEREUM_PUBLIC_RPC_URL_FALLBACK,
    wsUrlFallback: "",
    explorerTx: ETHEREUM_EXPLORER_TX,
    wrappedNative: ETHEREUM_TOKENS.weth,
    pairs: ETHEREUM_PAIRS,
  },
  optimism: {
    id: "optimism",
    name: "Optimism",
    shortLabel: "OP Mainnet",
    chainId: 10,
    nativeSymbol: "ETH",
    nativeCurrency: "ETH",
    rpcUrl: "https://mainnet.optimism.io",
    wsUrl: "wss://optimism.publicnode.com",
    rpcUrlFallback: "https://optimism.publicnode.com",
    wsUrlFallback: "wss://optimism.publicnode.com",
    explorerTx: "https://optimistic.etherscan.io/tx/",
    wrappedNative: OPTIMISM_TOKENS.weth,
    pairs: OPTIMISM_PAIRS,
  },
  avalanche: {
    id: "avalanche",
    name: "Avalanche",
    shortLabel: "Avalanche C-Chain",
    chainId: 43114,
    nativeSymbol: "AVAX",
    nativeCurrency: "AVAX",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    wsUrl: "wss://avalanche-c-chain.publicnode.com",
    rpcUrlFallback: "https://avalanche-c-chain.publicnode.com",
    wsUrlFallback: "wss://avalanche-c-chain.publicnode.com",
    explorerTx: "https://snowtrace.io/tx/",
    wrappedNative: AVALANCHE_TOKENS.wavax,
    pairs: AVALANCHE_PAIRS,
  },
  solana: {
    id: "solana",
    name: "Solana",
    shortLabel: "Solana Mainnet",
    chainId: 0,
    nativeSymbol: "SOL",
    nativeCurrency: "SOL",
    rpcUrl: envSolanaRpcUrl() || "https://api.mainnet-beta.solana.com",
    wsUrl: envSolanaWsUrl() || "wss://api.mainnet-beta.solana.com",
    rpcUrlFallback: envSolanaRpcUrlFallback() || "https://api.mainnet-beta.solana.com",
    wsUrlFallback: envSolanaWsUrlFallback() || "wss://api.mainnet-beta.solana.com",
    explorerTx: "https://solscan.io/tx/",
    wrappedNative: SOLANA_TOKENS.sol,
    pairs: SOLANA_PAIRS,
  },
  base: {
    id: "base",
    name: "Base",
    shortLabel: "Base Mainnet",
    chainId: 8453,
    nativeSymbol: "ETH",
    nativeCurrency: "ETH",
    rpcUrl: "https://mainnet.base.org",
    wsUrl: "wss://base.publicnode.com",
    rpcUrlFallback: "https://base.publicnode.com",
    wsUrlFallback: "wss://base.publicnode.com",
    explorerTx: "https://basescan.org/tx/",
    wrappedNative: BASE_TOKENS.weth,
    pairs: BASE_PAIRS,
  },
  monad: {
    id: "monad",
    name: "Monad",
    shortLabel: "Monad Mainnet",
    chainId: 143,
    nativeSymbol: "MON",
    nativeCurrency: "MON",
    rpcUrl: "https://rpc.monad.xyz",
    wsUrl: "wss://rpc.monad.xyz",
    rpcUrlFallback: "https://rpc1.monad.xyz",
    wsUrlFallback: "wss://rpc1.monad.xyz",
    explorerTx: "https://monadscan.com/tx/",
    wrappedNative: MONAD_TOKENS.wmon,
    pairs: MONAD_PAIRS,
  },
  linea: {
    id: "linea",
    name: "Linea",
    shortLabel: "Linea Mainnet",
    chainId: 59144,
    nativeSymbol: "ETH",
    nativeCurrency: "ETH",
    rpcUrl: "https://rpc.linea.build",
    wsUrl: "wss://rpc.linea.build",
    rpcUrlFallback: "https://rpc.linea.build",
    wsUrlFallback: "wss://rpc.linea.build",
    explorerTx: "https://lineascan.build/tx/",
    wrappedNative: LINEA_TOKENS.weth,
    pairs: LINEA_PAIRS,
  },
};

/** Settings / header: BSC tetap tersedia di sini, bukan di switcher scanner. */
export const TRADING_CHAIN_LIST: TradingNetworkConfig[] = [TRADING_NETWORKS.arbitrum, TRADING_NETWORKS.bsc];

/** Dashboard scanner: lima rantai atas, lima bawah. Tiga terakhir tetap Arbitrum / Polygon / Ethereum. */
export const SCANNER_CHAIN_LIST: TradingNetworkConfig[] = [
  TRADING_NETWORKS.optimism,
  TRADING_NETWORKS.avalanche,
  TRADING_NETWORKS.solana,
  TRADING_NETWORKS.base,
  TRADING_NETWORKS.bsc,
  TRADING_NETWORKS.monad,
  TRADING_NETWORKS.linea,
  TRADING_NETWORKS.arbitrum,
  TRADING_NETWORKS.polygon,
  TRADING_NETWORKS.ethereum,
];

const TRADING_CHAIN_IDS: readonly TradingChainId[] = [
  "optimism",
  "avalanche",
  "solana",
  "base",
  "bsc",
  "monad",
  "arbitrum",
  "polygon",
  "ethereum",
  "linea",
];

export function isTradingChainId(value: unknown): value is TradingChainId {
  return typeof value === "string" && (TRADING_CHAIN_IDS as readonly string[]).includes(value);
}

export function isScannerChainId(value: unknown): value is ScannerChainId {
  return isTradingChainId(value);
}

function argvFlag(name: string): string {
  if (typeof process === "undefined" || !Array.isArray(process.argv)) return "";
  const prefix = `${name}=`;
  const args = process.argv;
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === name && args[i + 1]) return args[i + 1].trim().toLowerCase();
    if (token.startsWith(prefix)) return token.slice(prefix.length).trim().toLowerCase();
  }
  return "";
}

/** `--network` / `SCANNER_LOCK_CHAIN` mengunci satu rantai hanya jika diisi. Kosong = user pilih di UI. */
function explicitScannerSessionChain(): TradingChainId | null {
  const fromArg = argvFlag("--network") || argvFlag("--chain");
  if (isTradingChainId(fromArg)) return fromArg;
  const fromEnv = (
    process.env.SCANNER_LOCK_CHAIN ||
    process.env.NEXT_PUBLIC_SCANNER_LOCK_CHAIN ||
    ""
  )
    .trim()
    .toLowerCase();
  if (isTradingChainId(fromEnv)) return fromEnv;
  const fromBot = (process.env.BOT_CHAIN || "").trim().toLowerCase();
  if (isTradingChainId(fromBot)) return fromBot;
  return null;
}

/** Null jika tidak dikunci — tab Ethereum / Polygon / Arbitrum boleh diganti. */
export function scannerLockChainId(): TradingChainId | null {
  return explicitScannerSessionChain();
}

export function normalizeTradingChainId(value: unknown): TradingChainId {
  const locked = scannerLockChainId();
  if (locked) return locked;
  if (value === "cosmos") return "solana";
  if (isTradingChainId(value)) return value;
  return defaultTradingChainId();
}

export function defaultTradingChainId(): TradingChainId {
  const locked = scannerLockChainId();
  if (locked) return locked;
  const raw = (process.env.NEXT_PUBLIC_DEFAULT_CHAIN || "").trim().toLowerCase();
  if (isTradingChainId(raw)) return raw;
  const numeric = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || "");
  if (numeric === 42161) return "arbitrum";
  if (numeric === POLYGON_CHAIN_ID) return "polygon";
  if (numeric === ETHEREUM_CHAIN_ID) return "ethereum";
  if (numeric === 56) return "bsc";
  if (numeric === 10) return "optimism";
  if (numeric === 43114) return "avalanche";
  if (numeric === 8453) return "base";
  if (numeric === 143) return "monad";
  if (numeric === 59144) return "linea";
  return "polygon";
}

export function getTradingNetwork(id: string): TradingNetworkConfig {
  return isTradingChainId(id) ? TRADING_NETWORKS[id] : TRADING_NETWORKS.polygon;
}

export function tradingPairsForChain(id: string): TokenPairConfig[] {
  return getTradingNetwork(id).pairs;
}

export interface ActiveNetwork {
  id: TradingChainId;
  name: string;
  shortLabel: string;
  rpcUrl: string;
  nativeSymbol: NativeSymbol;
  chainId: number;
}

export function toActiveNetwork(id: string): ActiveNetwork {
  const net = getTradingNetwork(id);
  return {
    id: net.id,
    name: net.name,
    shortLabel: net.shortLabel,
    rpcUrl: net.rpcUrl,
    nativeSymbol: net.nativeSymbol,
    chainId: net.chainId,
  };
}
