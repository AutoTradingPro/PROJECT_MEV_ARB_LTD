import { AbiCoder, id, type Log } from "ethers";

/** Sync(uint112 reserve0, uint112 reserve1) — Uniswap V2 dan fork-nya. */
export const SYNC_TOPIC = id("Sync(uint112,uint112)");

/** Swap Uniswap V3: sqrtPriceX96, liquidity, dan tick ada di data log. */
export const SWAP_V3_TOPIC = id("Swap(address,address,int256,int256,uint160,uint128,int24)");

export const MINT_TOPIC = id("Mint(address,address,int24,int24,uint128,uint256,uint256)");
export const BURN_TOPIC = id("Burn(address,int24,int24,uint128,uint256,uint256)");

const coder = AbiCoder.defaultAbiCoder();

export interface SyncUpdate {
  reserve0: bigint;
  reserve1: bigint;
}

export interface V3SwapUpdate {
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tick: number;
}

export interface V3LiquidityUpdate {
  tickLower: number;
  tickUpper: number;
  liquidityDelta: bigint;
}

function topicInt24(topic: string | undefined): number | null {
  if (!topic) return null;
  const word = BigInt(topic);
  const signed = word >= 1n << 255n ? word - (1n << 256n) : word;
  const tick = Number(signed);
  return Number.isInteger(tick) ? tick : null;
}

export function decodeSyncLog(log: Log): SyncUpdate | null {
  if (log.topics[0] !== SYNC_TOPIC) return null;
  try {
    const decoded = coder.decode(["uint112", "uint112"], log.data) as unknown as [bigint, bigint];
    const reserve0 = decoded[0];
    const reserve1 = decoded[1];
    if (reserve0 <= 0n || reserve1 <= 0n) return null;
    return { reserve0, reserve1 };
  } catch {
    return null;
  }
}

export function decodeV3SwapLog(log: Log): V3SwapUpdate | null {
  if (log.topics[0] !== SWAP_V3_TOPIC) return null;
  try {
    const decoded = coder.decode(
      ["int256", "int256", "uint160", "uint128", "int24"],
      log.data
    ) as unknown as [bigint, bigint, bigint, bigint, bigint];
    const sqrtPriceX96 = decoded[2];
    const liquidity = decoded[3];
    const tick = Number(decoded[4]);
    if (sqrtPriceX96 <= 0n || !Number.isFinite(tick)) return null;
    return { sqrtPriceX96, liquidity: liquidity < 0n ? 0n : liquidity, tick };
  } catch {
    return null;
  }
}

export function decodeMintOrBurn(log: Log): V3LiquidityUpdate | null {
  const topic = log.topics[0];
  const mint = topic === MINT_TOPIC;
  const burn = topic === BURN_TOPIC;
  if (!mint && !burn) return null;
  const tickLower = topicInt24(log.topics[mint ? 2 : 1]);
  const tickUpper = topicInt24(log.topics[mint ? 3 : 2]);
  if (tickLower == null || tickUpper == null) return null;
  try {
    const types = mint
      ? ["address", "uint128", "uint256", "uint256"]
      : ["uint128", "uint256", "uint256"];
    const decoded = coder.decode(types, log.data);
    const amount = BigInt(mint ? decoded[1].toString() : decoded[0].toString());
    if (amount == null || amount <= 0n) return null;
    return { tickLower, tickUpper, liquidityDelta: mint ? amount : -amount };
  } catch {
    return null;
  }
}
