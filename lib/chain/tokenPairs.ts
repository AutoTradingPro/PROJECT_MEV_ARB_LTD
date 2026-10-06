import {
  ARBITRUM_TOKENS,
  BSC_TOKENS,
  COSMOS_LEGACY_PAIRS,
  ETHEREUM_TOKENS,
  POLYGON_TOKENS,
  tradingPairsForChain,
  type TokenPairConfig,
} from "@/config/networks";
import type { ChainId } from "./networks";

export type { TokenPairConfig };

export { BSC_TOKENS, ARBITRUM_TOKENS, POLYGON_TOKENS, ETHEREUM_TOKENS };

export interface OnChainPairTokens {
  pairId: string;
  baseAddress: string;
  quoteAddress: string;
  baseDecimals: number;
  quoteDecimals: number;
}

export function onChainTokensForPair(pair: TokenPairConfig): OnChainPairTokens | null {
  if (!pair.baseAddress || !pair.quoteAddress) return null;
  return {
    pairId: pair.id,
    baseAddress: pair.baseAddress,
    quoteAddress: pair.quoteAddress,
    baseDecimals: pair.baseDecimals ?? 18,
    quoteDecimals: pair.quoteDecimals ?? 18,
  };
}

/** Pair trading dari config terpusat; cosmos legacy tetap untuk kompatibilitas ChainId. */
export const CHAIN_PAIRS: Record<ChainId, TokenPairConfig[]> = {
  bsc: tradingPairsForChain("bsc"),
  arbitrum: tradingPairsForChain("arbitrum"),
  ethereum: tradingPairsForChain("ethereum"),
  polygon: tradingPairsForChain("polygon"),
  base: tradingPairsForChain("base"),
  avalanche: tradingPairsForChain("avalanche"),
  optimism: tradingPairsForChain("optimism"),
  monad: tradingPairsForChain("monad"),
  linea: tradingPairsForChain("linea"),
  cosmos: COSMOS_LEGACY_PAIRS,
  solana: tradingPairsForChain("solana"),
};

export function pairsForChain(chainId: ChainId): TokenPairConfig[] {
  return CHAIN_PAIRS[chainId] ?? CHAIN_PAIRS.bsc;
}

export function getPair(chainId: ChainId, id: string): TokenPairConfig | undefined {
  return pairsForChain(chainId).find((p) => p.id === id);
}

export function defaultPairForChain(chainId: ChainId): TokenPairConfig {
  return pairsForChain(chainId)[0];
}
