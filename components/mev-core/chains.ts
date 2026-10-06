export interface CoreChain {
  id: string;
  label: string;
  short: string;
  color: string;
  pair: string;
}

/** Sepuluh jaringan yang dipantau MEV Core Engine, urutan tampilan status. */
export const CORE_CHAINS: CoreChain[] = [
  { id: "ethereum", label: "Ethereum", short: "ET", color: "#8C8C8C", pair: "WETH / USDC" },
  { id: "arbitrum", label: "Arbitrum", short: "AR", color: "#12AAFF", pair: "WETH / USDC" },
  { id: "optimism", label: "Optimism", short: "OP", color: "#FF0420", pair: "WETH / USDC" },
  { id: "polygon", label: "Polygon", short: "PO", color: "#8247E5", pair: "WMATIC / USDC" },
  { id: "base", label: "Base", short: "BA", color: "#0052FF", pair: "WETH / USDbC" },
  { id: "bsc", label: "BNB Chain", short: "BN", color: "#F3BA2F", pair: "WBNB / USDT" },
  { id: "avalanche", label: "Avalanche", short: "AV", color: "#E84142", pair: "WETH.e / WAVAX" },
  { id: "monad", label: "Monad", short: "MO", color: "#836EF9", pair: "WMON / USDC · WETH / USDC" },
  { id: "solana", label: "Solana", short: "SO", color: "#14F195", pair: "SOL / USDC" },
  { id: "linea", label: "Linea", short: "LN", color: "#61DFFF", pair: "WETH / USDC" },
];
