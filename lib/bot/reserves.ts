import { Contract, Interface, JsonRpcProvider, ZeroAddress, getAddress } from "ethers";
import { DEX_ROUTES, dexIdsAllowedOnChain } from "./dexRegistry";
import { USDT, WBNB } from "./constants";
import { liveSpotPrice } from "./pricing";
import { UNISWAP_V3_FEE_TIERS, v3SqrtPriceToQuotePerBase } from "./uniswapV3Fee";
import { createJsonRpcProvider, isRpcTransportError, rpcUrl, withRpcFailover } from "./rpc";
import { rpcProviderEpoch } from "@/lib/owner/nodeEndpoints";
import type { DexId } from "./types";
import type { OnChainPairTokens } from "@/lib/chain/tokenPairs";
import { getChain, type ChainId } from "@/lib/chain/networks";
import { BALANCER_V2_VAULT } from "@/config/networks";
import { balancerPoolIdForPair } from "./balancerPoolIds";
import { denyForeignProviderChain, onScanRuntimeReset, ScanRuntimeAbortError } from "./scanRuntime";
import { isScanRpcAllowed } from "@/lib/owner/chainQuota";
import { curveFactoriesForChain, knownCurvePoolForPair } from "./curvePoolIds";

const FACTORY_IFACE = new Interface([
  "function getPair(address tokenA, address tokenB) view returns (address)",
]);
const PAIR_IFACE = new Interface([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
]);
const CAMELOT_PAIR_IFACE = new Interface([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint16 token0FeePercent, uint16 token1FeePercent)",
]);
const ERC20_IFACE = new Interface([
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
]);
const V3_FACTORY_IFACE = new Interface([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);
const V3_POOL_IFACE = new Interface([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function fee() view returns (uint24)",
  "function token0() view returns (address)",
]);
const ALGEBRA_FACTORY_IFACE = new Interface([
  "function poolByPair(address tokenA, address tokenB) view returns (address pool)",
]);
const ALGEBRA_POOL_IFACE = new Interface([
  "function globalState() view returns (uint160 price, int24 tick, uint16 lastFee, uint8 pluginConfig, uint16 communityFee, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function token0() view returns (address)",
]);
const BALANCER_VAULT_IFACE = new Interface([
  "function getPoolTokens(bytes32 poolId) view returns (address[] tokens, uint256[] balances, uint256 lastChangeBlock)",
]);
const CURVE_FACTORY_IFACE = new Interface([
  "function find_pool_for_coins(address from, address to) view returns (address)",
]);
const CURVE_POOL_IFACE = new Interface([
  "function coins(uint256 i) view returns (address)",
  "function get_dy(uint256 i, uint256 j, uint256 dx) view returns (uint256)",
  "function balances(uint256 i) view returns (uint256)",
]);
const CURVE_POOL_I128_IFACE = new Interface([
  "function coins(int128 i) view returns (address)",
  "function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)",
  "function balances(int128 i) view returns (uint256)",
]);
const CURVE_FACTORY_INDEX_IFACE = new Interface([
  "function find_pool_for_coins(address from, address to, uint256 i) view returns (address)",
]);
const SOLIDLY_FACTORY_IFACE = new Interface([
  "function getPool(address tokenA, address tokenB, bool stable) view returns (address)",
]);

/** Multicall3 — sama di BSC dan rantai EVM lain. */
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL_IFACE = new Interface([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
]);

export interface LivePool {
  pair: string;
  reserveBase: bigint;
  reserveQuote: bigint;
  feeBps: bigint;
  token0: string;
  quoteIsToken0: boolean;
  baseDecimals: number;
  quoteDecimals: number;
  /** Harga spot quote/base dari slot0 / cadangan, tanpa round-trip wei. */
  spotPrice?: number;
  liquidity?: bigint;
  /** false = cadangan sintetis (balanceOf gagal) — jangan pakai untuk filter TVL USD. */
  tvlReliable?: boolean;
  /** Fee Uniswap V3 (uint24), hanya terisi untuk pool V3. */
  v3Fee?: number;
  /** Q64.96 dari slot0. Dipakai quote SwapMath lokal. */
  sqrtPriceX96?: bigint;
  tick?: number;
  v3Quote?: import("@/scanner/v3/swap").V3QuotePool;
}

/** @deprecated gunakan reserveBase / reserveQuote */
export type LivePoolLegacy = LivePool & {
  reserveWbnb: bigint;
  reserveUsdt: bigint;
};

export function poolKey(pairId: string, dexId: DexId): string {
  return `${pairId}:${dexId}`;
}

let provider: JsonRpcProvider | null = null;
let providerUrl = "";
let providerEpoch = -1;

function getProvider(url = rpcUrl(), networkId = 56): JsonRpcProvider | null {
  if (!url) return null;
  const epoch = rpcProviderEpoch();
  const key = `${url}:${networkId}:${epoch}`;
  if (!provider || providerUrl !== key) {
    if (provider) {
      try {
        const result = provider.destroy() as void | Promise<void>;
        if (result && typeof result.catch === "function") void result.catch(() => undefined);
      } catch {
        /* ignore */
      }
    }
    provider = createJsonRpcProvider(url, networkId);
    providerUrl = key;
    providerEpoch = epoch;
  }
  return provider;
}

export function resetDexRpcProvider(): void {
  if (provider) {
    try {
      const result = provider.destroy() as void | Promise<void>;
      if (result && typeof result.catch === "function") void result.catch(() => undefined);
    } catch {
      /* ignore */
    }
  }
  provider = null;
  providerUrl = "";
  providerEpoch = -1;
}

onScanRuntimeReset(resetDexRpcProvider);

function checksum(value: string): string {
  try {
    return getAddress(value.toLowerCase());
  } catch {
    return value.toLowerCase();
  }
}

function v2Token0(tokenA: string, tokenB: string): string {
  const a = tokenA.toLowerCase();
  const b = tokenB.toLowerCase();
  return a < b ? a : b;
}

type Call3 = { target: string; allowFailure: boolean; callData: string };

async function aggregate3(client: JsonRpcProvider, calls: Call3[]): Promise<{ success: boolean; returnData: string }[]> {
  if (calls.length === 0) return [];
  const multicall = new Contract(MULTICALL3, MULTICALL_IFACE, client);
  const raw = (await multicall.aggregate3.staticCall(calls)) as { success: boolean; returnData: string }[];
  return raw;
}

function decodePairAddress(data: string): string | null {
  try {
    const decoded = FACTORY_IFACE.decodeFunctionResult("getPair", data);
    const addr = String(decoded[0]);
    if (!addr || addr === ZeroAddress) return null;
    return checksum(addr);
  } catch {
    return null;
  }
}

function decodeReserves(data: string): { reserve0: bigint; reserve1: bigint; feeBps?: bigint } | null {
  const fromWords = (): { reserve0: bigint; reserve1: bigint; feeBps?: bigint } | null => {
    const hex = data.startsWith("0x") ? data.slice(2) : data;
    if (hex.length < 128) return null;
    const reserve0 = BigInt(`0x${hex.slice(0, 64)}`);
    const reserve1 = BigInt(`0x${hex.slice(64, 128)}`);
    if (reserve0 <= 0n || reserve1 <= 0n) return null;
    let feeBps: bigint | undefined;
    if (hex.length >= 256) {
      const fee0 = Number(BigInt(`0x${hex.slice(128, 192)}`));
      const fee1 = Number(BigInt(`0x${hex.slice(192, 256)}`));
      const pct = Math.max(fee0, fee1);
      if (Number.isFinite(pct) && pct > 0) {
        feeBps = BigInt(Math.max(1, Math.round(pct / 10)));
      }
    }
    return { reserve0, reserve1, feeBps };
  };
  try {
    const decoded = PAIR_IFACE.decodeFunctionResult("getReserves", data);
    const reserve0 = BigInt(decoded[0]);
    const reserve1 = BigInt(decoded[1]);
    if (reserve0 > 0n && reserve1 > 0n) return { reserve0, reserve1 };
  } catch {
    /* Camelot / ABI lain */
  }
  try {
    const decoded = CAMELOT_PAIR_IFACE.decodeFunctionResult("getReserves", data);
    const reserve0 = BigInt(decoded[0]);
    const reserve1 = BigInt(decoded[1]);
    const fee0 = Number(decoded[2]);
    const fee1 = Number(decoded[3]);
    const pct = Math.max(fee0, fee1);
    const feeBps =
      Number.isFinite(pct) && pct > 0 ? BigInt(Math.max(1, Math.round(pct / 10))) : undefined;
    if (reserve0 > 0n && reserve1 > 0n) return { reserve0, reserve1, feeBps };
  } catch {
    /* raw words */
  }
  return fromWords();
}

function decodeDecimals(data: string, fallback: number): number {
  try {
    const decoded = ERC20_IFACE.decodeFunctionResult("decimals", data);
    const value = Number(decoded[0]);
    if (!Number.isInteger(value) || value < 0 || value > 36) return fallback;
    return value;
  } catch {
    return fallback;
  }
}

async function fetchTokenDecimals(
  client: JsonRpcProvider,
  tokens: { address: string; fallback: number }[]
): Promise<Map<string, number>> {
  const unique = new Map<string, number>();
  for (const token of tokens) {
    const key = token.address.toLowerCase();
    if (!unique.has(key)) unique.set(key, token.fallback);
  }
  const addresses = [...unique.keys()];
  try {
    const calls: Call3[] = addresses.map((address) => ({
      target: checksum(address),
      allowFailure: true,
      callData: ERC20_IFACE.encodeFunctionData("decimals", []),
    }));
    const results = await aggregate3(client, calls);
    results.forEach((item, index) => {
      const key = addresses[index];
      const fallback = unique.get(key) ?? 18;
      unique.set(key, item.success ? decodeDecimals(item.returnData, fallback) : fallback);
    });
  } catch {
    /* pakai fallback konfigurasi */
  }
  return unique;
}

export async function fetchDexPoolsBatch(
  dexIds: DexId[],
  pairs: OnChainPairTokens[],
  chainId: ChainId = "bsc"
): Promise<Map<string, LivePool>> {
  const result = new Map<string, LivePool>();
  denyForeignProviderChain(chainId);
  if (!isScanRpcAllowed(chainId)) {
    throw new ScanRuntimeAbortError(`quota/strict: drop RPC ${chainId}`);
  }
  const allowed = dexIdsAllowedOnChain(chainId);
  const scopedDex = dexIds.filter((id) => allowed.has(id));
  if (!rpcUrl(chainId) || scopedDex.length === 0 || pairs.length === 0) return result;
  const networkId = getChain(chainId).chainId ?? 56;
  try {
    return await withRpcFailover(chainId, async (url) => {
      const client = getProvider(url, networkId);
      if (!client) throw new Error("RPC provider kosong.");
      return loadDexPools(client, scopedDex, pairs, chainId);
    });
  } catch (error) {
    if (error instanceof ScanRuntimeAbortError) throw error;
    return result;
  }
}

type PoolJob = {
  pairId: string;
  dexId: DexId;
  factory: string;
  feeBps: bigint;
  base: string;
  quote: string;
  baseDecimals: number;
  quoteDecimals: number;
};

function poolLiquidityHint(pool: LivePool): bigint {
  const reserves = pool.reserveBase + pool.reserveQuote;
  if (pool.tvlReliable === false) return reserves / 1_000_000_000n;
  return reserves;
}

function mergeLivePool(target: Map<string, LivePool>, key: string, next: LivePool): void {
  const current = target.get(key);
  if (!current || poolLiquidityHint(next) > poolLiquidityHint(current)) {
    target.set(key, next);
  }
}

function decodeAddress(data: string, iface: Interface, fn: string): string | null {
  try {
    const decoded = iface.decodeFunctionResult(fn, data);
    const addr = String(decoded[0]);
    if (!addr || addr === ZeroAddress) return null;
    return checksum(addr);
  } catch {
    return null;
  }
}

function decodeUint(data: string, iface: Interface, fn: string): bigint | null {
  try {
    const decoded = iface.decodeFunctionResult(fn, data);
    const value = BigInt(decoded[0]);
    return value >= 0n ? value : null;
  } catch {
    return null;
  }
}

function decodeSlot0(data: string): { sqrtPriceX96: bigint; tick: number } | null {
  try {
    const decoded = V3_POOL_IFACE.decodeFunctionResult("slot0", data);
    const sqrtPriceX96 = BigInt(decoded[0]);
    const tick = Number(decoded[1]);
    if (sqrtPriceX96 <= 0n || !Number.isInteger(tick)) return null;
    return { sqrtPriceX96, tick };
  } catch {
    return null;
  }
}

function reservesFromSpotPrice(
  price: number,
  baseDecimals: number,
  quoteDecimals: number,
  baseBal: bigint,
  quoteBal: bigint
): { reserveBase: bigint; reserveQuote: bigint; reliable: boolean } | null {
  const hasBase = baseBal > 0n;
  const hasQuote = quoteBal > 0n;
  if (hasBase && hasQuote) return { reserveBase: baseBal, reserveQuote: quoteBal, reliable: true };
  if (Number.isFinite(price) && price > 0) {
    const scale = 1_000_000_000_000n;
    const scaledPrice = BigInt(Math.max(1, Math.round(price * 1e12)));
    const quoteScale = 10n ** BigInt(Math.max(0, quoteDecimals));
    const baseScale = 10n ** BigInt(Math.max(0, baseDecimals));
    if (hasBase) {
      const reserveQuote = (baseBal * scaledPrice * quoteScale) / (baseScale * scale);
      if (reserveQuote > 0n) return { reserveBase: baseBal, reserveQuote, reliable: true };
    }
    if (hasQuote) {
      const reserveBase = (quoteBal * baseScale * scale) / (scaledPrice * quoteScale);
      if (reserveBase > 0n) return { reserveBase, reserveQuote: quoteBal, reliable: true };
    }
    const reserveBase = 10n ** BigInt(Math.max(0, Math.min(18, baseDecimals)));
    const reserveQuote = (reserveBase * scaledPrice * quoteScale) / (baseScale * scale);
    if (reserveQuote > 0n) return { reserveBase, reserveQuote, reliable: false };
  }
  return null;
}

async function loadDexPools(
  client: JsonRpcProvider,
  dexIds: DexId[],
  pairs: OnChainPairTokens[],
  chainId: ChainId
): Promise<Map<string, LivePool>> {
  const result = new Map<string, LivePool>();
  const v2Jobs: PoolJob[] = [];
  const v3Jobs: PoolJob[] = [];
  const algebraJobs: PoolJob[] = [];
  const curveJobs: PoolJob[] = [];
  const balancerJobs: PoolJob[] = [];
  const solidlyJobs: PoolJob[] = [];

  for (const dexId of dexIds) {
    const meta = DEX_ROUTES.find((item) => item.id === dexId);
    if (!meta || meta.kind === "cosmos" || meta.kind === "solana" || !meta.factory) continue;
    for (const pair of pairs) {
      const job: PoolJob = {
        pairId: pair.pairId,
        dexId,
        factory: checksum(meta.factory),
        feeBps: BigInt(meta.feeBps),
        base: checksum(pair.baseAddress),
        quote: checksum(pair.quoteAddress),
        baseDecimals: pair.baseDecimals,
        quoteDecimals: pair.quoteDecimals,
      };
      if (meta.kind === "curve") {
        curveJobs.push(job);
        continue;
      }
      if (meta.kind === "vault") {
        balancerJobs.push(job);
        continue;
      }
      if (meta.kind === "solidly") {
        solidlyJobs.push(job);
        continue;
      }
      if (meta.kind === "v3") v3Jobs.push(job);
      else v2Jobs.push(job);
      if (meta.v3Factory) {
        v3Jobs.push({ ...job, factory: checksum(meta.v3Factory) });
      }
      if (meta.algebraFactory) {
        algebraJobs.push({ ...job, factory: checksum(meta.algebraFactory) });
      }
    }
  }

  const decimalsByToken = await fetchTokenDecimals(
    client,
    pairs.flatMap((pair) => [
      { address: pair.baseAddress, fallback: pair.baseDecimals },
      { address: pair.quoteAddress, fallback: pair.quoteDecimals },
    ])
  );

  if (v2Jobs.length > 0) {
    const v2 = await loadV2DexPools(client, v2Jobs, decimalsByToken);
    for (const [key, pool] of v2) mergeLivePool(result, key, pool);
  }
  if (v3Jobs.length > 0) {
    const v3 = await loadV3DexPools(client, v3Jobs, decimalsByToken);
    for (const [key, pool] of v3) mergeLivePool(result, key, pool);
  }
  if (algebraJobs.length > 0) {
    const algebra = await loadAlgebraDexPools(client, algebraJobs, decimalsByToken);
    for (const [key, pool] of algebra) mergeLivePool(result, key, pool);
  }
  if (solidlyJobs.length > 0) {
    const solidly = await loadSolidlyDexPools(client, solidlyJobs, decimalsByToken);
    for (const [key, pool] of solidly) mergeLivePool(result, key, pool);
  }
  if (curveJobs.length > 0) {
    const curve = await loadCurveDexPools(client, curveJobs, decimalsByToken, chainId);
    for (const [key, pool] of curve) mergeLivePool(result, key, pool);
  }
  if (balancerJobs.length > 0) {
    const balancer = await loadBalancerDexPools(client, balancerJobs, decimalsByToken, chainId);
    for (const [key, pool] of balancer) mergeLivePool(result, key, pool);
  }
  return result;
}

function livePoolFromSpot(
  job: PoolJob,
  pool: string,
  price: number,
  baseBal: bigint,
  quoteBal: bigint,
  decimalsByToken: Map<string, number>
): LivePool | null {
  const baseDecimals = decimalsByToken.get(job.base.toLowerCase()) ?? job.baseDecimals;
  const quoteDecimals = decimalsByToken.get(job.quote.toLowerCase()) ?? job.quoteDecimals;
  const reserves = reservesFromSpotPrice(price, baseDecimals, quoteDecimals, baseBal, quoteBal);
  if (!reserves) return null;
  return {
    pair: pool,
    reserveBase: reserves.reserveBase,
    reserveQuote: reserves.reserveQuote,
    feeBps: job.feeBps,
    token0: job.base,
    quoteIsToken0: false,
    baseDecimals,
    quoteDecimals,
    spotPrice: price,
    tvlReliable: reserves.reliable,
  };
}

async function readCurveCoin(
  poolUint: Contract,
  poolInt: Contract,
  index: number
): Promise<string | null> {
  try {
    return checksum(String(await poolUint.coins.staticCall(BigInt(index))));
  } catch {
    try {
      return checksum(String(await poolInt.coins.staticCall(BigInt(index))));
    } catch {
      return null;
    }
  }
}

async function findCurvePoolAddress(
  client: JsonRpcProvider,
  job: PoolJob,
  chainId: ChainId
): Promise<string | null> {
  const known = knownCurvePoolForPair(chainId, job.base, job.quote);
  if (known) return checksum(known);
  const factories = [...new Set([job.factory, ...curveFactoriesForChain(chainId)].map((item) => checksum(item)))];
  for (const factoryAddr of factories) {
    try {
      const factory = new Contract(factoryAddr, CURVE_FACTORY_IFACE, client);
      let pool = String(await factory.find_pool_for_coins.staticCall(job.quote, job.base));
      if (!pool || pool === ZeroAddress) {
        pool = String(await factory.find_pool_for_coins.staticCall(job.base, job.quote));
      }
      if (pool && pool !== ZeroAddress) return checksum(pool);
    } catch {
      /* factory ABI tidak cocok */
    }
    try {
      const indexed = new Contract(factoryAddr, CURVE_FACTORY_INDEX_IFACE, client);
      const pool = String(await indexed.find_pool_for_coins.staticCall(job.quote, job.base, 0n));
      if (pool && pool !== ZeroAddress) return checksum(pool);
    } catch {
      /* skip */
    }
  }
  return null;
}

async function loadCurveDexPools(
  client: JsonRpcProvider,
  jobs: PoolJob[],
  decimalsByToken: Map<string, number>,
  chainId: ChainId
): Promise<Map<string, LivePool>> {
  const result = new Map<string, LivePool>();
  for (const job of jobs) {
    try {
      const poolAddr = await findCurvePoolAddress(client, job, chainId);
      if (!poolAddr) continue;
      const curve = new Contract(poolAddr, CURVE_POOL_IFACE, client);
      const curveI128 = new Contract(poolAddr, CURVE_POOL_I128_IFACE, client);
      const coins: string[] = [];
      for (let index = 0; index < 8; index++) {
        const coin = await readCurveCoin(curve, curveI128, index);
        if (!coin) break;
        coins.push(coin.toLowerCase());
      }
      const quote = job.quote.toLowerCase();
      const base = job.base.toLowerCase();
      const i = coins.indexOf(quote);
      const j = coins.indexOf(base);
      if (i < 0 || j < 0 || i === j) continue;
      const quoteDecimals = decimalsByToken.get(quote) ?? job.quoteDecimals;
      const dx = 10n ** BigInt(Math.max(0, Math.min(18, quoteDecimals)));
      let dy = 0n;
      try {
        dy = BigInt(await curve.get_dy.staticCall(BigInt(i), BigInt(j), dx));
      } catch {
        dy = BigInt(await curveI128.get_dy.staticCall(BigInt(i), BigInt(j), dx));
      }
      if (dy <= 0n) continue;
      const baseDecimals = decimalsByToken.get(base) ?? job.baseDecimals;
      const price = Number(dx) / 10 ** quoteDecimals / (Number(dy) / 10 ** baseDecimals);
      if (!Number.isFinite(price) || price <= 0) continue;
      let quoteBal = 0n;
      let baseBal = 0n;
      try {
        quoteBal = BigInt(await curve.balances.staticCall(BigInt(i)));
        baseBal = BigInt(await curve.balances.staticCall(BigInt(j)));
      } catch {
        try {
          quoteBal = BigInt(await curveI128.balances.staticCall(BigInt(i)));
          baseBal = BigInt(await curveI128.balances.staticCall(BigInt(j)));
        } catch {
          /* optional */
        }
      }
      const live = livePoolFromSpot(job, poolAddr, price, baseBal, quoteBal, decimalsByToken);
      if (live) result.set(poolKey(job.pairId, job.dexId), live);
    } catch {
      /* pair tidak ada di Curve */
    }
  }
  return result;
}

async function loadBalancerDexPools(
  client: JsonRpcProvider,
  jobs: PoolJob[],
  decimalsByToken: Map<string, number>,
  chainId: ChainId
): Promise<Map<string, LivePool>> {
  const result = new Map<string, LivePool>();
  const vault = new Contract(BALANCER_V2_VAULT, BALANCER_VAULT_IFACE, client);
  for (const job of jobs) {
    const poolId = balancerPoolIdForPair(chainId, job.base, job.quote);
    if (!poolId) continue;
    try {
      const raw = await vault.getPoolTokens.staticCall(poolId);
      const tokenList = (raw.tokens ?? raw[0]) as string[];
      const balanceList = (raw.balances ?? raw[1]) as bigint[];
      const tokens = tokenList.map((item) => String(item).toLowerCase());
      const quoteIndex = tokens.indexOf(job.quote.toLowerCase());
      const baseIndex = tokens.indexOf(job.base.toLowerCase());
      if (quoteIndex < 0 || baseIndex < 0) continue;
      const quoteBal = BigInt(balanceList[quoteIndex] ?? 0n);
      const baseBal = BigInt(balanceList[baseIndex] ?? 0n);
      if (quoteBal <= 0n || baseBal <= 0n) continue;
      const quoteDecimals = decimalsByToken.get(job.quote.toLowerCase()) ?? job.quoteDecimals;
      const baseDecimals = decimalsByToken.get(job.base.toLowerCase()) ?? job.baseDecimals;
      const price =
        Number(quoteBal) / 10 ** quoteDecimals / (Number(baseBal) / 10 ** baseDecimals);
      if (!Number.isFinite(price) || price <= 0) continue;
      const live = livePoolFromSpot(job, poolId, price, baseBal, quoteBal, decimalsByToken);
      if (live) result.set(poolKey(job.pairId, job.dexId), live);
    } catch {
      /* pool id tidak valid di rantai ini */
    }
  }
  return result;
}

async function loadSolidlyDexPools(
  client: JsonRpcProvider,
  jobs: PoolJob[],
  decimalsByToken: Map<string, number>
): Promise<Map<string, LivePool>> {
  const result = new Map<string, LivePool>();
  if (jobs.length === 0) return result;

  const decodePool = (data: string): string | null => decodeAddress(data, SOLIDLY_FACTORY_IFACE, "getPool");

  let pairAddresses: (string | null)[];
  try {
    const calls: Call3[] = jobs.flatMap((job) => [
      {
        target: job.factory,
        allowFailure: true,
        callData: SOLIDLY_FACTORY_IFACE.encodeFunctionData("getPool", [job.base, job.quote, false]),
      },
      {
        target: job.factory,
        allowFailure: true,
        callData: SOLIDLY_FACTORY_IFACE.encodeFunctionData("getPool", [job.base, job.quote, true]),
      },
    ]);
    const raw = await aggregate3(client, calls);
    pairAddresses = jobs.map((_, index) => {
      const volatile = raw[index * 2];
      const stable = raw[index * 2 + 1];
      const volAddr = volatile?.success ? decodePool(volatile.returnData) : null;
      if (volAddr) return volAddr;
      return stable?.success ? decodePool(stable.returnData) : null;
    });
  } catch (error) {
    if (isRpcTransportError(error)) throw error;
    pairAddresses = await Promise.all(
      jobs.map(async (job) => {
        try {
          const factory = new Contract(job.factory, SOLIDLY_FACTORY_IFACE, client);
          let addr = String(await factory.getPool(job.base, job.quote, false));
          if (!addr || addr === ZeroAddress) {
            addr = String(await factory.getPool(job.base, job.quote, true));
          }
          if (!addr || addr === ZeroAddress) return null;
          return checksum(addr);
        } catch {
          return null;
        }
      })
    );
  }

  const reserveJobs = jobs
    .map((job, index) => ({ job, pair: pairAddresses[index] }))
    .filter((item): item is { job: PoolJob; pair: string } => Boolean(item.pair));
  if (reserveJobs.length === 0) return result;

  let reserves: ({ reserve0: bigint; reserve1: bigint; feeBps?: bigint } | null)[];
  try {
    const reserveCalls: Call3[] = reserveJobs.map((item) => ({
      target: item.pair,
      allowFailure: true,
      callData: PAIR_IFACE.encodeFunctionData("getReserves", []),
    }));
    const reserveResults = await aggregate3(client, reserveCalls);
    reserves = reserveResults.map((item) => (item.success ? decodeReserves(item.returnData) : null));
  } catch (error) {
    if (isRpcTransportError(error)) throw error;
    reserves = await Promise.all(
      reserveJobs.map(async (item) => {
        try {
          const pairContract = new Contract(item.pair, PAIR_IFACE, client);
          const raw = await pairContract.getReserves();
          const reserve0 = BigInt(raw[0]);
          const reserve1 = BigInt(raw[1]);
          if (reserve0 <= 0n || reserve1 <= 0n) return null;
          return { reserve0, reserve1 };
        } catch {
          return null;
        }
      })
    );
  }

  reserveJobs.forEach((item, index) => {
    const decoded = reserves[index];
    if (!decoded) return;
    const token0 = v2Token0(item.job.base, item.job.quote);
    const quoteIsToken0 = item.job.quote.toLowerCase() === token0;
    const reserveQuote = quoteIsToken0 ? decoded.reserve0 : decoded.reserve1;
    const reserveBase = quoteIsToken0 ? decoded.reserve1 : decoded.reserve0;
    if (reserveBase <= 0n || reserveQuote <= 0n) return;
    const baseDecimals = decimalsByToken.get(item.job.base.toLowerCase()) ?? item.job.baseDecimals;
    const quoteDecimals = decimalsByToken.get(item.job.quote.toLowerCase()) ?? item.job.quoteDecimals;
    result.set(poolKey(item.job.pairId, item.job.dexId), {
      pair: item.pair,
      reserveBase,
      reserveQuote,
      feeBps: decoded.feeBps ?? item.job.feeBps,
      token0,
      quoteIsToken0,
      baseDecimals,
      quoteDecimals,
      tvlReliable: true,
    });
  });
  return result;
}

async function loadV2DexPools(
  client: JsonRpcProvider,
  jobs: PoolJob[],
  decimalsByToken: Map<string, number>
): Promise<Map<string, LivePool>> {
  const result = new Map<string, LivePool>();
  if (jobs.length === 0) return result;

  let pairAddresses: (string | null)[];
  try {
    const getPairCalls: Call3[] = jobs.map((job) => ({
      target: job.factory,
      allowFailure: true,
      callData: FACTORY_IFACE.encodeFunctionData("getPair", [job.base, job.quote]),
    }));
    const pairResults = await aggregate3(client, getPairCalls);
    pairAddresses = pairResults.map((item) => (item.success ? decodePairAddress(item.returnData) : null));
  } catch (error) {
    if (isRpcTransportError(error)) throw error;
    pairAddresses = await Promise.all(
      jobs.map(async (job) => {
        try {
          const factory = new Contract(job.factory, FACTORY_IFACE, client);
          const addr = (await factory.getPair(job.base, job.quote)) as string;
          if (!addr || addr === ZeroAddress) return null;
          return checksum(addr);
        } catch {
          return null;
        }
      })
    );
  }

  const reserveJobs = jobs
    .map((job, index) => ({ job, pair: pairAddresses[index] }))
    .filter((item): item is { job: PoolJob; pair: string } => Boolean(item.pair));

  if (reserveJobs.length === 0) return result;

  let reserves: ({ reserve0: bigint; reserve1: bigint; feeBps?: bigint } | null)[];
  try {
    const reserveCalls: Call3[] = reserveJobs.map((item) => ({
      target: item.pair,
      allowFailure: true,
      callData: CAMELOT_PAIR_IFACE.encodeFunctionData("getReserves", []),
    }));
    const reserveResults = await aggregate3(client, reserveCalls);
    reserves = reserveResults.map((item) => (item.success ? decodeReserves(item.returnData) : null));
  } catch (error) {
    if (isRpcTransportError(error)) throw error;
    reserves = await Promise.all(
      reserveJobs.map(async (item) => {
        try {
          const pairContract = new Contract(item.pair, CAMELOT_PAIR_IFACE, client);
          const raw = await pairContract.getReserves();
          const reserve0 = BigInt(raw[0]);
          const reserve1 = BigInt(raw[1]);
          if (reserve0 <= 0n || reserve1 <= 0n) return null;
          const fee0 = Number(raw[2] ?? 0);
          const fee1 = Number(raw[3] ?? 0);
          const pct = Math.max(fee0, fee1);
          const feeBps =
            Number.isFinite(pct) && pct > 10 ? BigInt(Math.max(1, Math.round(pct / 10))) : undefined;
          return { reserve0, reserve1, feeBps };
        } catch {
          try {
            const pairContract = new Contract(item.pair, PAIR_IFACE, client);
            const [reserve0, reserve1] = (await pairContract.getReserves()) as [bigint, bigint, number];
            if (reserve0 <= 0n || reserve1 <= 0n) return null;
            return { reserve0, reserve1 };
          } catch {
            return null;
          }
        }
      })
    );
  }

  for (let i = 0; i < reserveJobs.length; i++) {
    const decoded = reserves[i];
    if (!decoded) continue;
    const { job, pair } = reserveJobs[i];
    const token0 = v2Token0(job.base, job.quote);
    const quoteIsToken0 = job.quote.toLowerCase() === token0;
    const reserveQuote = quoteIsToken0 ? decoded.reserve0 : decoded.reserve1;
    const reserveBase = quoteIsToken0 ? decoded.reserve1 : decoded.reserve0;
    if (reserveBase <= 0n || reserveQuote <= 0n) continue;
    const baseDecimals = decimalsByToken.get(job.base.toLowerCase()) ?? job.baseDecimals;
    const quoteDecimals = decimalsByToken.get(job.quote.toLowerCase()) ?? job.quoteDecimals;
    const spotPrice = liveSpotPrice({
      reserveQuote,
      reserveBase,
      quoteDecimals,
      baseDecimals,
    });
    if (spotPrice <= 0) continue;

    result.set(poolKey(job.pairId, job.dexId), {
      pair,
      reserveBase,
      reserveQuote,
      feeBps: decoded.feeBps && decoded.feeBps > 0n ? decoded.feeBps : job.feeBps,
      token0,
      quoteIsToken0,
      baseDecimals,
      quoteDecimals,
      spotPrice,
      liquidity: reserveBase + reserveQuote,
      tvlReliable: true,
    });
  }

  return result;
}

async function loadV3DexPools(
  client: JsonRpcProvider,
  jobs: PoolJob[],
  decimalsByToken: Map<string, number>
): Promise<Map<string, LivePool>> {
  const result = new Map<string, LivePool>();
  if (jobs.length === 0) return result;

  const poolLookups = jobs.flatMap((job) =>
    UNISWAP_V3_FEE_TIERS.map((fee) => ({
      job,
      fee,
      call: {
        target: job.factory,
        allowFailure: true,
        callData: V3_FACTORY_IFACE.encodeFunctionData("getPool", [job.base, job.quote, fee]),
      } satisfies Call3,
    }))
  );

  let poolAddrs: (string | null)[];
  try {
    const rows = await aggregate3(
      client,
      poolLookups.map((item) => item.call)
    );
    poolAddrs = rows.map((item) => (item.success ? decodeAddress(item.returnData, V3_FACTORY_IFACE, "getPool") : null));
  } catch (error) {
    if (isRpcTransportError(error)) throw error;
    poolAddrs = await Promise.all(
      poolLookups.map(async (item) => {
        try {
          const factory = new Contract(item.job.factory, V3_FACTORY_IFACE, client);
          const addr = (await factory.getPool(item.job.base, item.job.quote, item.fee)) as string;
          if (!addr || addr === ZeroAddress) return null;
          return checksum(addr);
        } catch {
          return null;
        }
      })
    );
  }

  const found = poolLookups
    .map((item, index) => ({ ...item, pool: poolAddrs[index] }))
    .filter((item): item is typeof item & { pool: string } => Boolean(item.pool));

  if (found.length === 0) return result;

  let liquidities: (bigint | null)[];
  try {
    const rows = await aggregate3(
      client,
      found.map((item) => ({
        target: item.pool,
        allowFailure: true,
        callData: V3_POOL_IFACE.encodeFunctionData("liquidity", []),
      }))
    );
    liquidities = rows.map((item) => (item.success ? decodeUint(item.returnData, V3_POOL_IFACE, "liquidity") : null));
  } catch (error) {
    if (isRpcTransportError(error)) throw error;
    liquidities = await Promise.all(
      found.map(async (item) => {
        try {
          const pool = new Contract(item.pool, V3_POOL_IFACE, client);
          return BigInt(await pool.liquidity());
        } catch {
          return null;
        }
      })
    );
  }

  const bestByJob = new Map<string, { job: PoolJob; pool: string; fee: number; liquidity: bigint }>();
  found.forEach((item, index) => {
    const liquidity = liquidities[index];
    if (liquidity == null || liquidity <= 0n) return;
    const key = poolKey(item.job.pairId, item.job.dexId);
    const current = bestByJob.get(key);
    if (!current || liquidity > current.liquidity) {
      bestByJob.set(key, { job: item.job, pool: item.pool, fee: item.fee, liquidity });
    }
  });

  const best = [...bestByJob.values()];
  if (best.length === 0) return result;

  let slot0s: ({ sqrtPriceX96: bigint; tick: number } | null)[];
  let fees: (bigint | null)[];
  let token0s: (string | null)[];
  let baseBals: (bigint | null)[];
  let quoteBals: (bigint | null)[];
  try {
    const rows = await aggregate3(client, [
      ...best.map((item) => ({
        target: item.pool,
        allowFailure: true,
        callData: V3_POOL_IFACE.encodeFunctionData("slot0", []),
      })),
      ...best.map((item) => ({
        target: item.pool,
        allowFailure: true,
        callData: V3_POOL_IFACE.encodeFunctionData("fee", []),
      })),
      ...best.map((item) => ({
        target: item.pool,
        allowFailure: true,
        callData: V3_POOL_IFACE.encodeFunctionData("token0", []),
      })),
      ...best.map((item) => ({
        target: item.job.base,
        allowFailure: true,
        callData: ERC20_IFACE.encodeFunctionData("balanceOf", [item.pool]),
      })),
      ...best.map((item) => ({
        target: item.job.quote,
        allowFailure: true,
        callData: ERC20_IFACE.encodeFunctionData("balanceOf", [item.pool]),
      })),
    ]);
    const n = best.length;
    slot0s = rows.slice(0, n).map((item) => (item.success ? decodeSlot0(item.returnData) : null));
    fees = rows.slice(n, n * 2).map((item) => (item.success ? decodeUint(item.returnData, V3_POOL_IFACE, "fee") : null));
    token0s = rows.slice(n * 2, n * 3).map((item) =>
      item.success ? decodeAddress(item.returnData, V3_POOL_IFACE, "token0") : null
    );
    baseBals = rows.slice(n * 3, n * 4).map((item) =>
      item.success ? decodeUint(item.returnData, ERC20_IFACE, "balanceOf") : null
    );
    quoteBals = rows.slice(n * 4, n * 5).map((item) =>
      item.success ? decodeUint(item.returnData, ERC20_IFACE, "balanceOf") : null
    );
  } catch (error) {
    if (isRpcTransportError(error)) throw error;
    return result;
  }

  for (let i = 0; i < best.length; i++) {
    const item = best[i];
    const slot0 = slot0s[i];
    if (!slot0) continue;
    const sqrtPrice = slot0.sqrtPriceX96;
    const baseDecimals = decimalsByToken.get(item.job.base.toLowerCase()) ?? item.job.baseDecimals;
    const quoteDecimals = decimalsByToken.get(item.job.quote.toLowerCase()) ?? item.job.quoteDecimals;
    const token0 = (token0s[i] ?? v2Token0(item.job.base, item.job.quote)).toLowerCase();
    const price = v3SqrtPriceToQuotePerBase({
      sqrtPriceX96: sqrtPrice,
      token0,
      base: item.job.base,
      quote: item.job.quote,
      baseDecimals,
      quoteDecimals,
    });
    const reserves = reservesFromSpotPrice(
      price,
      baseDecimals,
      quoteDecimals,
      baseBals[i] ?? 0n,
      quoteBals[i] ?? 0n
    );
    if (!reserves) continue;
    const feeTier = Number(fees[i] ?? BigInt(item.fee));
    const feeBps = BigInt(Math.max(1, Math.round(feeTier / 100)));
    const quoteIsToken0 = item.job.quote.toLowerCase() === token0;
    result.set(poolKey(item.job.pairId, item.job.dexId), {
      pair: item.pool,
      reserveBase: reserves.reserveBase,
      reserveQuote: reserves.reserveQuote,
      feeBps,
      token0,
      quoteIsToken0,
      baseDecimals,
      quoteDecimals,
      spotPrice: price,
      liquidity: item.liquidity,
      v3Fee: feeTier,
      sqrtPriceX96: sqrtPrice,
      tick: slot0.tick,
      tvlReliable: reserves.reliable,
    });
  }

  return result;
}

async function loadAlgebraDexPools(
  client: JsonRpcProvider,
  jobs: PoolJob[],
  decimalsByToken: Map<string, number>
): Promise<Map<string, LivePool>> {
  const result = new Map<string, LivePool>();
  if (jobs.length === 0) return result;

  const lookups = jobs.map((job) => ({
    job,
    call: {
      target: job.factory,
      allowFailure: true,
      callData: ALGEBRA_FACTORY_IFACE.encodeFunctionData("poolByPair", [job.base, job.quote]),
    } satisfies Call3,
  }));

  let poolAddrs: (string | null)[];
  try {
    const rows = await aggregate3(
      client,
      lookups.map((item) => item.call)
    );
    poolAddrs = rows.map((item) =>
      item.success ? decodeAddress(item.returnData, ALGEBRA_FACTORY_IFACE, "poolByPair") : null
    );
  } catch (error) {
    if (isRpcTransportError(error)) throw error;
    poolAddrs = await Promise.all(
      lookups.map(async (item) => {
        try {
          const factory = new Contract(item.job.factory, ALGEBRA_FACTORY_IFACE, client);
          const addr = (await factory.poolByPair(item.job.base, item.job.quote)) as string;
          if (!addr || addr === ZeroAddress) return null;
          return checksum(addr);
        } catch {
          return null;
        }
      })
    );
  }

  const found = lookups
    .map((item, index) => ({ ...item, pool: poolAddrs[index] }))
    .filter((item): item is typeof item & { pool: string } => Boolean(item.pool));
  if (found.length === 0) return result;

  let liquidities: (bigint | null)[];
  try {
    const rows = await aggregate3(
      client,
      found.map((item) => ({
        target: item.pool,
        allowFailure: true,
        callData: ALGEBRA_POOL_IFACE.encodeFunctionData("liquidity", []),
      }))
    );
    liquidities = rows.map((item) =>
      item.success ? decodeUint(item.returnData, ALGEBRA_POOL_IFACE, "liquidity") : null
    );
  } catch (error) {
    if (isRpcTransportError(error)) throw error;
    liquidities = await Promise.all(
      found.map(async (item) => {
        try {
          const pool = new Contract(item.pool, ALGEBRA_POOL_IFACE, client);
          return BigInt(await pool.liquidity());
        } catch {
          return null;
        }
      })
    );
  }

  const bestByJob = new Map<string, { job: PoolJob; pool: string; liquidity: bigint }>();
  found.forEach((item, index) => {
    const liquidity = liquidities[index];
    if (liquidity == null || liquidity <= 0n) return;
    const key = poolKey(item.job.pairId, item.job.dexId);
    const current = bestByJob.get(key);
    if (!current || liquidity > current.liquidity) {
      bestByJob.set(key, { job: item.job, pool: item.pool, liquidity });
    }
  });

  const best = [...bestByJob.values()];
  if (best.length === 0) return result;

  let prices: (bigint | null)[];
  let token0s: (string | null)[];
  let baseBals: (bigint | null)[];
  let quoteBals: (bigint | null)[];
  try {
    const rows = await aggregate3(client, [
      ...best.map((item) => ({
        target: item.pool,
        allowFailure: true,
        callData: ALGEBRA_POOL_IFACE.encodeFunctionData("globalState", []),
      })),
      ...best.map((item) => ({
        target: item.pool,
        allowFailure: true,
        callData: ALGEBRA_POOL_IFACE.encodeFunctionData("token0", []),
      })),
      ...best.map((item) => ({
        target: item.job.base,
        allowFailure: true,
        callData: ERC20_IFACE.encodeFunctionData("balanceOf", [item.pool]),
      })),
      ...best.map((item) => ({
        target: item.job.quote,
        allowFailure: true,
        callData: ERC20_IFACE.encodeFunctionData("balanceOf", [item.pool]),
      })),
    ]);
    const n = best.length;
    prices = rows.slice(0, n).map((item) => {
      if (!item.success) return null;
      try {
        const decoded = ALGEBRA_POOL_IFACE.decodeFunctionResult("globalState", item.returnData);
        const value = BigInt(decoded[0]);
        return value > 0n ? value : null;
      } catch {
        const hex = item.returnData.startsWith("0x") ? item.returnData.slice(2) : item.returnData;
        if (hex.length < 64) return null;
        const value = BigInt(`0x${hex.slice(0, 64)}`);
        return value > 0n ? value : null;
      }
    });
    token0s = rows.slice(n, n * 2).map((item) =>
      item.success ? decodeAddress(item.returnData, ALGEBRA_POOL_IFACE, "token0") : null
    );
    baseBals = rows.slice(n * 2, n * 3).map((item) =>
      item.success ? decodeUint(item.returnData, ERC20_IFACE, "balanceOf") : null
    );
    quoteBals = rows.slice(n * 3, n * 4).map((item) =>
      item.success ? decodeUint(item.returnData, ERC20_IFACE, "balanceOf") : null
    );
  } catch (error) {
    if (isRpcTransportError(error)) throw error;
    return result;
  }

  for (let i = 0; i < best.length; i++) {
    const item = best[i];
    const sqrtPrice = prices[i];
    if (!sqrtPrice) continue;
    const baseDecimals = decimalsByToken.get(item.job.base.toLowerCase()) ?? item.job.baseDecimals;
    const quoteDecimals = decimalsByToken.get(item.job.quote.toLowerCase()) ?? item.job.quoteDecimals;
    const token0 = (token0s[i] ?? v2Token0(item.job.base, item.job.quote)).toLowerCase();
    const price = v3SqrtPriceToQuotePerBase({
      sqrtPriceX96: sqrtPrice,
      token0,
      base: item.job.base,
      quote: item.job.quote,
      baseDecimals,
      quoteDecimals,
    });
    const reserves = reservesFromSpotPrice(
      price,
      baseDecimals,
      quoteDecimals,
      baseBals[i] ?? 0n,
      quoteBals[i] ?? 0n
    );
    if (!reserves) continue;
    const quoteIsToken0 = item.job.quote.toLowerCase() === token0;
    result.set(poolKey(item.job.pairId, item.job.dexId), {
      pair: item.pool,
      reserveBase: reserves.reserveBase,
      reserveQuote: reserves.reserveQuote,
      feeBps: item.job.feeBps,
      token0,
      quoteIsToken0,
      baseDecimals,
      quoteDecimals,
      spotPrice: price,
      liquidity: item.liquidity,
      tvlReliable: reserves.reliable,
    });
  }

  return result;
}

export async function fetchWbnbUsdtPool(dexId: DexId): Promise<LivePoolLegacy | null> {
  const map = await fetchDexPoolsBatch(
    [dexId],
    [
      {
        pairId: "wbnb-usdt",
        baseAddress: WBNB,
        quoteAddress: USDT,
        baseDecimals: 18,
        quoteDecimals: 18,
      },
    ]
  );
  const live = map.get(poolKey("wbnb-usdt", dexId));
  if (!live) return null;
  return {
    ...live,
    reserveWbnb: live.reserveBase,
    reserveUsdt: live.reserveQuote,
  };
}
