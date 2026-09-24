import { AUTO_EXECUTE, MAX_ALLOWED_BLOCK_LAG } from "@/lib/bot/constants";
import { pctToBps } from "@/lib/bot/configUnits";
import { getBlockNumber } from "@/lib/bot/rpc";
import type { ChainId } from "@/lib/chain/networks";

export { MAX_ALLOWED_BLOCK_LAG };

/** 0.1% di atas minSpread (contoh: min 0.5% → ambang tebal 0.6%). */
export const STALE_SPREAD_CUSHION_PCT = AUTO_EXECUTE.staleSpreadCushionPct;
export const STALE_SPREAD_CUSHION_BPS = pctToBps(STALE_SPREAD_CUSHION_PCT);

export function staleBlockAbortMessage(detectedBlock: number, currentBlock: number): string {
  return `[ABORT] Data basi! Peluang dari blok #${detectedBlock}, sekarang blok #${currentBlock}. Eksekusi dibatalkan untuk menghindari RepayFailed.`;
}

export function isBlockLagTooHigh(
  detectedBlock: number,
  currentBlock: number,
  maxLag = MAX_ALLOWED_BLOCK_LAG
): boolean {
  return currentBlock - detectedBlock > maxLag;
}

export function isSpreadThickEnoughToIgnoreStale(
  spreadBps: number | undefined,
  minSpreadBps: number | undefined,
  cushionBps = STALE_SPREAD_CUSHION_BPS
): boolean {
  if (!Number.isFinite(spreadBps) || !Number.isFinite(minSpreadBps)) return false;
  const spread = Number(spreadBps);
  const min = Number(minSpreadBps);
  return spread + 1e-9 >= min + cushionBps;
}

export function isCalcStillProfitable(input?: {
  netProfitWei?: string;
  estimatedProfitWei?: string;
}): boolean {
  try {
    if (BigInt(input?.netProfitWei || "0") > 0n) return true;
    if (BigInt(input?.estimatedProfitWei || "0") > 0n) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Proteksi data basi hanya jika spread tipis (< minSpread + 0.1%)
 * atau kalkulasi akhir berpotensi rugi. Spread tebal + masih profit → lanjut.
 */
export async function ensureFreshBlock(input: {
  detectedBlock: number;
  chainId: ChainId;
  currentBlock?: number;
  spreadBps?: number;
  minSpreadBps?: number;
  netProfitWei?: string;
  estimatedProfitWei?: string;
}): Promise<{ ok: true; currentBlock: number } | { ok: false; currentBlock: number; reason: string }> {
  const currentBlock =
    input.currentBlock && input.currentBlock > 0
      ? input.currentBlock
      : await getBlockNumber(undefined, input.chainId, { fresh: true });

  const thick = isSpreadThickEnoughToIgnoreStale(input.spreadBps, input.minSpreadBps);
  const profitable = isCalcStillProfitable(input);
  const ignoreStale = thick && profitable;

  if (currentBlock <= 0) {
    if (ignoreStale) {
      console.log(
        `[EXEC] Nomor blok terkini tidak terbaca, tetapi spread tebal dan masih profit — lanjut eksekusi.`
      );
      return { ok: true, currentBlock: 0 };
    }
    const reason =
      "[ABORT] Nomor blok terkini tidak terbaca. Eksekusi dibatalkan untuk menghindari RepayFailed.";
    console.warn(reason);
    return { ok: false, currentBlock: 0, reason };
  }

  if (!isBlockLagTooHigh(input.detectedBlock, currentBlock)) {
    return { ok: true, currentBlock };
  }

  if (!profitable) {
    const reason =
      `[ABORT] Data basi + kalkulasi berpotensi rugi (RepayFailed). ` +
      `Peluang dari blok #${input.detectedBlock}, sekarang blok #${currentBlock}.`;
    console.warn(reason);
    return { ok: false, currentBlock, reason };
  }

  if (thick) {
    const spreadPct = ((input.spreadBps || 0) / 100).toFixed(2);
    const minPct = ((input.minSpreadBps || 0) / 100).toFixed(2);
    console.log(
      `[EXEC] Data basi diabaikan — spread ${spreadPct}% ≥ min ${minPct}% + ${STALE_SPREAD_CUSHION_PCT}% dan masih profit. ` +
        `Blok #${input.detectedBlock} → #${currentBlock}. Lanjut eksekusi.`
    );
    return { ok: true, currentBlock };
  }

  const reason = staleBlockAbortMessage(input.detectedBlock, currentBlock);
  console.warn(reason);
  return { ok: false, currentBlock, reason };
}
