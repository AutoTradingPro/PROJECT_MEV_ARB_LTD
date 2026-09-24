import { ETHEREUM_TOKENS } from "@/config/networks";
import type { ChainId } from "@/lib/chain/networks";

function tokenKey(a: string, b: string): string {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? `${x}:${y}` : `${y}:${x}`;
}

/** Factory Curve yang punya `find_pool_for_coins` ( Twocrypto / Stableswap ). */
export function curveFactoriesForChain(chainId: ChainId): string[] {
  if (chainId === "ethereum") {
    return [
      "0xF18056Bbd320E96A24e3C8ab39749789ad795291",
      "0x98EE851a00abeE0d4D8bB0d4C0B745238231809c",
      "0xB9fC157394Af804433589DFFf3607B289C60d18b",
      "0x6A8cbed756804B16c05E04933C3141f0C177A001",
    ];
  }
  if (chainId === "polygon") {
    return [
      "0x1764ee18e8B3ccA4787249Ceb2493564183deE4A",
      "0x722272D36ef0Da72FF51c5A65Db7b870E2e8D4ee",
    ];
  }
  if (chainId === "arbitrum") {
    return [
      "0xbC0797015fcFc47d9C1856639CaE50D0e69FbEE8",
      "0x9AF14D26075f142eb3F292B5066B15c61Ae27889",
    ];
  }
  return [];
}

/** Pool Curve 2+ koin yang sering dipakai pair katalog Ethereum. */
const KNOWN_POOLS: Record<string, Partial<Record<string, string>>> = {
  ethereum: {
    [tokenKey(ETHEREUM_TOKENS.weth, ETHEREUM_TOKENS.usdc)]:
      "0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B",
    [tokenKey(ETHEREUM_TOKENS.weth, ETHEREUM_TOKENS.usdt)]:
      "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46",
    [tokenKey(ETHEREUM_TOKENS.wbtc, ETHEREUM_TOKENS.weth)]:
      "0xD51a44d3FaE010294C616388b506AcdA1bfAAE46",
    [tokenKey(ETHEREUM_TOKENS.usdc, ETHEREUM_TOKENS.dai)]:
      "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
  },
};

export function knownCurvePoolForPair(
  chainId: ChainId,
  tokenA: string,
  tokenB: string
): string | null {
  const id = KNOWN_POOLS[chainId]?.[tokenKey(tokenA, tokenB)];
  return id || null;
}
