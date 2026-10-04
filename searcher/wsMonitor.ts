import { watch } from "node:fs";
import path from "node:path";
import { WebSocketProvider } from "ethers";
import {
  envArbitrumWsUrl,
  envEthereumWsUrl,
  envEthereumWsUrlFallback,
  envPolygonWsUrl,
  envPolygonWsUrlFallback,
  isTradingChainId,
  normalizeTradingChainId,
} from "../config/networks";
import { redactEndpoint, rpcErrorMessage } from "../lib/bot/rpc";
import { readLiveChain, writeLiveChain, liveChainPath, type LiveChainTransport } from "../lib/bot/liveChain";
import { appendServerLog } from "../lib/bot/serverLog";
import { readBotState, updateConfig } from "../lib/bot/store";
import { defaultDexIdsForChain } from "../lib/bot/dexRegistry";
import { defaultPairForChain } from "../lib/chain/tokenPairs";
import {
  markHealthyWss,
  uniqueUrls,
  wssCandidates,
  getChainNodeConfig,
} from "../lib/owner/nodeEndpoints";
import { getChain } from "../lib/chain/networks";
import type { ChainId } from "../lib/chain/networks";
import { hardAdoptScanChain } from "../lib/bot/scanRuntime";
import { isWssAllowed } from "../lib/owner/chainQuota";
import { hydrateChainQuotaFromDisk } from "../lib/owner/chainQuotaPersist";
import { OWNER_NODE_CHAIN_IDS } from "../lib/owner/ownerNodeChains";
import { bindEventScanner, noteSearcherBlock } from "../scanner";

const WSS_RETRY_MS = 12_000;
let monitorChain: ChainId | null = null;
let stopChainWss: (() => void) | null = null;

function publishLiveSocket(chainId: ChainId, transport: LiveChainTransport, connected: boolean): void {
  if (!isTradingChainId(chainId)) return;
  const current = readLiveChain();
  if (current?.locked && current.chainId !== chainId) return;
  writeLiveChain({ chainId, transport, connected, locked: true });
}

function wssUrls(chainId: ChainId): string[] {
  const row = getChainNodeConfig(chainId);
  const configured = uniqueUrls([row.primaryWss, row.backupWss]);
  if (configured.length > 0) return configured;
  if (chainId === "polygon") {
    return uniqueUrls([envPolygonWsUrl(), envPolygonWsUrlFallback()]);
  }
  if (chainId === "ethereum") {
    return uniqueUrls([envEthereumWsUrl(), envEthereumWsUrlFallback()]);
  }
  if (chainId === "arbitrum") {
    const env = uniqueUrls([
      envArbitrumWsUrl(),
      process.env.ARBITRUM_WSS_URL || "",
      process.env.ANKR_WSS_URL || "",
      process.env.ANKR_WSS_URL_ARBITRUM || "",
      process.env.NEXT_PUBLIC_ARBITRUM_WS_URL || "",
      process.env.NEXT_PUBLIC_ARBITRUM_WS_URL_2 || "",
    ]);
    if (env.length > 0) return env;
    return wssCandidates("arbitrum");
  }
  const env = uniqueUrls([
    process.env.RPC_WSS_URL || "",
    process.env.NEXT_PUBLIC_BSC_WS_URL || "",
    process.env.RPC_WSS_URL_2 || "",
    process.env.NEXT_PUBLIC_BSC_WS_URL_2 || "",
  ]);
  if (env.length > 0) return env;
  return wssCandidates("bsc");
}

type SocketLike = {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  addEventListener?: (event: string, listener: (ev: Event) => void) => void;
};

function attachSocketGuards(provider: WebSocketProvider, onDead: (reason: string) => void): void {
  let dead = false;
  const fail = (reason: string) => {
    if (dead) return;
    if (/provider destroyed|cancelled request/i.test(reason)) return;
    dead = true;
    onDead(reason);
  };

  provider.on("error", (error: unknown) => {
    fail(rpcErrorMessage(error) || "WebSocket error");
  });

  const socket = provider.websocket as SocketLike | undefined;
  if (typeof socket?.on === "function") {
    socket.on("close", (code) => {
      fail(`koneksi putus (close ${String(code ?? "")})`);
    });
    socket.on("error", (error) => {
      fail(rpcErrorMessage(error) || "socket error");
    });
    socket.on("unexpected-response", (_req, res) => {
      const status = (res as { statusCode?: number } | undefined)?.statusCode;
      fail(
        status === 401 || status === 403
          ? `HTTP ${status} (API key disabled)`
          : `WSS handshake HTTP ${status ?? "?"}`
      );
    });
    return;
  }
  if (typeof socket?.addEventListener === "function") {
    socket.addEventListener("close", () => fail("koneksi putus"));
    socket.addEventListener("error", () => fail("WebSocket error"));
  }
}

function chainWithLiveWss(preferred: ChainId): ChainId {
  hydrateChainQuotaFromDisk();
  if (isWssAllowed(preferred)) return preferred;
  const enabled = OWNER_NODE_CHAIN_IDS.find((id) => isWssAllowed(id as ChainId));
  return (enabled as ChainId | undefined) || preferred;
}

function syncChainSockets(chainId: ChainId): void {
  if (!isWssAllowed(chainId)) {
    console.warn(`[searcher] WSS ${chainId} tidak dibuka · feed atau RPC node mati di kuota`);
    if (stopChainWss) {
      console.warn(`[searcher] quota · putus WSS ${monitorChain || chainId}`);
      stopChainWss();
      stopChainWss = null;
    }
    monitorChain = chainId;
    return;
  }
  if (monitorChain === chainId && stopChainWss) return;
  if (stopChainWss) {
    console.warn(`[searcher] Strict Single-Chain · putus WSS ${monitorChain} · aktif ${chainId}`);
    stopChainWss();
    stopChainWss = null;
  }
  monitorChain = chainId;
  stopChainWss = attachChainWss(chainId);
}

function attachChainWss(chainId: ChainId): () => void {
  const networkId = getChain(chainId).chainId ?? (chainId === "ethereum" ? 1 : chainId === "polygon" ? 137 : 42161);
  const urls = wssUrls(chainId);
  let stopped = false;
  let active: WebSocketProvider | null = null;
  let connecting = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let unbindScanner: (() => void) | null = null;

  const destroyActive = () => {
    unbindScanner?.();
    unbindScanner = null;
    const current = active;
    active = null;
    if (!current) return;
    try {
      current.removeAllListeners();
    } catch {
      /* ignore */
    }
    try {
      const socket = current.websocket as { removeAllListeners?: () => void; close?: (code?: number) => void };
      socket.removeAllListeners?.();
      socket.close?.(1000);
    } catch {
      /* ignore */
    }
    try {
      const result = current.destroy() as void | Promise<void>;
      if (result && typeof result.catch === "function") {
        void result.catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  };

  const teardown = () => {
    stopped = true;
    connecting = false;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    destroyActive();
  };

  if (urls.length === 0) {
    console.warn(`[searcher] WSS ${chainId} kosong — scan event tidak dijalankan tanpa soket`);
    return teardown;
  }

  console.log(
    `[searcher] ${chainId} WSS Primary=${redactEndpoint(urls[0])}${
      urls[1] ? ` | Cadangan=${redactEndpoint(urls[1])}` : " | Cadangan belum diisi"
    }`
  );

  const noteWssDown = (reason: string) => {
    publishLiveSocket(chainId, "none", false);
    console.warn(`[searcher] ${reason} — tidak ada polling harga. Scan lanjut setelah WSS hidup.`);
  };

  const connectAt = async (index: number): Promise<boolean> => {
    if (stopped) return false;
    const url = urls[index];
    if (!url) return false;
    const role = index === 0 ? "Primary" : "Cadangan";
    try {
      const provider = new WebSocketProvider(url, networkId);
      if (stopped) {
        try {
          void provider.destroy();
        } catch {
          /* ignore */
        }
        return false;
      }
      active = provider;
      unbindScanner?.();
      unbindScanner = bindEventScanner(provider, chainId);
      attachSocketGuards(provider, (reason) => {
        if (stopped) return;
        console.warn(`[searcher] ${role} WSS gagal: ${reason}`);
        void failover(index, reason);
      });
      provider.on("block", (blockNumber: number) => {
        if (stopped) return;
        noteSearcherBlock(blockNumber, chainId);
      });
      markHealthyWss(chainId, url);
      publishLiveSocket(chainId, index === 0 ? "primary" : "backup", true);
      console.log(
        `[searcher] WebSocket ${role} aktif (${redactEndpoint(url)}) · cadangan pool lewat log Sync/Swap`
      );
      return true;
    } catch (error) {
      console.error(`[searcher] gagal buka WebSocket ${role} (${redactEndpoint(url)}): ${rpcErrorMessage(error)}`);
      return false;
    }
  };

  const failover = async (fromIndex: number, reason: string) => {
    if (stopped || connecting) return;
    connecting = true;
    destroyActive();
    noteWssDown(reason);

    for (let index = fromIndex + 1; index < urls.length; index += 1) {
      const role = index === 0 ? "Primary" : "Cadangan";
      console.warn(`[searcher] mengalihkan WSS ke ${role} (${redactEndpoint(urls[index])})`);
      if (await connectAt(index)) {
        connecting = false;
        return;
      }
    }

    console.error("[searcher] semua WSS gagal. Scan harga berhenti sampai soket tersambung lagi.");
    connecting = false;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      void reconnectFromPrimary();
    }, WSS_RETRY_MS);
  };

  const reconnectFromPrimary = async () => {
    if (stopped || connecting || active) return;
    connecting = true;
    console.log("[searcher] mencoba ulang WSS Primary...");
    for (let index = 0; index < urls.length; index += 1) {
      if (await connectAt(index)) {
        connecting = false;
        return;
      }
    }
    connecting = false;
    noteWssDown("ulang WSS masih gagal");
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      void reconnectFromPrimary();
    }, WSS_RETRY_MS);
  };

  void (async () => {
    for (let index = 0; index < urls.length; index += 1) {
      if (stopped) return;
      if (index > 0) {
        console.warn(`[searcher] Primary WSS tidak siap, coba Cadangan (${redactEndpoint(urls[index])})`);
      }
      if (await connectAt(index)) {
        return;
      }
    }
    if (stopped) return;
    noteWssDown("WSS Primary dan Cadangan tidak aktif");
    retryTimer = setTimeout(() => {
      void reconnectFromPrimary();
    }, WSS_RETRY_MS);
  })();

  return teardown;
}

let followedLock: ChainId | null = null;

function followSelectedChain(chainId: ChainId, reason: string): void {
  hydrateChainQuotaFromDisk();
  const sameSocket = monitorChain === chainId && (Boolean(stopChainWss) || !isWssAllowed(chainId));
  if (sameSocket) return;
  if (monitorChain && monitorChain !== chainId) {
    appendServerLog({
      level: "scan",
      source: "CHAIN",
      chainId,
      message: `Jaringan aktif beralih ke ${chainId}.`,
    });
  }
  hardAdoptScanChain(chainId, reason);
  syncChainSockets(chainId);
}

function authorityChain(): ChainId {
  const live = readLiveChain();
  if (live?.locked && live.source === "manual" && isTradingChainId(live.chainId)) return live.chainId;
  return "arbitrum";
}

export function startReserveMonitor(): void {
  console.log("[searcher] mode event: WSS block + log Sync/Swap · tanpa polling getReserves");
  void readBotState().then(async (state) => {
    const preferred = authorityChain();
    if (isTradingChainId(preferred) && normalizeTradingChainId(state.config.chainId) !== preferred) {
      await updateConfig({
        chainId: preferred,
        pairId: defaultPairForChain(preferred).id,
        activeDexIds: defaultDexIdsForChain(preferred),
      });
    }
    hardAdoptScanChain(preferred, "searcher-boot");
    hydrateChainQuotaFromDisk();
    const chainId = isWssAllowed(preferred) ? preferred : chainWithLiveWss(preferred);
    followedLock = chainId;
    if (isTradingChainId(chainId) && chainId === preferred) {
      const previous = readLiveChain();
      writeLiveChain({
        chainId,
        locked: true,
        connected: false,
        transport: previous?.chainId === chainId ? previous.transport : "none",
        source: "manual",
      });
    }
    followSelectedChain(chainId, "searcher-boot");
    console.log(
      `[searcher] gas strategy=${state.config.gasStrategyMode} live-network (tanpa plafon gwei) · chain=${chainId}`
    );
  });

  let applyTimer: ReturnType<typeof setTimeout> | undefined;
  let healTimer: ReturnType<typeof setTimeout> | undefined;
  watch(path.dirname(liveChainPath()), (_event, filename) => {
    if (filename === "bot-state.json") {
      if (healTimer) clearTimeout(healTimer);
      healTimer = setTimeout(() => {
        const live = readLiveChain();
        if (!live?.locked || live.source !== "manual" || !isTradingChainId(live.chainId)) return;
        void readBotState().then(async (state) => {
          if (normalizeTradingChainId(state.config.chainId) === live.chainId) return;
          console.warn(`[searcher] config disk ${state.config.chainId} ditolak · kunci tetap ${live.chainId}`);
          await updateConfig({
            chainId: live.chainId,
            pairId: defaultPairForChain(live.chainId).id,
            activeDexIds: defaultDexIdsForChain(live.chainId),
          });
        });
      }, 200);
      return;
    }
    if (filename && filename !== path.basename(liveChainPath())) return;
    if (applyTimer) clearTimeout(applyTimer);
    applyTimer = setTimeout(() => {
      const live = readLiveChain();
      if (!live?.locked || live.source !== "manual" || !isTradingChainId(live.chainId)) return;
      if (live.chainId === followedLock && monitorChain === live.chainId) return;
      followedLock = live.chainId;
      console.warn(`[searcher] kunci jaringan ${live.chainId}`);
      followSelectedChain(live.chainId, "user-lock");
    }, 200);
  });
}
