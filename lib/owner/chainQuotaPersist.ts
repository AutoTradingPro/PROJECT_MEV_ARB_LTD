import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  getChainQuota,
  normalizeChainQuota,
  patchChainQuota,
  replaceChainQuota,
  type ChainQuotaState,
} from "@/lib/owner/chainQuota";
import type { OwnerNodeChainId } from "@/lib/owner/ownerNodeChains";

const QUOTA_PATH = path.join(process.cwd(), "data", "chain-quota.json");

function writeQuotaFile(next: ChainQuotaState): void {
  try {
    mkdirSync(path.dirname(QUOTA_PATH), { recursive: true });
    writeFileSync(QUOTA_PATH, JSON.stringify(next, null, 2), "utf8");
  } catch {
    /* disk penuh / read-only — tetap pakai memori */
  }
}

/** Baca kuota dari disk ke memori proses. */
export function hydrateChainQuotaFromDisk(): ChainQuotaState {
  try {
    const raw = JSON.parse(readFileSync(QUOTA_PATH, "utf8")) as Partial<ChainQuotaState>;
    replaceChainQuota(normalizeChainQuota(raw));
  } catch {
    /* belum ada file — pakai memori/default */
  }
  return getChainQuota();
}

export function patchChainQuotaPersistent(partial: {
  wssEnabled?: boolean;
  rpcFallbackEnabled?: boolean;
  chains?: Partial<Record<OwnerNodeChainId, boolean>>;
  rpcPrimary?: Partial<Record<OwnerNodeChainId, boolean>>;
  rpcBackup?: Partial<Record<OwnerNodeChainId, boolean>>;
}): ChainQuotaState {
  hydrateChainQuotaFromDisk();
  const next = patchChainQuota(partial);
  writeQuotaFile(next);
  return next;
}
