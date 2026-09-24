export type BlockmachineChainId =
  | "arbitrum"
  | "ethereum"
  | "polygon"
  | "bsc"
  | "base"
  | "optimism"
  | "avalanche"
  | "scroll"
  | "mantle"
  | "robinhood"
  | "bittensor";

/** Host resmi Chain guides Blockmachine (HTTP + WSS sama hostname). */
export const BLOCKMACHINE_HTTP: Record<BlockmachineChainId, string> = {
  bittensor: "https://rpc.blockmachine.io",
  ethereum: "https://rpc-eth.blockmachine.io",
  bsc: "https://rpc-bsc.blockmachine.io",
  base: "https://rpc-base.blockmachine.io",
  polygon: "https://rpc-polygon.blockmachine.io",
  optimism: "https://rpc-optimism.blockmachine.io",
  arbitrum: "https://rpc-arbitrum.blockmachine.io",
  avalanche: "https://rpc-avalanche.blockmachine.io",
  scroll: "https://rpc-scroll.blockmachine.io",
  mantle: "https://rpc-mantle.blockmachine.io",
  robinhood: "https://rpc-robinhood.blockmachine.io",
};

export const BLOCKMACHINE_WSS: Record<BlockmachineChainId, string> = {
  bittensor: "wss://rpc.blockmachine.io",
  ethereum: "wss://rpc-eth.blockmachine.io",
  bsc: "wss://rpc-bsc.blockmachine.io",
  base: "wss://rpc-base.blockmachine.io",
  polygon: "wss://rpc-polygon.blockmachine.io",
  optimism: "wss://rpc-optimism.blockmachine.io",
  arbitrum: "wss://rpc-arbitrum.blockmachine.io",
  avalanche: "wss://rpc-avalanche.blockmachine.io",
  scroll: "wss://rpc-scroll.blockmachine.io",
  mantle: "wss://rpc-mantle.blockmachine.io",
  robinhood: "wss://rpc-robinhood.blockmachine.io",
};

const HOST_TO_CHAIN: Record<string, BlockmachineChainId> = {
  "rpc.blockmachine.io": "bittensor",
  "rpc-eth.blockmachine.io": "ethereum",
  "rpc-eth-verified.blockmachine.io": "ethereum",
  "rpc-ethereum.blockmachine.io": "ethereum",
  "rpc-bsc.blockmachine.io": "bsc",
  "rpc-base.blockmachine.io": "base",
  "rpc-polygon.blockmachine.io": "polygon",
  "rpc-optimism.blockmachine.io": "optimism",
  "rpc-arbitrum.blockmachine.io": "arbitrum",
  "rpc-avalanche.blockmachine.io": "avalanche",
  "rpc-scroll.blockmachine.io": "scroll",
  "rpc-mantle.blockmachine.io": "mantle",
  "rpc-robinhood.blockmachine.io": "robinhood",
};

const LEGACY_HOST_TO_OFFICIAL: Record<string, string> = {
  "rpc-ethereum.blockmachine.io": "rpc-eth.blockmachine.io",
};

function envTrim(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function isBlockmachineHost(hostname: string): boolean {
  return hostname.replace(/^www\./, "").toLowerCase().endsWith("blockmachine.io");
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Samakan host lama ke endpoint resmi Chain guides. */
export function canonicalizeBlockmachineUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (!isBlockmachineHost(parsed.hostname)) return trimmed;
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const official = LEGACY_HOST_TO_OFFICIAL[host];
    if (official) parsed.hostname = official;
    parsed.hash = "";
    const href = parsed.toString();
    return href.endsWith("/") && parsed.pathname === "/" ? href.slice(0, -1) : href;
  } catch {
    return trimmed;
  }
}

export function blockmachineChainFromUrl(url: string): BlockmachineChainId | null {
  const canonical = canonicalizeBlockmachineUrl(url) || url;
  const host = hostnameOf(canonical);
  return HOST_TO_CHAIN[host] ?? null;
}

/**
 * Satu kunci mengautentikasi semua endpoint Chain guides (budget RU global).
 * Kunci chain-specific tetap didukung sebagai rotasi per layanan.
 */
function anyBlockmachineKey(): string {
  return envTrim(
    "BLOCKMACHINE_API_KEY",
    "BLOCKMACHINE_API_KEY_ARBITRUM",
    "BLOCKMACHINE_ARB_API_KEY",
    "BLOCKMACHINE_API_KEY_ETHEREUM",
    "BLOCKMACHINE_ETH_API_KEY",
    "BLOCKMACHINE_API_KEY_POLYGON",
    "BLOCKMACHINE_POLYGON_API_KEY",
    "BLOCKMACHINE_API_KEY_OPTIMISM",
    "BLOCKMACHINE_API_KEY_AVALANCHE",
    "BLOCKMACHINE_API_KEY_BSC"
  );
}

export function blockmachineApiKey(chainId?: BlockmachineChainId): string {
  if (chainId === "arbitrum") {
    return envTrim("BLOCKMACHINE_API_KEY_ARBITRUM", "BLOCKMACHINE_ARB_API_KEY") || anyBlockmachineKey();
  }
  if (chainId === "ethereum") {
    return envTrim("BLOCKMACHINE_API_KEY_ETHEREUM", "BLOCKMACHINE_ETH_API_KEY") || anyBlockmachineKey();
  }
  if (chainId === "polygon") {
    return (
      envTrim("BLOCKMACHINE_API_KEY_POLYGON", "BLOCKMACHINE_POLYGON_API_KEY") || anyBlockmachineKey()
    );
  }
  if (chainId === "optimism") {
    return envTrim("BLOCKMACHINE_API_KEY_OPTIMISM", "BLOCKMACHINE_OP_API_KEY") || anyBlockmachineKey();
  }
  if (chainId === "avalanche") {
    return (
      envTrim("BLOCKMACHINE_API_KEY_AVALANCHE", "BLOCKMACHINE_AVAX_API_KEY") || anyBlockmachineKey()
    );
  }
  if (chainId === "bsc") {
    return envTrim("BLOCKMACHINE_API_KEY_BSC") || anyBlockmachineKey();
  }
  return anyBlockmachineKey();
}

function authorizationFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.get("authorization")?.trim() ||
      parsed.searchParams.get("apiKey")?.trim() ||
      ""
    );
  } catch {
    return "";
  }
}

/** Bearer token HTTP — hanya di server. Jangan kirim kunci ke browser. */
export function blockmachineAuthorization(url: string): string {
  const fromQuery = authorizationFromUrl(url);
  if (fromQuery) return fromQuery;
  const chainId = blockmachineChainFromUrl(url);
  if (chainId) return blockmachineApiKey(chainId);
  if (isBlockmachineHost(hostnameOf(url))) return anyBlockmachineKey();
  return "";
}

export function stripBlockmachineHttpQuery(url: string): string {
  try {
    const parsed = new URL(canonicalizeBlockmachineUrl(url) || url);
    if (!isBlockmachineHost(parsed.hostname)) return url;
    parsed.search = "";
    parsed.hash = "";
    const href = parsed.toString();
    return href.endsWith("/") && parsed.pathname === "/" ? href.slice(0, -1) : href;
  } catch {
    return url;
  }
}

/**
 * Auth WSS untuk proses Node (ethers WebSocketProvider tidak kirim header).
 * Jangan pakai hasil fungsi ini di bundle browser / NEXT_PUBLIC_.
 */
export function appendBlockmachineWsAuth(url: string, chainId?: BlockmachineChainId): string {
  const trimmed = canonicalizeBlockmachineUrl(url);
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (!isBlockmachineHost(parsed.hostname)) return trimmed;
    const chain = chainId ?? blockmachineChainFromUrl(trimmed);
    const token =
      parsed.searchParams.get("authorization")?.trim() || blockmachineApiKey(chain ?? undefined);
    if (!token) return trimmed;
    parsed.searchParams.set("authorization", token);
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function jsonRpcAuthHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = blockmachineAuthorization(url);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
