/**
 * Solana scanner — Ankr slot + Jupiter per-DEX quotes (Raydium / Orca / Meteora).
 * Mengisi priceDexA/B, likuiditas, dan spread antar DEX (bukan round-trip aggregator).
 */
import { envSolanaRpcUrl, envSolanaWsUrl } from "@/config/networks";
import { resolveChainRpc, resolveChainWs } from "@/lib/chain/networks";
import { pairsForChain, type TokenPairConfig } from "@/lib/chain/tokenPairs";
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import { usdToTokenWei, tokenWeiToUsd } from "@/lib/bot/configUnits";
import { spotSpreadBps } from "@/lib/bot/pricing";
import { minSpreadBpsFromConfig, spreadMeetsMinimum } from "@/lib/bot/autoExecute";
import { solanaMinProfitFloorUsd } from "@/lib/bot/adaptiveMinProfit";
import { defaultSolanaPairIds } from "@/lib/bot/solana/pairs";
import { KAMINO_FLASH_FEE_PCT, kaminoFlashFeeWei } from "@/lib/bot/solana/kaminoConstants";
import { ensureSolanaLiveSlotMonitor } from "@/lib/bot/solana/liveSlot";
import {
  estimateLiquidityUsd,
  fetchSolUsdPrice,
  priceFromQuote,
  quoteOnVenue,
  quoteSymbolUsd,
  sampleBaseAmount,
  SOLANA_DEX_VENUES,
  type JupiterQuoteResult,
} from "@/lib/bot/solana/quotes";

export async function fetchSolanaSlot(rpcUrl?: string): Promise<number> {
  const url = (rpcUrl || resolveChainRpc("solana") || envSolanaRpcUrl() || "").trim();
  if (!url) return 0;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [] }),
    cache: "no-store",
  });
  const json = (await response.json()) as { result?: number; error?: { message?: string } };
  if (json.error?.message) throw new Error(json.error.message);
  return typeof json.result === "number" && Number.isFinite(json.result) ? json.result : 0;
}

export function solanaScannerEndpoints(): { rpcUrl: string; wsUrl: string; via: "Ankr" | "RPC" } {
  const rpcUrl = resolveChainRpc("solana") || envSolanaRpcUrl() || "";
  const wsUrl = resolveChainWs("solana") || envSolanaWsUrl() || "";
  return {
    rpcUrl,
    wsUrl,
    via: /ankr\.com/i.test(rpcUrl) ? "Ankr" : "RPC",
  };
}

function pairMints(pair: TokenPairConfig): { base: string; quote: string } | null {
  if (!pair.baseAddress || !pair.quoteAddress) return null;
  return { base: pair.baseAddress, quote: pair.quoteAddress };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DexSpot {
  venue: (typeof SOLANA_DEX_VENUES)[number];
  /** Harga 1 base dalam unit quote (human). */
  priceQuote: number;
  /** Harga 1 base dalam USD. */
  priceUsd: number;
  sellQuote: JupiterQuoteResult;
  liquidityUsd: number;
}

async function spotOnVenue(input: {
  pair: TokenPairConfig;
  mints: { base: string; quote: string };
  venue: (typeof SOLANA_DEX_VENUES)[number];
  quoteUsd: number;
  loanUsd: number;
}): Promise<DexSpot | null> {
  const baseDecimals = input.pair.baseDecimals ?? 9;
  const quoteDecimals = input.pair.quoteDecimals ?? 6;
  const sample = sampleBaseAmount(baseDecimals, input.pair.baseSymbol);
  const sellQuote = await quoteOnVenue({
    inputMint: input.mints.base,
    outputMint: input.mints.quote,
    amount: sample.toString(),
    venue: input.venue,
  });
  if (!sellQuote || sellQuote.outAmount <= 0n) return null;
  const priceQuote = priceFromQuote(
    sellQuote.inAmount,
    sellQuote.outAmount,
    baseDecimals,
    quoteDecimals
  );
  if (!(priceQuote > 0)) return null;
  const priceUsd = priceQuote * (input.quoteUsd > 0 ? input.quoteUsd : 1);
  if (!(priceUsd > 0)) return null;
  return {
    venue: input.venue,
    priceQuote,
    priceUsd,
    sellQuote,
    liquidityUsd: estimateLiquidityUsd(input.loanUsd, sellQuote.priceImpactPct),
  };
}

const PAIR_SCAN_CONCURRENCY = 5;

/**
 * Spot DEX:
 * - fullCoverage: selalu Raydium + Orca + Meteora (tanpa skip ketat).
 * - single/hemat: Raydium+Orca dulu; Meteora hanya bila spread mendekati ambang.
 */
async function collectVenueSpots(input: {
  pair: TokenPairConfig;
  mints: { base: string; quote: string };
  quoteUsd: number;
  loanUsd: number;
  minBps: number;
  fullCoverage: boolean;
}): Promise<DexSpot[]> {
  if (input.fullCoverage) {
    const results = await Promise.all(
      SOLANA_DEX_VENUES.map((venue) =>
        spotOnVenue({
          pair: input.pair,
          mints: input.mints,
          venue,
          quoteUsd: input.quoteUsd,
          loanUsd: input.loanUsd,
        })
      )
    );
    return results.filter((item): item is DexSpot => item != null);
  }

  const primaryVenues = SOLANA_DEX_VENUES.filter((v) => v.id === "raydium" || v.id === "orca");
  const primary = await Promise.all(
    primaryVenues.map((venue) =>
      spotOnVenue({
        pair: input.pair,
        mints: input.mints,
        venue,
        quoteUsd: input.quoteUsd,
        loanUsd: input.loanUsd,
      })
    )
  );
  const spots = primary.filter((item): item is DexSpot => item != null);
  if (spots.length < 2) {
    const meteora = SOLANA_DEX_VENUES.find((v) => v.id === "meteora");
    if (meteora) {
      const extra = await spotOnVenue({
        pair: input.pair,
        mints: input.mints,
        venue: meteora,
        quoteUsd: input.quoteUsd,
        loanUsd: input.loanUsd,
      });
      if (extra) spots.push(extra);
    }
    return spots;
  }
  const ranked = [...spots].sort((a, b) => a.priceUsd - b.priceUsd);
  const spreadBps = spotSpreadBps(ranked[0].priceUsd, ranked[ranked.length - 1].priceUsd);
  if (spreadBps >= input.minBps * 0.4) {
    const meteora = SOLANA_DEX_VENUES.find((v) => v.id === "meteora");
    if (meteora) {
      const extra = await spotOnVenue({
        pair: input.pair,
        mints: input.mints,
        venue: meteora,
        quoteUsd: input.quoteUsd,
        loanUsd: input.loanUsd,
      });
      if (extra) spots.push(extra);
    }
  }
  return spots;
}

async function scanOneSolanaPair(input: {
  pair: TokenPairConfig;
  loanUsd: number;
  quoteUsd: number;
  solUsd: number;
  minBps: number;
  feePct: number;
  slot: number;
  fullCoverage: boolean;
}): Promise<Opportunity> {
  const { pair, loanUsd, minBps, feePct, slot, fullCoverage } = input;
  const mints = pairMints(pair);
  if (!mints) return emptySolOpp(pair, slot, "Mint pair Solana belum dikonfigurasi.");

  const quoteDecimals = pair.quoteDecimals ?? 6;
  const quoteUsd = quoteSymbolUsd(pair.quoteSymbol, input.solUsd);
  if (!(quoteUsd > 0)) {
    return emptySolOpp(pair, slot, `Harga quote ${pair.quoteSymbol} belum tersedia (SOL/USD).`);
  }

  const spots = await collectVenueSpots({
    pair,
    mints,
    quoteUsd,
    loanUsd,
    minBps,
    fullCoverage,
  });
  if (spots.length < 2) {
    return emptySolOpp(
      pair,
      slot,
      `Kurang dari 2 DEX merespons quote (${spots.map((s) => s.venue.label).join("/") || "none"}).`
    );
  }

  const ranked = [...spots].sort((a, b) => a.priceUsd - b.priceUsd);
  let buyDex = ranked[0];
  let sellDex = ranked[ranked.length - 1];
  if (buyDex.venue.id === sellDex.venue.id) {
    sellDex = ranked.find((s) => s.venue.id !== buyDex.venue.id) || sellDex;
  }

  const priceDexAUsd = buyDex.priceUsd;
  const priceDexBUsd = sellDex.priceUsd;
  const spreadBps = spotSpreadBps(priceDexAUsd, priceDexBUsd);

  const amountIn = BigInt(usdToTokenWei(loanUsd, quoteDecimals, quoteUsd) || "0");
  if (amountIn <= 0n) return emptySolOpp(pair, slot, "Nominal loan tidak valid.");

  let gross = 0n;
  let amountOut = 0n;
  let baseBought = 0n;
  /** Detail kegagalan Jupiter round-trip (hanya relevan bila deep quote dicoba). */
  let rtFail:
    | null
    | "skipped"
    | "buy-quote-empty"
    | "sell-quote-empty"
    | "gross-non-positive" = null;

  // Full pair Scan: selalu deep quote. Single: skip round-trip jika spread jauh di bawah min.
  const needsDeepQuote = fullCoverage || spreadBps >= minBps * 0.65;
  if (!needsDeepQuote) {
    rtFail = "skipped";
  } else {
    const buyLeg = await quoteOnVenue({
      inputMint: mints.quote,
      outputMint: mints.base,
      amount: amountIn.toString(),
      venue: buyDex.venue,
    });
    if (!buyLeg || !(buyLeg.outAmount > 0n)) {
      rtFail = "buy-quote-empty";
    } else {
      baseBought = buyLeg.outAmount;
      const sellLeg = await quoteOnVenue({
        inputMint: mints.base,
        outputMint: mints.quote,
        amount: baseBought.toString(),
        venue: sellDex.venue,
      });
      if (!sellLeg || !(sellLeg.outAmount > 0n)) {
        rtFail = "sell-quote-empty";
      } else {
        amountOut = sellLeg.outAmount;
        gross = amountOut > amountIn ? amountOut - amountIn : 0n;
        if (gross <= 0n) rtFail = "gross-non-positive";
        else rtFail = null;
      }
    }
  }

  if (gross <= 0n && spreadBps > 0 && rtFail !== "skipped") {
    // Jangan invent gross dari spot — itu sumber "cuan semu" LST (bSOL/SOL, dll).
  }

  const flashFee = kaminoFlashFeeWei(amountIn);
  const net = gross > flashFee ? gross - flashFee : 0n;
  const grossUsd = tokenWeiToUsd(gross.toString(), quoteDecimals, quoteUsd);
  const feeUsd = tokenWeiToUsd(flashFee.toString(), quoteDecimals, quoteUsd);
  const netUsd = tokenWeiToUsd(net.toString(), quoteDecimals, quoteUsd);
  const loanFloorUsd = solanaMinProfitFloorUsd(loanUsd);
  const spreadOk = spreadMeetsMinimum(spreadBps, minBps);
  // Ready hanya jika deep/round-trip net lolos lantai — cegah sinyal spot palsu (LST premium).
  const deepNetOk = gross > 0n && netUsd + 1e-9 >= loanFloorUsd;
  const ready = spreadOk && deepNetOk && priceDexAUsd > 0 && priceDexBUsd > 0;
  const buyLiq = buyDex.liquidityUsd;
  const sellLiq = sellDex.liquidityUsd;
  const poolLiq = Math.min(buyLiq, sellLiq);
  const minPctLabel = (minBps / 100).toFixed(3);
  const spotPct = (spreadBps / 100).toFixed(3);

  let rejectReason = "";
  if (!spreadOk) {
    rejectReason = `Spread ${spotPct}% < min ${minPctLabel}% · Kamino ${feePct}% · slot #${slot}`;
  } else if (rtFail === "skipped") {
    rejectReason =
      `Spot +${spotPct}% ≥ min tetapi deep RT dilewati (di bawah ambang deep)` +
      ` · Kamino ${feePct}% · slot #${slot}`;
  } else if (rtFail === "buy-quote-empty") {
    rejectReason =
      `Jupiter_RT(loan): kuotasi beli ${buyDex.venue.label} kosong/gagal` +
      ` · spot +${spotPct}% (bukan profit RT) · Kamino ${feePct}% · slot #${slot}`;
  } else if (rtFail === "sell-quote-empty") {
    rejectReason =
      `Jupiter_RT(loan): kuotasi jual ${sellDex.venue.label} kosong/gagal setelah beli` +
      ` · spot +${spotPct}% · Kamino ${feePct}% · slot #${slot}`;
  } else if (rtFail === "gross-non-positive" || gross <= 0n) {
    rejectReason =
      `Jupiter_RT(loan): gross ≤ 0 (out ≤ in) · spot +${spotPct}%` +
      ` ≠ profit executable (premium/impact) · Kamino ${feePct}% · slot #${slot}`;
  } else if (!deepNetOk) {
    rejectReason =
      `Net RT $${netUsd.toFixed(4)} (= gross $${grossUsd.toFixed(4)} − Kamino $${feeUsd.toFixed(4)})` +
      ` < lantai max(loan×0.10%,$5) $${loanFloorUsd.toFixed(4)}` +
      ` · spot +${spotPct}% · slot #${slot}`;
  } else {
    rejectReason = `Harga quote belum valid · slot #${slot}`;
  }

  console.log(
    `[SOLANA-SCAN] ${pair.label} · ${buyDex.venue.label}→${sellDex.venue.label}` +
      ` · beli $${priceDexAUsd.toFixed(6)} · jual $${priceDexBUsd.toFixed(6)}` +
      ` · spot +${spotPct}%` +
      ` · gross$${grossUsd.toFixed(4)} · fee$${feeUsd.toFixed(4)} · net$${netUsd.toFixed(4)}` +
      ` · lantai$${loanFloorUsd.toFixed(4)}` +
      ` · liq $${Math.round(poolLiq).toLocaleString("en-US")}` +
      ` · Kamino ${feePct}% · ${fullCoverage ? "full" : needsDeepQuote ? "deep" : "spot"}` +
      ` · ${ready ? "READY" : "wait"} · slot #${slot}`
  );

  // Spot lolos min tetapi belum Ready → log eksplisit (bedakan premium spot vs RT bersih).
  if (spreadOk && !ready) {
    const rtBit =
      rtFail === "buy-quote-empty"
        ? "Jupiter_RT: kuotasi beli tidak valid/kosong"
        : rtFail === "sell-quote-empty"
          ? "Jupiter_RT: kuotasi jual tidak valid/kosong"
          : rtFail === "skipped"
            ? "Jupiter_RT: tidak dijalankan (di bawah ambang deep)"
            : rtFail === "gross-non-positive" || gross <= 0n
              ? `Jupiter_RT: gross ≤ 0 (out≤in · spot premium/impact, bukan arb)`
              : `Jupiter_RT: OK gross $${grossUsd.toFixed(4)}`;
    const floorBit =
      gross > 0n
        ? `net(gross−Kamino)=$${netUsd.toFixed(4)} vs lantai max(loan×0.10%,$5)=$${loanFloorUsd.toFixed(4)}` +
          (netUsd + 1e-9 >= loanFloorUsd ? " · LOLOS" : " · GAGAL (tergerus biaya / tipis)")
        : `net tidak dihitung (gross ≤ 0) · lantai max(loan×0.10%,$5)=$${loanFloorUsd.toFixed(4)}`;
    console.log(
      `[SOLANA-SCAN][NOT-READY] ${pair.label} ${buyDex.venue.label}→${sellDex.venue.label}` +
        ` · spot +${spotPct}% ≥ min ${minPctLabel}%` +
        ` · ${rtBit}` +
        ` · ${floorBit}` +
        ` · loan≈$${loanUsd.toFixed(2)} · slot #${slot}`
    );
  }

  return {
    id: `solana:${pair.id}:${buyDex.venue.id}->${sellDex.venue.id}`,
    chainId: "solana",
    pairId: pair.id,
    tokenPair: pair.label,
    tokenIn: pair.quoteSymbol,
    tokenOut: pair.baseSymbol,
    buyDex: buyDex.venue.id,
    sellDex: sellDex.venue.id,
    buyExchange: buyDex.venue.label,
    sellExchange: sellDex.venue.label,
    dexAName: buyDex.sellQuote.label.slice(0, 28) || buyDex.venue.label,
    dexBName: sellDex.sellQuote.label.slice(0, 28) || sellDex.venue.label,
    priceDexAUsd,
    priceDexBUsd,
    spreadBps,
    amountInWei: amountIn.toString(),
    amountOutWei: amountOut > 0n ? amountOut.toString() : amountIn.toString(),
    estimatedProfitWei: gross.toString(),
    netProfitWei: net.toString(),
    repayWei: (amountIn + flashFee).toString(),
    gasCostWei: "0",
    quoteDecimals,
    quoteUsd,
    status: ready ? "ready" : "rejected",
    reason: ready
      ? `Kamino ${feePct}% · ${buyDex.venue.label}→${sellDex.venue.label} · net$${netUsd.toFixed(3)} · slot #${slot}`
      : rejectReason,
    live: true,
    detectedBlock: slot,
    buyPoolFee: 25,
    sellPoolFee: 30,
    scanPoolFeePct: feePct,
    poolLiquidityUsd: poolLiq,
    buyLiquidityUsd: buyLiq,
    sellLiquidityUsd: sellLiq,
    flashPair: "",
    amount0Out: "0",
    amount1Out: baseBought > 0n ? baseBought.toString() : "0",
  };
}

/**
 * Scan pair Solana: bandingkan harga spot antar DEX, isi kolom matrix.
 * Pair diproses paralel (5 sekaligus). fullCoverage = Full pair Scan tanpa skip venue.
 */
export async function scanSolanaOpportunities(input: {
  config: BotConfig;
  pairIds?: string[];
  /** true = Full pair Scan: semua venue + deep quote */
  fullCoverage?: boolean;
}): Promise<{
  opportunities: Opportunity[];
  slot: number;
  scanner: ReturnType<typeof solanaScannerEndpoints>;
  live: Awaited<ReturnType<typeof ensureSolanaLiveSlotMonitor>>;
}> {
  const started = Date.now();
  const scanner = solanaScannerEndpoints();
  const live = await ensureSolanaLiveSlotMonitor();
  const slot = live.slot > 0 ? live.slot : await fetchSolanaSlot(scanner.rpcUrl);
  const pairIds = defaultSolanaPairIds(input.pairIds);
  const pairs = pairsForChain("solana").filter((item) => pairIds.includes(item.id));
  const loanUsd = Number(input.config.loanAmountUsd) || 10_000;
  const feePct = KAMINO_FLASH_FEE_PCT;
  const minBps = minSpreadBpsFromConfig(input.config);
  const solUsd = await fetchSolUsdPrice();
  const fullCoverage =
    input.fullCoverage === true || input.config.scanMode === "full";
  const opportunitiesOut: Opportunity[] = [];

  console.log(
    `[SOLANA-SCAN] Live Scan start · ${pairs.length} pair · mode=${fullCoverage ? "full" : "single"}` +
      ` · concurrency=${PAIR_SCAN_CONCURRENCY} · slot #${slot} · feed=${live.transport}` +
      ` · rpc=${scanner.via} · SOL≈$${solUsd.toFixed(2)} · Kamino ${feePct}%` +
      ` · minSpread ${(minBps / 100).toFixed(3)}%`
  );

  for (let i = 0; i < pairs.length; i += PAIR_SCAN_CONCURRENCY) {
    const chunk = pairs.slice(i, i + PAIR_SCAN_CONCURRENCY);
    const chunkOpps = await Promise.all(
      chunk.map((pair) =>
        scanOneSolanaPair({
          pair,
          loanUsd,
          quoteUsd: quoteSymbolUsd(pair.quoteSymbol, solUsd),
          solUsd,
          minBps,
          feePct,
          slot,
          fullCoverage,
        })
      )
    );
    opportunitiesOut.push(...chunkOpps);
    if (i + PAIR_SCAN_CONCURRENCY < pairs.length) await sleep(35);
  }

  const opportunities = opportunitiesOut;
  const readyCount = opportunities.filter((o) => o.status === "ready").length;
  const priced = opportunities.filter((o) => (o.priceDexAUsd || 0) > 0 && (o.priceDexBUsd || 0) > 0)
    .length;
  const elapsedMs = Date.now() - started;
  console.log(
    `[SOLANA-SCAN] selesai · ${opportunities.length} rute · ${priced} berharga · ${readyCount} ready` +
      ` · mode=${fullCoverage ? "full" : "single"} · ${elapsedMs}ms · slot #${slot}`
  );

  return { opportunities, slot, scanner, live };
}

function emptySolOpp(pair: TokenPairConfig, slot: number, reason: string): Opportunity {
  return {
    id: `solana:${pair.id}:pending`,
    chainId: "solana",
    pairId: pair.id,
    tokenPair: pair.label,
    tokenIn: pair.quoteSymbol,
    tokenOut: pair.baseSymbol,
    buyDex: "raydium",
    sellDex: "orca",
    buyExchange: "Raydium",
    sellExchange: "Orca",
    dexAName: "Raydium",
    dexBName: "Orca",
    priceDexAUsd: undefined,
    priceDexBUsd: undefined,
    spreadBps: 0,
    amountInWei: "0",
    amountOutWei: "0",
    estimatedProfitWei: "0",
    netProfitWei: "0",
    repayWei: "0",
    gasCostWei: "0",
    quoteDecimals: pair.quoteDecimals ?? 6,
    quoteUsd: 1,
    status: "rejected",
    reason,
    live: slot > 0,
    detectedBlock: slot,
    scanPoolFeePct: KAMINO_FLASH_FEE_PCT,
    poolLiquidityUsd: undefined,
    buyLiquidityUsd: undefined,
    sellLiquidityUsd: undefined,
    flashPair: "",
    amount0Out: "0",
    amount1Out: "0",
  };
}
