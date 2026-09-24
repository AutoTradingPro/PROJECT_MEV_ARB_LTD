import { jsonRpcAuthHeaders, stripBlockmachineHttpQuery } from "@/config/blockmachine";
import type { ChainId } from "@/lib/chain/networks";
import { getChain } from "@/lib/chain/networks";
import { parseHexBlock } from "@/lib/chain/publicEnv";
import { isBackupRpcEnabled, isPrimaryRpcEnabled } from "@/lib/owner/chainQuota";
import {
  getChainNodeConfig,
  isHttpUrl,
  isWsUrl,
  markHealthyRpc,
  markHealthyWss,
} from "@/lib/owner/nodeEndpoints";

export interface NodePingSample {
  chainId: ChainId;
  role: "primary" | "backup";
  kind: "rpc" | "wss";
  url: string;
  ok: boolean;
  latencyMs: number;
  blockLabel?: string;
  gasLabel?: string;
  error?: string;
}

const PING_TIMEOUT_MS = 4500;

async function jsonRpcPing<T>(url: string, method: string, params: unknown[] = []): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const response = await fetch(stripBlockmachineHttpQuery(url), {
      method: "POST",
      headers: jsonRpcAuthHeaders(url),
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error(`RPC HTTP ${response.status} (API key disabled / unauthorized)`);
    }
    if (!response.ok) {
      throw new Error(`RPC HTTP ${response.status}: ${text.slice(0, 180) || response.statusText}`);
    }
    let json: { result?: T; error?: { message?: string; code?: number } };
    try {
      json = JSON.parse(text) as { result?: T; error?: { message?: string; code?: number } };
    } catch {
      throw new Error("Respons RPC bukan JSON.");
    }
    if (json.error?.message) {
      const code = json.error.code;
      if (code === 401 || code === 403) {
        throw new Error(`RPC HTTP ${code} (API key disabled / unauthorized)`);
      }
      throw new Error(json.error.message);
    }
    if (json.result === undefined) throw new Error("Respons RPC kosong.");
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

function formatGwei(hex: string): string {
  try {
    const wei = BigInt(hex);
    const gwei = Number(wei) / 1e9;
    if (!Number.isFinite(gwei)) return "—";
    return `${gwei.toFixed(4)} gwei`;
  } catch {
    return "—";
  }
}

async function tendermintStatusPing(url: string): Promise<string> {
  const base = url.replace(/\/$/, "");
  const statusUrl = base.endsWith("/status") ? base : `${base}/status`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const response = await fetch(statusUrl, { signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Tendermint HTTP ${response.status}: ${text.slice(0, 160)}`);
    }
    const json = JSON.parse(text) as {
      result?: { sync_info?: { latest_block_height?: string } };
      sync_info?: { latest_block_height?: string };
    };
    const height =
      json.result?.sync_info?.latest_block_height || json.sync_info?.latest_block_height;
    if (!height) throw new Error("Respons Cosmos /status tanpa tinggi blok.");
    return String(height);
  } finally {
    clearTimeout(timer);
  }
}

async function pingRpc(chainId: ChainId, role: "primary" | "backup", url: string): Promise<NodePingSample> {
  const started = Date.now();
  const chain = getChain(chainId);
  try {
    if (!isHttpUrl(url)) throw new Error("URL RPC tidak valid.");
    if (chainId === "cosmos") {
      const height = await tendermintStatusPing(url);
      markHealthyRpc(chainId, url);
      return {
        chainId,
        role,
        kind: "rpc",
        url,
        ok: true,
        latencyMs: Date.now() - started,
        blockLabel: `#${height}`,
        gasLabel: "n/a (Cosmos)",
      };
    }
    if (!chain.evm) {
      const slot = await jsonRpcPing<number>(url, "getSlot");
      markHealthyRpc(chainId, url);
      return {
        chainId,
        role,
        kind: "rpc",
        url,
        ok: true,
        latencyMs: Date.now() - started,
        blockLabel: `slot ${slot}`,
        gasLabel: "n/a (Solana)",
      };
    }
    const [blockHex, gasHex] = await Promise.all([
      jsonRpcPing<string>(url, "eth_blockNumber"),
      jsonRpcPing<string>(url, "eth_gasPrice"),
    ]);
    const block = parseHexBlock(blockHex);
    markHealthyRpc(chainId, url);
    return {
      chainId,
      role,
      kind: "rpc",
      url,
      ok: true,
      latencyMs: Date.now() - started,
      blockLabel: Number.isFinite(block) ? `#${block}` : blockHex,
      gasLabel: formatGwei(gasHex),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "Timeout — node tidak merespons."
          : error.message
        : "Ping RPC gagal.";
    return {
      chainId,
      role,
      kind: "rpc",
      url,
      ok: false,
      latencyMs: Date.now() - started,
      error: message,
    };
  }
}

async function pingWss(chainId: ChainId, role: "primary" | "backup", url: string): Promise<NodePingSample> {
  const started = Date.now();
  if (!isWsUrl(url)) {
    return {
      chainId,
      role,
      kind: "wss",
      url,
      ok: false,
      latencyMs: 0,
      error: "URL WSS tidak valid.",
    };
  }
  if (typeof WebSocket === "undefined") {
    return {
      chainId,
      role,
      kind: "wss",
      url,
      ok: false,
      latencyMs: 0,
      error: "WebSocket tidak tersedia di runtime server.",
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (sample: NodePingSample) => {
      if (settled) return;
      settled = true;
      resolve(sample);
    };
    try {
      const socket = new WebSocket(url);
      const timer = setTimeout(() => {
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        finish({
          chainId,
          role,
          kind: "wss",
          url,
          ok: false,
          latencyMs: Date.now() - started,
          error: "Timeout — WSS tidak terbuka.",
        });
      }, PING_TIMEOUT_MS);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        markHealthyWss(chainId, url);
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        finish({
          chainId,
          role,
          kind: "wss",
          url,
          ok: true,
          latencyMs: Date.now() - started,
          blockLabel: "socket open",
          gasLabel: "—",
        });
      });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        finish({
          chainId,
          role,
          kind: "wss",
          url,
          ok: false,
          latencyMs: Date.now() - started,
          error: "WSS menolak koneksi.",
        });
      });
    } catch (error) {
      finish({
        chainId,
        role,
        kind: "wss",
        url,
        ok: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : "Ping WSS gagal.",
      });
    }
  });
}

export async function pingChainNodes(chainId: ChainId): Promise<NodePingSample[]> {
  const row = getChainNodeConfig(chainId);
  const jobs: Promise<NodePingSample>[] = [];
  if (isPrimaryRpcEnabled(chainId) && row.primaryRpc) jobs.push(pingRpc(chainId, "primary", row.primaryRpc));
  if (isBackupRpcEnabled(chainId) && row.backupRpc) jobs.push(pingRpc(chainId, "backup", row.backupRpc));
  if (isPrimaryRpcEnabled(chainId) && row.primaryWss) jobs.push(pingWss(chainId, "primary", row.primaryWss));
  if (isBackupRpcEnabled(chainId) && row.backupWss) jobs.push(pingWss(chainId, "backup", row.backupWss));
  return Promise.all(jobs);
}
