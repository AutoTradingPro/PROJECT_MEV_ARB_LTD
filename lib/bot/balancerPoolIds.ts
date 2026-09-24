import { ARBITRUM_TOKENS, ETHEREUM_TOKENS, POLYGON_TOKENS } from "@/config/networks";
import type { ChainId } from "@/lib/chain/networks";

function tokenKey(a: string, b: string): string {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? `${x}:${y}` : `${y}:${x}`;
}

/** Pool Balancer V2 2-token yang dipakai untuk quote spot (getPoolTokens). */
const POOLS: Record<string, Partial<Record<string, string>>> = {
  ethereum: {
    [tokenKey(ETHEREUM_TOKENS.weth, ETHEREUM_TOKENS.usdc)]:
      "0x96646936b91d6b9d7d202f70bd3675f2d1b17a0a000200000000000000000001",
    [tokenKey(ETHEREUM_TOKENS.weth, ETHEREUM_TOKENS.usdt)]:
      "0x3e5fa6795b83d5c8198e85ec4ff3b1621f58c51c000200000000000000000461",
    [tokenKey(ETHEREUM_TOKENS.wbtc, ETHEREUM_TOKENS.weth)]:
      "0xa6f548df93de924d73be7d25dc02554c6bd66db500020000000000000000000e",
    [tokenKey(ETHEREUM_TOKENS.weth, ETHEREUM_TOKENS.dai)]:
      "0x0b09dea16768f0799065c475be02919503cb2a3500020000000000000000001a",
    [tokenKey(ETHEREUM_TOKENS.usdc, ETHEREUM_TOKENS.dai)]:
      "0x79c58f70905f734641735bc289bdfbd89d53924a0000000000000000000003e7",
    [tokenKey(ETHEREUM_TOKENS.link, ETHEREUM_TOKENS.weth)]:
      "0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014",
  },
  polygon: {
    [tokenKey(POLYGON_TOKENS.wmatic, POLYGON_TOKENS.usdc)]:
      "0x0297e37f1873d2dab4487aa67cd56b58e2f27875000100000000000000000002",
    [tokenKey(POLYGON_TOKENS.weth, POLYGON_TOKENS.usdc)]:
      "0x03cd191f589d12b0582a99808cf19851e468e6b500010000000000000000000a",
  },
  arbitrum: {
    [tokenKey(ARBITRUM_TOKENS.weth, ARBITRUM_TOKENS.usdc)]:
      "0x32df62dc3aed9dec56940598f98ac6d7fc9aa4f8000200000000000000000076",
    [tokenKey(ARBITRUM_TOKENS.wbtc, ARBITRUM_TOKENS.weth)]:
      "0xc2f082d33b5b8ef3a7e3de30da54efd3114512ac000200000000000000000017",
  },
};

export function balancerPoolIdForPair(
  chainId: ChainId,
  tokenA: string,
  tokenB: string
): string | null {
  const row = POOLS[chainId];
  if (!row) return null;
  const id = row[tokenKey(tokenA, tokenB)];
  return id || null;
}
