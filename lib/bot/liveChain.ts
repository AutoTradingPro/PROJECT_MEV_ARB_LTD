import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isTradingChainId, type TradingChainId } from "@/config/networks";

export type LiveChainTransport = "primary" | "backup" | "none";

export interface LiveChainRecord {
  chainId: TradingChainId;
  transport: LiveChainTransport;
  connected: boolean;
  locked: boolean;
  /** manual = klik user. socket = laporan sambungan, tidak boleh menimpa kunci manual. */
  source: "manual" | "socket";
  updatedAt: string;
}

const LIVE_CHAIN_PATH = path.join(process.cwd(), "data", "live-chain.json");

export function liveChainPath(): string {
  return LIVE_CHAIN_PATH;
}

export function readLiveChain(): LiveChainRecord | null {
  try {
    const raw = JSON.parse(readFileSync(LIVE_CHAIN_PATH, "utf8")) as Partial<LiveChainRecord>;
    if (!isTradingChainId(raw.chainId)) return null;
    const transport: LiveChainTransport =
      raw.transport === "primary" || raw.transport === "backup" ? raw.transport : "none";
    return {
      chainId: raw.chainId,
      transport,
      connected: raw.connected === true,
      locked: raw.locked !== false,
      source: raw.source === "manual" ? "manual" : "socket",
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
    };
  } catch {
    return null;
  }
}

/** Ditulis oleh soket yang hidup, atau oleh klik ganti jaringan. */
export function writeLiveChain(
  partial: Partial<LiveChainRecord> & { chainId: TradingChainId }
): LiveChainRecord {
  const prev = readLiveChain();
  const transport: LiveChainTransport =
    partial.transport === "primary" || partial.transport === "backup" || partial.transport === "none"
      ? partial.transport
      : prev?.transport ?? "none";
  const next: LiveChainRecord = {
    chainId: partial.chainId,
    transport,
    connected: partial.connected ?? prev?.connected ?? false,
    locked: partial.locked ?? prev?.locked ?? true,
    source: partial.source ?? prev?.source ?? "socket",
    updatedAt: new Date().toISOString(),
  };
  mkdirSync(path.dirname(LIVE_CHAIN_PATH), { recursive: true });
  writeFileSync(LIVE_CHAIN_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}
