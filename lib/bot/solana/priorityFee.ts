/**
 * Solana prioritization fee (micro-lamports / CU).
 * Dipakai sebagai pengganti eth_gasPrice agar auto-exec tidak tertahan
 * saat "gas price jaringan belum terbaca".
 */
import { resolveChainRpc } from "@/lib/chain/networks";
import { envSolanaRpcUrl } from "@/config/networks";
import { solanaExecutorRpcUrl } from "@/lib/bot/solana/executor";
import { redactEndpoint } from "@/lib/bot/rpc";

/** Default aman mainnet — cukup untuk land tanpa spam fee ekstrem. */
export const SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS = 50_000n;

/** Lantai minimum bila RPC mengembalikan 0. */
export const SOLANA_MIN_PRIORITY_FEE_MICROLAMPORTS = 1_000n;

export type SolanaPriorityFeeResult = {
  microLamports: bigint;
  source: "rpc-median" | "rpc-p75" | "fallback";
  sampleCount: number;
};

type FeeSample = { prioritizationFee?: number; slot?: number };

let cached: { at: number; value: SolanaPriorityFeeResult } | null = null;
const CACHE_MS = 3_000;

function rpcEndpoints(): string[] {
  const list = [
    solanaExecutorRpcUrl(),
    resolveChainRpc("solana"),
    envSolanaRpcUrl(),
  ]
    .map((u) => (u || "").trim())
    .filter(Boolean);
  return [...new Set(list)];
}

async function jsonRpcFees(url: string): Promise<FeeSample[]> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getRecentPrioritizationFees",
      params: [],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    result?: FeeSample[];
    error?: { message?: string };
  };
  if (json.error?.message) throw new Error(json.error.message);
  return Array.isArray(json.result) ? json.result : [];
}

function pickFeeFromSamples(samples: FeeSample[]): SolanaPriorityFeeResult | null {
  const values = samples
    .map((s) => Number(s.prioritizationFee))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!values.length) return null;
  // P75 agar tidak terlalu agresif vs median saat congested.
  const idx = Math.min(values.length - 1, Math.floor(values.length * 0.75));
  const picked = BigInt(Math.max(1, Math.round(values[idx])));
  const microLamports =
    picked < SOLANA_MIN_PRIORITY_FEE_MICROLAMPORTS
      ? SOLANA_MIN_PRIORITY_FEE_MICROLAMPORTS
      : picked;
  return {
    microLamports,
    source: "rpc-p75",
    sampleCount: values.length,
  };
}

/**
 * Ambil prioritization fee live dari QuickNode/Ankr, atau fallback statis.
 * Tidak pernah melempar — selalu mengembalikan nilai > 0.
 */
export async function resolveSolanaPriorityFeeMicroLamports(): Promise<SolanaPriorityFeeResult> {
  if (cached && Date.now() - cached.at < CACHE_MS && cached.value.microLamports > 0n) {
    return cached.value;
  }

  for (const url of rpcEndpoints()) {
    try {
      const samples = await jsonRpcFees(url);
      const picked = pickFeeFromSamples(samples);
      if (picked) {
        cached = { at: Date.now(), value: picked };
        console.log(
          `[SOLANA-FEE] priority ${picked.microLamports} µLamports/CU` +
            ` · ${picked.source} n=${picked.sampleCount} · ${redactEndpoint(url)}`
        );
        return picked;
      }
    } catch (error) {
      console.warn(
        `[SOLANA-FEE] getRecentPrioritizationFees gagal @ ${redactEndpoint(url)}: ${
          error instanceof Error ? error.message : "unknown"
        }`
      );
    }
  }

  const fallback: SolanaPriorityFeeResult = {
    microLamports: SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS,
    source: "fallback",
    sampleCount: 0,
  };
  cached = { at: Date.now(), value: fallback };
  console.log(
    `[SOLANA-FEE] memakai fallback ${fallback.microLamports} µLamports/CU (RPC belum merespons)`
  );
  return fallback;
}

/** Encode ke gasPriceWei bersama EVM gate (harus > 0). */
export function solanaPriorityFeeAsGasPriceWei(microLamports: bigint): string {
  const value =
    microLamports > 0n ? microLamports : SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS;
  return value.toString();
}

export async function resolveSolanaGasPriceWei(): Promise<string> {
  const fee = await resolveSolanaPriorityFeeMicroLamports();
  return solanaPriorityFeeAsGasPriceWei(fee.microLamports);
}
