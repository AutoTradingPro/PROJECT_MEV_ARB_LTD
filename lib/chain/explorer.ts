import { getTradingNetwork, isTradingChainId, POLYGON_EXPLORER_TX } from "@/config/networks";
import type { ChainId } from "./networks";

const BSCSCAN_TX = "https://bscscan.com/tx/";

export function isTxHash(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

const TX_HASH_FIELD_KEYS = [
  "transactionHash",
  "hash",
  "txHash",
  "sendTransactionHash",
  "transaction_hash",
] as const;

const TX_HASH_NEST_KEYS = [
  "receipt",
  "transaction",
  "tx",
  "replacement",
  "cancelled",
  "info",
  "error",
  "cause",
  "data",
  "payload",
  "body",
  "response",
  "result",
  "value",
] as const;

/** Hash 32-byte yang berdiri sendiri, bukan awalan calldata/revert payload. */
function isolatedTxHash(value: string): string | null {
  const text = value.trim();
  if (isTxHash(text)) return text;
  const match = text.match(/(?:^|[^a-fA-F0-9xX])(0x[a-fA-F0-9]{64})(?![a-fA-F0-9])/);
  return match ? match[1] : null;
}

export function extractTxHash(error: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (value: unknown): string | null => {
    if (value == null || seen.has(value)) return null;
    if (typeof value === "string") return isolatedTxHash(value);
    if (typeof value !== "object") return null;
    seen.add(value);
    const rec = value as Record<string, unknown>;
    for (const key of TX_HASH_FIELD_KEYS) {
      if (!(key in rec)) continue;
      const field = rec[key];
      if (typeof field === "string") {
        const hit = isolatedTxHash(field);
        if (hit) return hit;
      } else {
        const hit = walk(field);
        if (hit) return hit;
      }
    }
    for (const key of TX_HASH_NEST_KEYS) {
      const hit = walk(rec[key]);
      if (hit) return hit;
    }
    if (typeof rec.message === "string") {
      const hit = isolatedTxHash(rec.message);
      if (hit) return hit;
    }
    return null;
  };
  return walk(error);
}

export function attachTxHash<T extends Error>(error: T, txHash?: string | null): T {
  if (txHash && isTxHash(txHash)) {
    (error as T & { transactionHash?: string }).transactionHash = txHash;
  }
  return error;
}

export function shortenTxHash(hash: string): string {
  if (hash.length < 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

export function failedTxLogLines(txHash: string, chainId: ChainId | string = "arbitrum"): string {
  return `[TX HASH] ${txHash}\n[EXEC] Tx Hash: ${txHash}\n[EXEC] ${explorerTxUrl(txHash, chainId)}`;
}

export function formatRevertTxLog(
  txHash: string,
  reason: string,
  chainId: ChainId | string = "arbitrum"
): string {
  const alasan = reason.replace(/\s+/g, " ").trim() || "execution reverted";
  return `[REVERT] Tx Hash: ${txHash} — Alasan: ${alasan}\n${failedTxLogLines(txHash, chainId)}`;
}

export function logRevertWithTxHash(
  txHash: string,
  chainId: ChainId | string,
  reason?: string
): void {
  console.warn(`[TX HASH] ${txHash}`);
  if (reason) {
    console.warn(`[REVERT] Tx Hash: ${txHash} — Alasan: ${reason.replace(/\s+/g, " ").trim()}`);
  } else {
    console.warn(`[REVERT] Tx Hash: ${txHash}`);
  }
  console.warn(`[EXEC] ${explorerTxUrl(txHash, chainId)}`);
}

export function explorerTxUrl(txHash: string, chainId: ChainId | string = "bsc"): string {
  if (isTradingChainId(chainId)) {
    return `${getTradingNetwork(chainId).explorerTx}${txHash}`;
  }
  if (chainId === "polygon") {
    return `${POLYGON_EXPLORER_TX}${txHash}`;
  }
  if (chainId === "ethereum") {
    return `https://etherscan.io/tx/${txHash}`;
  }
  return `${BSCSCAN_TX}${txHash}`;
}

/** @deprecated pakai explorerTxUrl */
export function bscscanTxUrl(txHash: string): string {
  return explorerTxUrl(txHash, "bsc");
}
