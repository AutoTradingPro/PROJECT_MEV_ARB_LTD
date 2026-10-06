import { Interface, ZeroAddress } from "ethers";
import type { ChainId } from "@/lib/chain/networks";
import { ethCall } from "./rpc";

const FACTORY_IFACE = new Interface([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);
const POOL_IFACE = new Interface(["function liquidity() view returns (uint128)"]);

/** Uniswap V3 factory per rantai (alamat resmi / deployment publik). */
export const UNISWAP_V3_FACTORY: Partial<Record<ChainId, string>> = {
  ethereum: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  polygon: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  arbitrum: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  optimism: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  base: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
  bsc: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7",
  avalanche: "0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD",
  linea: "0x31FAfd4889FA1269F7a13A66eE0fB458f27D72A9",
  monad: "0x204faca1764b154221e35c0d20abb3c525710498",
};

/** Fee tier Uniswap V3 (hundredths of a bip). */
export const UNISWAP_V3_FEE_TIERS = [100, 500, 2500, 3000, 10000] as const;

/** Harga quote per 1 base dari slot0 Uniswap V3. */
export function v3SqrtPriceToQuotePerBase(input: {
  sqrtPriceX96: bigint;
  token0: string;
  base: string;
  quote: string;
  baseDecimals: number;
  quoteDecimals: number;
}): number {
  const token0 = input.token0.toLowerCase();
  const base = input.base.toLowerCase();
  const quote = input.quote.toLowerCase();
  const token0IsBase = token0 === base;
  const dec0 = token0IsBase ? input.baseDecimals : input.quoteDecimals;
  const dec1 = token0IsBase ? input.quoteDecimals : input.baseDecimals;
  const q192 = 2n ** 192n;
  const scaled = (input.sqrtPriceX96 * input.sqrtPriceX96 * 10n ** 18n) / q192;
  const token1PerToken0 = (Number(scaled) / 1e18) * 10 ** (dec0 - dec1);
  if (!Number.isFinite(token1PerToken0) || token1PerToken0 <= 0) return 0;
  if (token0IsBase) return quote === token0 ? 1 / token1PerToken0 : token1PerToken0;
  return quote === token0 ? 1 / token1PerToken0 : token1PerToken0;
}

const cache = new Map<string, { feePct: number; at: number }>();
const CACHE_MS = 20_000;

export function uniswapFeeTierToPct(feeTier: number): number {
  return feeTier / 10_000;
}

function cacheKey(chainId: ChainId, tokenA: string, tokenB: string): string {
  const a = tokenA.toLowerCase();
  const b = tokenB.toLowerCase();
  const [x, y] = a < b ? [a, b] : [b, a];
  return `${chainId}:${x}:${y}`;
}

/**
 * Deteksi fee pool Uniswap V3 dengan likuiditas tertinggi untuk pasangan token.
 * Memakai RPC jaringan `chainId` (failover owner/node bila tersedia).
 */
export async function detectUniswapV3PoolFeePct(input: {
  chainId: ChainId;
  tokenA: string;
  tokenB: string;
}): Promise<number | null> {
  const factory = UNISWAP_V3_FACTORY[input.chainId];
  if (!factory || !input.tokenA || !input.tokenB) return null;

  const key = cacheKey(input.chainId, input.tokenA, input.tokenB);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.feePct;

  let best: { feePct: number; liquidity: bigint } | null = null;
  for (const fee of UNISWAP_V3_FEE_TIERS) {
    try {
      const data = FACTORY_IFACE.encodeFunctionData("getPool", [input.tokenA, input.tokenB, fee]);
      const raw = await ethCall({ to: factory, data }, undefined, input.chainId);
      const [pool] = FACTORY_IFACE.decodeFunctionResult("getPool", raw) as unknown as [string];
      if (!pool || pool.toLowerCase() === ZeroAddress.toLowerCase()) continue;
      const liqData = POOL_IFACE.encodeFunctionData("liquidity", []);
      const liqRaw = await ethCall({ to: pool, data: liqData }, undefined, input.chainId);
      const [liquidity] = POOL_IFACE.decodeFunctionResult("liquidity", liqRaw) as unknown as [bigint];
      if (liquidity <= 0n) continue;
      if (!best || liquidity > best.liquidity) {
        best = { feePct: uniswapFeeTierToPct(fee), liquidity };
      }
    } catch {
      /* pool / RPC tidak tersedia untuk tier ini */
    }
  }

  if (!best) return null;
  cache.set(key, { feePct: best.feePct, at: Date.now() });
  return best.feePct;
}
