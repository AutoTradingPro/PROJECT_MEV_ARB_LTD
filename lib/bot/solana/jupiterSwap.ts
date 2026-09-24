/**
 * Jupiter Swap API — bangun transaksi versi Solana dari quote.
 * Server-only (memakai JUPITER_API_KEY).
 */
import { envJupiterApiKey } from "@/config/networks";
import { jupiterQuote, type JupiterQuoteResult } from "@/lib/bot/solana/quotes";

const SWAP_URLS = [
  "https://api.jup.ag/swap/v1/swap",
  "https://lite-api.jup.ag/swap/v1/swap",
];

function swapHeaders(): HeadersInit {
  const key = envJupiterApiKey();
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (key) {
    headers["x-api-key"] = key;
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

export type JupiterRawQuote = Record<string, unknown>;

/** Quote mentah (objek Jupiter penuh) untuk POST /swap. */
export async function jupiterQuoteRaw(input: {
  inputMint: string;
  outputMint: string;
  amount: string;
  dexes?: string;
  slippageBps?: number;
}): Promise<JupiterRawQuote | null> {
  if (!input.amount || input.amount === "0") return null;
  const qs = new URLSearchParams({
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: input.amount,
    slippageBps: String(input.slippageBps ?? 80),
  });
  if (input.dexes) qs.set("dexes", input.dexes);

  const bases = [
    "https://api.jup.ag/swap/v1/quote",
    "https://lite-api.jup.ag/swap/v1/quote",
  ];
  for (const base of bases) {
    try {
      const res = await fetch(`${base}?${qs}`, {
        cache: "no-store",
        headers: swapHeaders(),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as JupiterRawQuote & { error?: string; outAmount?: string };
      if (json.error || !json.outAmount) continue;
      return json;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function jupiterBuildSwapTransaction(input: {
  quoteResponse: JupiterRawQuote;
  userPublicKey: string;
  prioritizationFeeLamports?: number | "auto";
  wrapAndUnwrapSol?: boolean;
}): Promise<{ swapTransaction: string; lastValidBlockHeight?: number }> {
  const body = {
    quoteResponse: input.quoteResponse,
    userPublicKey: input.userPublicKey,
    wrapAndUnwrapSol: input.wrapAndUnwrapSol !== false,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: input.prioritizationFeeLamports ?? "auto",
  };

  let lastError = "Jupiter /swap gagal";
  for (const url of SWAP_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: swapHeaders(),
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const json = (await res.json()) as {
        swapTransaction?: string;
        lastValidBlockHeight?: number;
        error?: string;
      };
      if (!res.ok || !json.swapTransaction) {
        lastError = json.error || `HTTP ${res.status}`;
        continue;
      }
      return {
        swapTransaction: json.swapTransaction,
        lastValidBlockHeight: json.lastValidBlockHeight,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "swap fetch error";
    }
  }
  throw new Error(`[JUPITER-SWAP] ${lastError}`);
}

export async function jupiterVenueQuote(input: {
  inputMint: string;
  outputMint: string;
  amount: string;
  dexes?: string;
  venueId?: JupiterQuoteResult["venueId"];
  venueLabel?: string;
}): Promise<JupiterQuoteResult | null> {
  return jupiterQuote({
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: input.amount,
    dexes: input.dexes,
    venueId: input.venueId,
    venueLabel: input.venueLabel,
  });
}
