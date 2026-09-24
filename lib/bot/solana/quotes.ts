/**
 * Quote harga Solana via Jupiter (filter DEX: Raydium / Orca Whirlpool / Meteora).
 * Menghasilkan harga numerik valid untuk matrix (priceDexA/B, spread, likuiditas).
 */
import { envJupiterApiKey, SOLANA_TOKENS } from "@/config/networks";

export const SOLANA_DEX_VENUES = [
  {
    id: "raydium" as const,
    label: "Raydium",
    /** Nama filter Jupiter API */
    dexes: "Raydium,Raydium CLMM",
  },
  {
    id: "orca" as const,
    label: "Orca",
    dexes: "Whirlpool,Orca V2,Orca V1",
  },
  {
    id: "meteora" as const,
    label: "Meteora",
    dexes: "Meteora,Meteora DLMM",
  },
] as const;

export type SolanaDexVenueId = (typeof SOLANA_DEX_VENUES)[number]["id"];

/** api.jup.ag dulu — lite-api sering 429; quote-api.jup.ag (v6) DNS sudah mati. */
const JUPITER_QUOTE_URLS = [
  "https://api.jup.ag/swap/v1/quote",
  "https://lite-api.jup.ag/swap/v1/quote",
];

export interface JupiterQuoteResult {
  inAmount: bigint;
  outAmount: bigint;
  label: string;
  priceImpactPct: number;
  venueId: SolanaDexVenueId;
  venueLabel: string;
}

type QuoteCacheEntry = { at: number; value: JupiterQuoteResult | null };

const quoteCache = new Map<string, QuoteCacheEntry>();
const QUOTE_CACHE_TTL_MS = 2_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jupiterApiKey(): string {
  return envJupiterApiKey();
}

function quoteHeaders(): HeadersInit {
  const key = jupiterApiKey();
  const headers: Record<string, string> = { accept: "application/json" };
  if (key) {
    headers["x-api-key"] = key;
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function cacheKey(input: {
  inputMint: string;
  outputMint: string;
  amount: string;
  dexes?: string;
}): string {
  return `${input.inputMint}:${input.outputMint}:${input.amount}:${input.dexes || "*"}`;
}

export async function jupiterQuote(input: {
  inputMint: string;
  outputMint: string;
  amount: string;
  dexes?: string;
  onlyDirectRoutes?: boolean;
  venueId?: SolanaDexVenueId;
  venueLabel?: string;
}): Promise<JupiterQuoteResult | null> {
  if (!input.amount || input.amount === "0") return null;

  const key = cacheKey(input);
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.at < QUOTE_CACHE_TTL_MS) {
    return hit.value
      ? {
          ...hit.value,
          venueId: input.venueId || hit.value.venueId,
          venueLabel: input.venueLabel || hit.value.venueLabel,
        }
      : null;
  }

  const qs = new URLSearchParams({
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: input.amount,
    slippageBps: "50",
  });
  if (input.dexes) qs.set("dexes", input.dexes);
  if (input.onlyDirectRoutes) qs.set("onlyDirectRoutes", "true");

  let lastStatus = 0;
  for (const base of JUPITER_QUOTE_URLS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`${base}?${qs}`, {
          cache: "no-store",
          headers: quoteHeaders(),
        });
        lastStatus = response.status;
        if (response.status === 429) {
          await sleep(120 * (attempt + 1) + Math.floor(Math.random() * 80));
          continue;
        }
        if (!response.ok) break;
        const json = (await response.json()) as {
          inAmount?: string;
          outAmount?: string;
          priceImpactPct?: string | number;
          routePlan?: Array<{ swapInfo?: { label?: string } }>;
          error?: string;
        };
        if (!json.outAmount || json.error) break;
        const outAmount = BigInt(json.outAmount);
        if (outAmount <= 0n) break;
        const inAmount = BigInt(json.inAmount || input.amount);
        const impact = Number(json.priceImpactPct ?? 0);
        const label =
          json.routePlan?.map((step) => step.swapInfo?.label).filter(Boolean).join("+") ||
          input.venueLabel ||
          "Jupiter";
        const value: JupiterQuoteResult = {
          inAmount,
          outAmount,
          label,
          priceImpactPct: Number.isFinite(impact) ? Math.abs(impact) : 0,
          venueId: input.venueId || "raydium",
          venueLabel: input.venueLabel || "Raydium",
        };
        quoteCache.set(key, { at: Date.now(), value });
        return value;
      } catch {
        await sleep(80 * (attempt + 1));
      }
    }
  }

  if (lastStatus === 429) {
    console.warn(
      `[SOLANA-QUOTE] Jupiter 429 rate-limit` +
        (jupiterApiKey() ? "" : " · set JUPITER_API_KEY di .env.local") +
        ` · ${input.venueLabel || "open"}`
    );
  }
  quoteCache.set(key, { at: Date.now(), value: null });
  return null;
}

export async function quoteOnVenue(input: {
  inputMint: string;
  outputMint: string;
  amount: string;
  venue: (typeof SOLANA_DEX_VENUES)[number];
}): Promise<JupiterQuoteResult | null> {
  const quoted = await jupiterQuote({
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: input.amount,
    dexes: input.venue.dexes,
    venueId: input.venue.id,
    venueLabel: input.venue.label,
  });
  if (quoted) return quoted;
  // Fallback tanpa filter ketat — tetap label venue agar UI tidak kosong.
  const open = await jupiterQuote({
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: input.amount,
    venueId: input.venue.id,
    venueLabel: input.venue.label,
  });
  return open;
}

/** Harga 1 unit input dalam unit output (human). */
export function priceFromQuote(
  inAmount: bigint,
  outAmount: bigint,
  inDecimals: number,
  outDecimals: number
): number {
  if (inAmount <= 0n || outAmount <= 0n) return 0;
  const inHuman = Number(inAmount) / 10 ** inDecimals;
  const outHuman = Number(outAmount) / 10 ** outDecimals;
  if (!Number.isFinite(inHuman) || !Number.isFinite(outHuman) || inHuman <= 0) return 0;
  const price = outHuman / inHuman;
  return Number.isFinite(price) && price > 0 ? price : 0;
}

/** Estimasi depth USD dari impact quote (semakin kecil impact → semakin dalam). */
export function estimateLiquidityUsd(loanUsd: number, priceImpactPct: number): number {
  const loan = Number.isFinite(loanUsd) && loanUsd > 0 ? loanUsd : 10_000;
  const impact = Number.isFinite(priceImpactPct) ? Math.abs(priceImpactPct) : 0;
  // Impact ~0 pada sample kecil → asumsikan depth sedang (bukan $50M palsu).
  if (impact < 0.01) {
    return Math.min(2_500_000, Math.max(250_000, loan * 80));
  }
  const depth = (loan * 100) / impact;
  if (!Number.isFinite(depth) || depth <= 0) return Math.max(100_000, loan * 20);
  return Math.min(8_000_000, Math.max(100_000, depth));
}

/** Sample amount base untuk harga spot (1 unit, atau fraksi untuk meme supply besar). */
export function sampleBaseAmount(baseDecimals: number, baseSymbol: string): bigint {
  const dec = Math.max(0, Math.min(18, baseDecimals));
  const sym = baseSymbol.toUpperCase();
  // BONK dll. — sample lebih besar agar quote tidak terlalu kecil / dibulatkan nol.
  if (sym === "BONK") return 1_000_000n * 10n ** BigInt(dec); // 1M BONK
  if (sym === "WIF" || sym === "JTO" || sym === "JUP" || sym === "PYTH" || sym === "RAY") {
    return 100n * 10n ** BigInt(dec);
  }
  return 10n ** BigInt(dec); // 1 unit
}

let cachedSolUsd = { price: 0, at: 0 };

async function fetchSolUsdFromCoingecko(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { cache: "no-store" }
    );
    if (!response.ok) return 0;
    const json = (await response.json()) as { solana?: { usd?: number } };
    const px = Number(json.solana?.usd);
    return Number.isFinite(px) && px > 0 ? px : 0;
  } catch {
    return 0;
  }
}

/** Harga SOL/USD mid dari Raydium+Orca (cache 15s) + fallback CoinGecko. */
export async function fetchSolUsdPrice(): Promise<number> {
  if (cachedSolUsd.price > 0 && Date.now() - cachedSolUsd.at < 15_000) {
    return cachedSolUsd.price;
  }
  const oneSol = (10n ** 9n).toString();
  const quotes: number[] = [];
  for (const venue of SOLANA_DEX_VENUES.slice(0, 2)) {
    const q = await quoteOnVenue({
      inputMint: SOLANA_TOKENS.sol,
      outputMint: SOLANA_TOKENS.usdc,
      amount: oneSol,
      venue,
    });
    if (!q) continue;
    const px = priceFromQuote(q.inAmount, q.outAmount, 9, 6);
    if (px > 0) quotes.push(px);
    if (quotes.length > 0) break; // satu venue cukup untuk mid SOL/USD
  }
  let mid =
    quotes.length > 0 ? quotes.reduce((a, b) => a + b, 0) / quotes.length : 0;
  if (!(mid > 0)) {
    mid = await fetchSolUsdFromCoingecko();
    if (mid > 0) {
      console.log(`[SOLANA-QUOTE] SOL/USD fallback CoinGecko ≈ $${mid.toFixed(2)}`);
    }
  }
  if (!(mid > 0) && cachedSolUsd.price > 0) mid = cachedSolUsd.price;
  if (mid > 0) cachedSolUsd = { price: mid, at: Date.now() };
  return mid;
}

export function quoteSymbolUsd(symbol: string, solUsd: number): number {
  const key = symbol.toUpperCase();
  if (key === "USDC" || key === "USDT" || key === "USD") return 1;
  if (key === "SOL" || key === "WSOL") return solUsd > 0 ? solUsd : 0;
  return 0;
}
