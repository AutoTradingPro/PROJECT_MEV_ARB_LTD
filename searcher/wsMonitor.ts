import { watch } from "node:fs";
import path from "node:path";
import { JsonRpcProvider, WebSocketProvider } from "ethers";
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

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const FAILURES_BEFORE_SWITCH = 3;
const HEARTBEAT_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;
const HTTP_PROMOTE_MS = 60_000;
const OPEN_TIMEOUT_MS = 8_000;

function backoffMs(attempt: number): number {
  const step = Math.max(0, attempt - 1);
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.min(step, 8));
}
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
  if (chainId === "bsc") {
    const env = uniqueUrls([
      process.env.RPC_WSS_URL || "",
      process.env.NEXT_PUBLIC_BSC_WS_URL || "",
      process.env.RPC_WSS_URL_2 || "",
      process.env.NEXT_PUBLIC_BSC_WS_URL_2 || "",
    ]);
    if (env.length > 0) return env;
    return wssCandidates("bsc");
  }
  return uniqueUrls([getChain(chainId).wsUrl || "", ...wssCandidates(chainId)]);
}

type RpcEndpoint = { url: string; transport: "wss" | "http" };

function endpointList(chainId: ChainId): RpcEndpoint[] {
  const chain = getChain(chainId);
  const row = getChainNodeConfig(chainId);
  const sockets = wssUrls(chainId);
  const http = uniqueUrls([row.primaryRpc, row.backupRpc, chain.rpcUrl || ""]);
  const seen = new Set(sockets.map((url) => url.replace(/\/$/, "").toLowerCase()));
  const list: RpcEndpoint[] = sockets.map((url) => ({ url, transport: "wss" }));
  for (const url of http) {
    const key = url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ url, transport: "http" });
  }
  return list;
}

function endpointRole(index: number): string {
  return index === 0 ? "Primary" : `Cadangan ${index}`;
}

type SocketLike = {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  addEventListener?: (event: string, listener: (ev: Event) => void) => void;
  ping?: () => void;
  readyState?: number;
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
  const endpoints = endpointList(chainId);
  let stopped = false;
  let active: WebSocketProvider | JsonRpcProvider | null = null;
  let activeKind: "wss" | "http" | null = null;
  let endpointIndex = 0;
  let failCount = 0;
  let recoveryQueued = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let promoteTimer: ReturnType<typeof setTimeout> | null = null;
  let stopHeartbeat: (() => void) | null = null;
  let unbindScanner: (() => void) | null = null;

  const clearTimers = () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (promoteTimer) clearTimeout(promoteTimer);
    retryTimer = null;
    promoteTimer = null;
    stopHeartbeat?.();
    stopHeartbeat = null;
  };

  const destroyActive = () => {
    unbindScanner?.();
    unbindScanner = null;
    stopHeartbeat?.();
    stopHeartbeat = null;
    const current = active;
    active = null;
    activeKind = null;
    if (!current) return;
    try {
      current.removeAllListeners();
    } catch {
      /* ignore */
    }
    const socket = (current as WebSocketProvider).websocket as
      | { removeAllListeners?: () => void; close?: (code?: number) => void }
      | undefined;
    try {
      socket?.removeAllListeners?.();
      socket?.close?.(1000);
    } catch {
      /* ignore */
    }
    try {
      const result = current.destroy() as void | Promise<void>;
      if (result && typeof result.catch === "function") void result.catch(() => undefined);
    } catch {
      /* ignore */
    }
  };

  const teardown = () => {
    stopped = true;
    recoveryQueued = false;
    clearTimers();
    destroyActive();
  };

  if (endpoints.length === 0) {
    console.warn(`[searcher] WSS ${chainId} kosong — scan event tidak dijalankan tanpa soket`);
    return teardown;
  }

  console.log(
    `[searcher] ${chainId} antrian RPC ${endpoints
      .map((item, index) => `${endpointRole(index)} ${item.transport.toUpperCase()} ${redactEndpoint(item.url)}`)
      .join(" | ")}`
  );

  const armPromote = () => {
    if (promoteTimer) clearTimeout(promoteTimer);
    promoteTimer = setTimeout(() => {
      void tryPromoteToWss();
    }, HTTP_PROMOTE_MS);
  };

  const startHeartbeat = (provider: WebSocketProvider | JsonRpcProvider, kind: "wss" | "http") => {
    stopHeartbeat?.();
    let pongTimer: ReturnType<typeof setTimeout> | null = null;
    const socket = kind === "wss" ? ((provider as WebSocketProvider).websocket as SocketLike | undefined) : undefined;
    const clearPong = () => {
      if (pongTimer) clearTimeout(pongTimer);
      pongTimer = null;
    };
    if (typeof socket?.on === "function") {
      socket.on("pong", () => clearPong());
    }
    const beat = setInterval(() => {
      if (stopped || active !== provider) return;
      if (kind === "wss" && typeof socket?.ping === "function" && socket.readyState === 1) {
        try {
          socket.ping();
          clearPong();
          pongTimer = setTimeout(() => {
            if (active !== provider) return;
            void provider.getBlockNumber().catch(() => {
              if (active === provider) queueRecovery("heartbeat tanpa pong");
            });
          }, PONG_TIMEOUT_MS);
        } catch {
          queueRecovery("ping gagal");
        }
        return;
      }
      void provider.getBlockNumber().catch(() => {
        if (active === provider) queueRecovery("heartbeat rpc gagal");
      });
    }, HEARTBEAT_MS);
    stopHeartbeat = () => {
      clearInterval(beat);
      clearPong();
    };
  };

  const noteDown = (reason: string, delay: number) => {
    publishLiveSocket(chainId, "none", false);
    console.warn(
      `[searcher] ${reason}. Engine tetap berjalan. Sambung ulang dalam ${Math.round(delay / 1000)}s.`
    );
  };

  const queueRecovery = (reason: string) => {
    if (stopped || recoveryQueued) return;
    recoveryQueued = true;
    destroyActive();
    failCount += 1;
    let delay = backoffMs(failCount);
    const current = endpoints[endpointIndex];
    if (failCount >= FAILURES_BEFORE_SWITCH && endpoints.length > 1) {
      const previous = endpointRole(endpointIndex);
      failCount = 0;
      endpointIndex = (endpointIndex + 1) % endpoints.length;
      delay = backoffMs(1);
      const next = endpoints[endpointIndex];
      console.warn(
        `[searcher] ${previous} gagal ${FAILURES_BEFORE_SWITCH} kali. Alih ke ${endpointRole(endpointIndex)} ${next.transport.toUpperCase()} (${redactEndpoint(next.url)}).`
      );
    } else if (current) {
      console.warn(
        `[searcher] ${endpointRole(endpointIndex)} putus (${failCount}/${FAILURES_BEFORE_SWITCH}): ${reason}`
      );
    }
    noteDown(reason, delay);
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      recoveryQueued = false;
      retryTimer = null;
      void connectCurrent();
    }, delay);
  };

  const openReady = async (provider: WebSocketProvider | JsonRpcProvider): Promise<boolean> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout buka RPC")), OPEN_TIMEOUT_MS);
        }),
      ]);
      return true;
    } catch (error) {
      console.error(`[searcher] RPC belum siap: ${rpcErrorMessage(error)}`);
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const connectAt = async (index: number): Promise<boolean> => {
    if (stopped) return false;
    const endpoint = endpoints[index];
    if (!endpoint) return false;
    const role = endpointRole(index);
    try {
      if (endpoint.transport === "http") {
        const provider = new JsonRpcProvider(endpoint.url, networkId);
        if (stopped) {
          void provider.destroy();
          return false;
        }
        active = provider;
        activeKind = "http";
        provider.on("error", (error: unknown) => {
          if (active !== provider) return;
          queueRecovery(rpcErrorMessage(error) || "HTTP RPC error");
        });
        if (!(await openReady(provider))) {
          if (active === provider) destroyActive();
          return false;
        }
        if (stopped || active !== provider) return false;
        provider.on("block", (blockNumber: number) => {
          if (stopped || active !== provider) return;
          noteSearcherBlock(blockNumber, chainId);
        });
        startHeartbeat(provider, "http");
        failCount = 0;
        publishLiveSocket(chainId, index === 0 ? "primary" : "backup", true);
        console.warn(
          `[searcher] HTTP ${role} aktif (${redactEndpoint(endpoint.url)}). Blok tetap mengalir. WSS dicoba lagi otomatis.`
        );
        armPromote();
        return true;
      }

      const provider = new WebSocketProvider(endpoint.url, networkId);
      if (stopped) {
        void provider.destroy();
        return false;
      }
      active = provider;
      activeKind = "wss";
      attachSocketGuards(provider, (reason) => {
        if (stopped || active !== provider) return;
        queueRecovery(reason);
      });
      if (!(await openReady(provider))) {
        if (active === provider) destroyActive();
        return false;
      }
      if (stopped || active !== provider) return false;
      unbindScanner?.();
      unbindScanner = bindEventScanner(provider, chainId);
      provider.on("block", (blockNumber: number) => {
        if (stopped || active !== provider) return;
        noteSearcherBlock(blockNumber, chainId);
      });
      startHeartbeat(provider, "wss");
      markHealthyWss(chainId, endpoint.url);
      publishLiveSocket(chainId, index === 0 ? "primary" : "backup", true);
      failCount = 0;
      console.log(
        `[searcher] WebSocket ${role} aktif (${redactEndpoint(endpoint.url)}) · ping ${HEARTBEAT_MS / 1000}s · cadangan pool lewat log Sync/Swap`
      );
      return true;
    } catch (error) {
      console.error(
        `[searcher] gagal buka ${role} (${redactEndpoint(endpoint.url)}): ${rpcErrorMessage(error)}`
      );
      if (active) destroyActive();
      return false;
    }
  };

  const connectCurrent = async () => {
    if (stopped || recoveryQueued || active) return;
    const ok = await connectAt(endpointIndex);
    if (!ok && !stopped && !recoveryQueued && !active) {
      queueRecovery("gagal membuka soket");
    }
  };

  const tryPromoteToWss = async () => {
    if (stopped || activeKind !== "http" || recoveryQueued) return;
    const wssIndex = endpoints.findIndex((item) => item.transport === "wss");
    if (wssIndex < 0) return;
    console.log(`[searcher] mencoba naik lagi ke WSS ${endpointRole(wssIndex)}`);
    const previous = active;
    const probe = new WebSocketProvider(endpoints[wssIndex].url, networkId);
    let ready = false;
    try {
      ready = await openReady(probe);
    } catch {
      ready = false;
    }
    if (!ready || stopped || active !== previous || activeKind !== "http") {
      try {
        void probe.destroy();
      } catch {
        /* ignore */
      }
      if (!stopped && activeKind === "http") armPromote();
      return;
    }
    destroyActive();
    endpointIndex = wssIndex;
    failCount = 0;
    active = probe;
    activeKind = "wss";
    attachSocketGuards(probe, (reason) => {
      if (stopped || active !== probe) return;
      queueRecovery(reason);
    });
    unbindScanner = bindEventScanner(probe, chainId);
    probe.on("block", (blockNumber: number) => {
      if (stopped || active !== probe) return;
      noteSearcherBlock(blockNumber, chainId);
    });
    startHeartbeat(probe, "wss");
    markHealthyWss(chainId, endpoints[wssIndex].url);
    publishLiveSocket(chainId, wssIndex === 0 ? "primary" : "backup", true);
    console.log(`[searcher] WSS ${endpointRole(wssIndex)} pulih (${redactEndpoint(endpoints[wssIndex].url)})`);
  };

  void connectCurrent();
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
