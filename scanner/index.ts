import { getAddress, WebSocketProvider, type Filter, type Log } from "ethers";
import { normalizeTradingChainId } from "@/config/networks";
import { tryServerAutonomousTick } from "@/lib/bot/autonomousExecute";
import { DEFAULT_BOT_CONFIG, scanPlanForChain } from "@/lib/bot/constants";
import { dexIsConcentrated } from "@/lib/bot/dexRegistry";
import { getGasPriceWei, peekMemoizedGasWei } from "@/lib/bot/rpc";
import { fetchDexPoolsBatch, type LivePool } from "@/lib/bot/reserves";
import { appendServerLog } from "@/lib/bot/serverLog";
import { scanOpportunities } from "@/lib/bot/scanner";
import { readBotState, writeBotState } from "@/lib/bot/store";
import type { DexId } from "@/lib/bot/types";
import { getChain, type ChainId } from "@/lib/chain/networks";
import { hydrateChainQuotaFromDisk } from "@/lib/owner/chainQuotaPersist";
import { getPair, onChainTokensForPair, type OnChainPairTokens } from "@/lib/chain/tokenPairs";
import { SWAP_V3_TOPIC, SYNC_TOPIC, MINT_TOPIC, BURN_TOPIC, decodeMintOrBurn, decodeSyncLog, decodeV3SwapLog } from "@/scanner/events";
import { tickSpacingForFee } from "@/scanner/localQuote";
import { ReserveBook, type TrackedPool } from "@/scanner/reserveBook";
import { emptyTickBook } from "@/scanner/v3/tickBitmap";
import { populateActiveTicks } from "@/scanner/v3/populateTicks";

const book = new ReserveBook();
let generation = 0;
let attached: WebSocketProvider | null = null;
let activeChain: ChainId | null = null;
let activeFilter: Filter | null = null;
let activeHandler: ((log: Log) => void) | null = null;
let seededFingerprint = "";
let seedFailedFor = "";
let gasPriceWei = 0n;
let seeding: Promise<void> | null = null;
let recalcLock: Promise<void> | null = null;
let recalcQueued = false;

function fingerprintOf(chainId: string, scanMode: string, pairId: string, dexIds: string[]): string {
  return `${chainId}|${scanMode}|${pairId}|${dexIds.join(",")}`;
}

function targetsForState(chainId: ChainId, scanMode: "single" | "full", pairId: string | undefined, dexIds: DexId[]) {
  const plan = scanPlanForChain(chainId, dexIds);
  const ids =
    scanMode === "full"
      ? plan.pairs.map((item) => item.id)
      : pairId && plan.pairs.some((item) => item.id === pairId)
        ? [pairId]
        : plan.pairs[0]
          ? [plan.pairs[0].id]
          : [];
  const tokens: OnChainPairTokens[] = [];
  for (const id of ids) {
    const pair = getPair(chainId, id);
    const onChain = pair ? onChainTokensForPair(pair) : null;
    if (onChain) tokens.push(onChain);
  }
  return { plan, tokens, pairIds: ids };
}

function toTracked(pools: Map<string, LivePool>, tokens: OnChainPairTokens[]): TrackedPool[] {
  const byPair = new Map(tokens.map((item) => [item.pairId, item]));
  const tracked: TrackedPool[] = [];
  for (const [key, pool] of pools) {
    const split = key.indexOf(":");
    if (split <= 0) continue;
    const pairId = key.slice(0, split);
    const dexId = key.slice(split + 1) as DexId;
    const token = byPair.get(pairId);
    if (!token || !pool.pair) continue;
    const kind = dexIsConcentrated(dexId) ? "v3" : "v2";
    const feePips = pool.v3Fee ?? Number(pool.feeBps) * 100;
    const sqrtPriceX96 = pool.sqrtPriceX96;
    const tick = pool.tick;
    const v3 =
      kind === "v3" && sqrtPriceX96 && sqrtPriceX96 > 0n && tick != null
        ? {
            sqrtPriceX96,
            tick,
            liquidity: pool.liquidity ?? 0n,
            feePips,
            tickSpacing: tickSpacingForFee(feePips),
            ticks: emptyTickBook(),
          }
        : undefined;
    if (v3) pool.v3Quote = v3;
    tracked.push({
      key,
      address: pool.pair.toLowerCase(),
      kind,
      base: token.baseAddress,
      quote: token.quoteAddress,
      tick: tick ?? undefined,
      sqrtPriceX96,
      v3,
      pool,
    });
  }
  return tracked;
}

async function seed(chainId: ChainId, reason: string, gen: number): Promise<void> {
  hydrateChainQuotaFromDisk();
  const state = await readBotState();
  if (gen !== generation || state.killed) return;
  const config = { ...DEFAULT_BOT_CONFIG, ...state.config };
  const scanMode = config.scanMode === "full" ? "full" : "single";
  const { plan, tokens, pairIds } = targetsForState(chainId, scanMode, config.pairId, config.activeDexIds);
  const fingerprint = fingerprintOf(chainId, scanMode, pairIds.join(","), plan.dexIds);
  if (!plan.evm || tokens.length === 0) {
    book.clear();
    seededFingerprint = fingerprint;
    return;
  }
  try {
    const pools = await fetchDexPoolsBatch(plan.dexIds, tokens, chainId);
    if (gen !== generation) return;
    const tracked = toTracked(pools, tokens);
    if (gen !== generation) return;
    try {
      await populateActiveTicks(chainId, tracked);
    } catch (error) {
      const message = error instanceof Error ? error.message : "tick historis gagal";
      console.warn(`[scanner] cold start tick dilewati (${message}). Bitmap menunggu log Mint/Burn.`);
    }
    if (gen !== generation) return;
    book.replace(tracked);
    seededFingerprint = fingerprint;
    seedFailedFor = "";
    try {
      gasPriceWei = await getGasPriceWei(undefined, chainId);
    } catch {
      const cached = peekMemoizedGasWei(chainId);
      if (cached > 0n) gasPriceWei = cached;
    }
    console.log(
      `[scanner] seed ${reason} · ${chainId} · ${tracked.length} pool di RAM · gas sekali · lanjut lewat log Sync/Swap`
    );
    subscribe(attached);
  } catch (error) {
    seedFailedFor = fingerprint;
    const message = error instanceof Error ? error.message : "seed gagal";
    console.warn(`[scanner] seed ${reason} gagal (${message}). Tidak mengulang lewat polling.`);
  }
}

function subscribe(provider: WebSocketProvider | null): void {
  if (!provider) return;
  detachFilter(provider);
  const addresses = book.addresses();
  if (addresses.length === 0) return;
  const filter: Filter = {
    address: addresses.map((item) => getAddress(item)),
    topics: [[SYNC_TOPIC, SWAP_V3_TOPIC, MINT_TOPIC, BURN_TOPIC]],
  };
  const handler = (log: Log) => {
    const chainId = activeChain;
    const sync = decodeSyncLog(log);
    if (sync) {
      if (book.applySync(log.address, sync.reserve0, sync.reserve1) && chainId) enqueueRecalc(chainId);
      return;
    }
    const swap = decodeV3SwapLog(log);
    if (swap) {
      if (book.applyV3Swap(log.address, swap) && chainId) enqueueRecalc(chainId);
      return;
    }
    const liquidity = decodeMintOrBurn(log);
    if (liquidity && book.applyV3Liquidity(log.address, liquidity) && chainId) enqueueRecalc(chainId);
  };
  provider.on(filter, handler);
  activeFilter = filter;
  activeHandler = handler;
  const heard = `[scanner] dengar ${addresses.length} kontrak · Sync + Swap · block=${book.blockNumber || "—"}`;
  console.log(heard);
  appendServerLog({ level: "info", source: "SCAN", message: heard });
}

function detachFilter(provider: WebSocketProvider | null): void {
  if (!provider || !activeFilter || !activeHandler) {
    activeFilter = null;
    activeHandler = null;
    return;
  }
  try {
    provider.off(activeFilter, activeHandler);
  } catch {
    /* provider sudah ditutup */
  }
  activeFilter = null;
  activeHandler = null;
}

async function recalc(chainId: ChainId): Promise<void> {
  if (!book.dirty || book.size() === 0) return;
  book.dirty = false;
  const snapshot = book.snapshot();
  const state = await readBotState();
  if (state.killed) return;
  const config = { ...DEFAULT_BOT_CONFIG, ...state.config };
  const scanMode = config.scanMode === "full" ? "full" : "single";
  await scanOpportunities({
    eventDriven: true,
    chainId,
    localPools: snapshot,
    blockNumber: book.blockNumber,
    gasPriceWei,
    scanMode,
    pairIds: scanMode === "full" ? undefined : config.pairId ? [config.pairId] : undefined,
  });
  await tryServerAutonomousTick();
}

function enqueueRecalc(chainId: ChainId): void {
  if (recalcLock) {
    recalcQueued = true;
    return;
  }
  recalcLock = recalc(chainId)
    .catch((error) => {
      const message = error instanceof Error ? error.message : "kalkulasi lokal gagal";
      console.warn(`[scanner] ${message}`);
    })
    .finally(() => {
      recalcLock = null;
      if (recalcQueued) {
        recalcQueued = false;
        enqueueRecalc(chainId);
      }
    });
}

async function onBlock(blockNumber: number, chainId: ChainId, gen: number): Promise<void> {
  if (gen !== generation) return;
  if (Number.isFinite(blockNumber) && blockNumber > book.blockNumber) book.blockNumber = blockNumber;
  const state = await readBotState();
  if (gen !== generation) return;
  if (state.killed) return;
  if (normalizeTradingChainId(state.config.chainId) !== chainId) return;
  const config = { ...DEFAULT_BOT_CONFIG, ...state.config };
  const scanMode = config.scanMode === "full" ? "full" : "single";
  const { pairIds, plan } = targetsForState(chainId, scanMode, config.pairId, config.activeDexIds);
  const nextFingerprint = fingerprintOf(chainId, scanMode, pairIds.join(","), plan.dexIds);
  if (seedFailedFor === nextFingerprint) return;
  if (!seededFingerprint || nextFingerprint !== seededFingerprint) {
    if (!seeding) {
      seeding = seed(chainId, "ganti pair/dex", gen).finally(() => {
        seeding = null;
      });
    }
    await seeding;
    if (gen !== generation) return;
  }
  if (book.dirty) enqueueRecalc(chainId);
  else if (blockNumber > 0) {
    const latest = await readBotState();
    if (latest.lastBlock !== blockNumber) {
      await writeBotState({ ...latest, lastBlock: blockNumber });
    }
  }
}

/** Ikat provider WSS yang sudah hidup. Tidak membuka loop HTTP. */
export function bindEventScanner(provider: WebSocketProvider, chainId: ChainId): () => void {
  const gen = ++generation;
  attached = provider;
  activeChain = chainId;
  book.clear();
  seededFingerprint = "";
  detachFilter(provider);
  if (getChain(chainId).evm === false) {
    console.warn(`[scanner] ${chainId} bukan EVM — log Sync/Swap tidak dipasang`);
    return () => {
      if (gen === generation) generation += 1;
    };
  }
  seeding = seed(chainId, "buka WSS", gen).finally(() => {
    seeding = null;
  });
  return () => {
    if (gen !== generation) return;
    generation += 1;
    detachFilter(provider);
    if (attached === provider) attached = null;
    if (activeChain === chainId) activeChain = null;
    book.clear();
    seededFingerprint = "";
    seedFailedFor = "";
  };
}

/** Nomor blok dari `provider.on("block")`. Tidak memanggil eth_call harga. */
export function noteSearcherBlock(blockNumber: number, chainId: ChainId): void {
  void onBlock(blockNumber, chainId, generation);
}

/** Dipakai kalkulasi lain yang ingin quote dari cadangan RAM, bukan router. */
export { quoteLocalAmountOut, quoteLocalV3ExactIn } from "@/scanner/localQuote";
