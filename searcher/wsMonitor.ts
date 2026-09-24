import { WebSocketProvider } from "ethers";
import {
  envArbitrumWsUrl,
  envEthereumWsUrl,
  envEthereumWsUrlFallback,
  envPolygonWsUrl,
  envPolygonWsUrlFallback,
} from "../config/networks";
import { getBlockNumber, redactEndpoint, rpcErrorMessage, rpcUrl } from "../lib/bot/rpc";
import { scanOpportunities } from "../lib/bot/scanner";
import { tryServerAutonomousTick } from "../lib/bot/autonomousExecute";
import { readBotState, writeBotState } from "../lib/bot/store";
import {
  markHealthyWss,
  uniqueUrls,
  wssCandidates,
  getChainNodeConfig,
} from "../lib/owner/nodeEndpoints";
import { getChain } from "../lib/chain/networks";
import type { ChainId } from "../lib/chain/networks";
import { normalizeTradingChainId } from "../config/networks";
import {
  maxOpportunitySpreadBps,
  resolveAdaptiveScanIntervalMs,
  formatAdaptiveScanPaceLine,
  isScanIdlePace,
} from "../lib/bot/autoExecute";
import { SCAN_INTERVAL_MS } from "../lib/bot/constants";
import { hardAdoptScanChain } from "../lib/bot/scanRuntime";
import { isScanRpcAllowed, isWssAllowed } from "../lib/owner/chainQuota";
import { hydrateChainQuotaFromDisk } from "../lib/owner/chainQuotaPersist";

const WSS_RETRY_MS = 12_000;
let lastSearchScanAt = 0;
let lastSearchIdlePace: boolean | null = null;
let monitorChain: ChainId | null = null;
let stopChainWss: (() => void) | null = null;

function tradingChainFromState(chainId: string | undefined): ChainId {
  return normalizeTradingChainId(chainId);
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

export async function tickScan(): Promise<void> {
  const state = await readBotState();
  if (state.killed) return;
  const chainId = tradingChainFromState(state.config.chainId);
  hydrateChainQuotaFromDisk();
  hardAdoptScanChain(chainId, "searcher");
  if (!isScanRpcAllowed(chainId)) return;
  syncChainSockets(chainId);
  const interval = resolveAdaptiveScanIntervalMs(
    state.config.minSpreadPct,
    maxOpportunitySpreadBps(state.opportunities)
  );
  const now = Date.now();
  if (lastSearchScanAt > 0 && now - lastSearchScanAt < interval) return;
  lastSearchScanAt = now;
  try {
    if (rpcUrl(chainId)) {
      const block = await getBlockNumber(undefined, chainId);
      await writeBotState({ ...state, lastBlock: block, lastError: undefined });
    }
    await scanOpportunities({
      scanMode: state.config.scanMode === "full" ? "full" : "single",
      pairIds:
        state.config.scanMode === "full"
          ? undefined
          : state.config.pairId
            ? [state.config.pairId]
            : undefined,
    });
    const latest = await readBotState();
    const maxSpreadBps = maxOpportunitySpreadBps(latest.opportunities);
    const nextInterval = resolveAdaptiveScanIntervalMs(latest.config.minSpreadPct, maxSpreadBps);
    const idle = isScanIdlePace(latest.config.minSpreadPct, maxSpreadBps);
    if (lastSearchIdlePace !== idle) {
      lastSearchIdlePace = idle;
      console.log(
        formatAdaptiveScanPaceLine({
          minSpreadPct: latest.config.minSpreadPct,
          maxSpreadBps,
          intervalMs: nextInterval,
        })
      );
    }
    await tryServerAutonomousTick();
  } catch (error) {
    if ((error as { name?: string })?.name === "ScanRuntimeAbortError") return;
    const message = error instanceof Error ? error.message : "scan gagal";
    await writeBotState({ ...(await readBotState()), lastError: message });
  }
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

function startAdaptiveHttpLoop(): void {
  const loop = async () => {
    await tickScan();
    const latest = await readBotState();
    const wait = resolveAdaptiveScanIntervalMs(
      latest.config.minSpreadPct,
      maxOpportunitySpreadBps(latest.opportunities)
    );
    setTimeout(() => void loop(), wait);
  };
  void loop();
}

function syncChainSockets(chainId: ChainId): void {
  if (!isWssAllowed(chainId)) {
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
  lastSearchIdlePace = null;
  monitorChain = chainId;
  stopChainWss = attachChainWss(chainId);
}

function attachChainWss(chainId: ChainId): () => void {
  const networkId = getChain(chainId).chainId ?? (chainId === "ethereum" ? 1 : chainId === "polygon" ? 137 : 42161);
  const urls = wssUrls(chainId);
  let stopped = false;
  let active: WebSocketProvider | null = null;
  let connecting = false;
  let httpTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const stopHttpScan = () => {
    if (!httpTimer) return;
    clearTimeout(httpTimer);
    httpTimer = null;
  };

  const destroyActive = () => {
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
    stopHttpScan();
    destroyActive();
  };

  if (urls.length === 0) {
    console.warn(`[searcher] WSS ${chainId} kosong — tetap pakai scan HTTP adaptif`);
    return teardown;
  }

  console.log(
    `[searcher] ${chainId} WSS Primary=${redactEndpoint(urls[0])}${
      urls[1] ? ` | Cadangan=${redactEndpoint(urls[1])}` : " | Cadangan belum diisi"
    }`
  );

  const ensureHttpScan = (reason: string) => {
    if (stopped || httpTimer) return;
    console.warn(
      `[searcher] ${reason} — fallback HTTP adaptif (1000 ms / 100–200 ms). Scanning tetap berjalan.`
    );
    const loop = async () => {
      if (!httpTimer || stopped) return;
      await tickScan();
      const latest = await readBotState();
      const wait = resolveAdaptiveScanIntervalMs(
        latest.config.minSpreadPct,
        maxOpportunitySpreadBps(latest.opportunities)
      );
      httpTimer = setTimeout(() => void loop(), wait);
    };
    httpTimer = setTimeout(() => void loop(), SCAN_INTERVAL_MS);
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
      attachSocketGuards(provider, (reason) => {
        if (stopped) return;
        console.warn(`[searcher] ${role} WSS gagal: ${reason}`);
        void failover(index, reason);
      });
      provider.on("block", () => {
        if (stopped) return;
        void tickScan();
      });
      markHealthyWss(chainId, url);
      stopHttpScan();
      console.log(
        `[searcher] WebSocket ${role} aktif (${redactEndpoint(url)}) · scan HTTP adaptif tetap jalan`
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
    ensureHttpScan(reason);

    for (let index = fromIndex + 1; index < urls.length; index += 1) {
      const role = index === 0 ? "Primary" : "Cadangan";
      console.warn(`[searcher] mengalihkan WSS ke ${role} (${redactEndpoint(urls[index])})`);
      if (await connectAt(index)) {
        connecting = false;
        return;
      }
    }

    console.error("[searcher] semua WSS gagal. HTTP scan tetap jalan, akan coba ulang WSS.");
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
    ensureHttpScan("ulang WSS masih gagal");
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
    ensureHttpScan("WSS Primary dan Cadangan tidak aktif");
    retryTimer = setTimeout(() => {
      void reconnectFromPrimary();
    }, WSS_RETRY_MS);
  })();

  return teardown;
}

export function startReserveMonitor(): void {
  console.log(
    "[searcher] scan HTTP adaptif: 1000 ms jika max spread < min−0.1% / belum > setting, else 100–200 ms · Strict Single-Chain"
  );
  startAdaptiveHttpLoop();
  void readBotState().then((state) => {
    const chainId = tradingChainFromState(state.config.chainId);
    hardAdoptScanChain(chainId, "searcher-boot");
    syncChainSockets(chainId);
    console.log(
      `[searcher] gas strategy=${state.config.gasStrategyMode} live-network (tanpa plafon gwei) · chain=${chainId}`
    );
  });
}
