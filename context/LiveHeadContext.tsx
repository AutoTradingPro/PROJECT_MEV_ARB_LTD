"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRpcLiveFeed } from "@/context/RpcLiveFeedContext";
import { isBlockmachineHost } from "@/config/blockmachine";
import { useNetwork } from "@/context/NetworkContext";
import { useSandbox } from "@/context/SandboxContext";
import { useBotConfig } from "@/context/BotConfigContext";
import { isTradingChainId } from "@/config/networks";
import { parseBlockNumber } from "@/lib/chain/publicEnv";
import { type ChainId, resolveChainWs } from "@/lib/chain/networks";
import { isOwnerNodeChainId } from "@/lib/owner/ownerNodeChains";
import { isRedactedUrl } from "@/lib/security/redactUrl";
import { SCAN_IDLE_INTERVAL_MS } from "@/lib/bot/constants";
import { hasActiveFlashLoanProvider } from "@/lib/bot/flashLoanProviders";

export interface LiveHead {
  blockNumber: number;
  transport: "ws" | "http" | "offline";
  tickMs: number;
  setScanPaceMs: (ms: number) => void;
  applyLiveBlock: (block: number) => void;
}

interface HeadPayload {
  block?: number;
}

const LiveHeadContext = createContext<LiveHead | null>(null);

function sessionChain(chainId: ChainId): ChainId {
  const raw = (process.env.NEXT_PUBLIC_SCANNER_LOCK_CHAIN || "").trim().toLowerCase();
  return isTradingChainId(raw) ? raw : chainId;
}

function clampScanPace(ms: number): number {
  if (!Number.isFinite(ms) || ms < 100) return SCAN_IDLE_INTERVAL_MS;
  return Math.min(5_000, Math.max(100, Math.round(ms)));
}

function headPollDelayMs(chainId: ChainId, tickMs: number): number {
  if (chainId === "solana") {
    const tick = Number.isFinite(tickMs) ? tickMs : 800;
    return Math.max(400, Math.min(2_000, tick));
  }
  const floor = chainId === "ethereum" ? 4_000 : 2_000;
  const tick = Number.isFinite(tickMs) ? tickMs : floor;
  return Math.max(floor, Math.min(12_000, tick));
}

/** Terima blok baru, atau ganti total jika sisa rantai lain (ETH vs Polygon vs Arb). */
function pickHeadBlock(prev: number, next: number): number {
  if (next <= 0) return prev;
  if (prev <= 0) return next;
  if (Math.abs(next - prev) > 500_000) return next;
  return next >= prev ? next : prev;
}

async function fetchHeadFromApi(chainId: ChainId): Promise<HeadPayload | null> {
  const res = await fetch(`/api/chain/head?chain=${chainId}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as HeadPayload;
}

function closeSocket(socket: WebSocket | null): void {
  if (!socket) return;
  try {
    socket.close();
  } catch {
    /* ignore */
  }
}

function clientWsAllowed(url: string, chainId?: ChainId): boolean {
  if (!url || isRedactedUrl(url)) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (isBlockmachineHost(host)) return false;
    // Ankr Solana WSS diizinkan untuk slotSubscribe; Ankr EVM tetap ditahan (browser).
    if (host.includes("ankr.com")) return chainId === "solana";
    if (host.includes("alchemy.com")) return false;
    return true;
  } catch {
    return false;
  }
}

/** Setelah head gagal, tetap hijau sebentar supaya rate-limit tidak flicker merah. */
const OFFLINE_GRACE_MS = 20_000;

function useLiveBlockFeed(chainId: ChainId, evm: boolean, enabled = true): LiveHead {
  const { wssEnabled, rpcFallbackEnabled, chains } = useRpcLiveFeed();
  const activeChain = sessionChain(chainId);
  const solanaLive = activeChain === "solana";
  const feedEnabled = enabled && (evm || solanaLive);
  const chainFeedOn = isOwnerNodeChainId(activeChain) ? chains[activeChain] === true : true;
  const feedKey = `${wssEnabled ? 1 : 0}:${rpcFallbackEnabled ? 1 : 0}:${chainFeedOn ? 1 : 0}`;
  const { hydrated } = useNetwork();
  const { isSandbox } = useSandbox();
  const [blockNumber, setBlockNumber] = useState(0);
  const [transport, setTransport] = useState<LiveHead["transport"]>("offline");
  const [tickMs, setTickMs] = useState(SCAN_IDLE_INTERVAL_MS);
  const tickMsRef = useRef(SCAN_IDLE_INTERVAL_MS);
  const socketRef = useRef<WebSocket | null>(null);
  const restartPollRef = useRef<() => void>(() => {});
  const lastGoodAtRef = useRef(0);
  const prevChainRef = useRef(activeChain);

  const applyLiveBlock = useCallback((block: number) => {
    const next = parseBlockNumber(block);
    if (next <= 0) return;
    lastGoodAtRef.current = Date.now();
    setBlockNumber((prev) => pickHeadBlock(prev, next));
    setTransport((current) => (current === "offline" ? "http" : current));
  }, []);

  const setScanPaceMs = useCallback((ms: number) => {
    const next = clampScanPace(ms);
    const changed = tickMsRef.current !== next;
    tickMsRef.current = next;
    setTickMs((prev) => (prev === next ? prev : next));
    if (changed) restartPollRef.current();
  }, []);

  useEffect(() => {
    tickMsRef.current = solanaLive ? 800 : SCAN_IDLE_INTERVAL_MS;
    setTickMs(solanaLive ? 800 : SCAN_IDLE_INTERVAL_MS);
  }, [activeChain, solanaLive]);

  useEffect(() => {
    let stopped = false;
    if (prevChainRef.current !== activeChain) {
      prevChainRef.current = activeChain;
      setBlockNumber(0);
      setTransport("offline");
      lastGoodAtRef.current = 0;
    }
    closeSocket(socketRef.current);
    socketRef.current = null;

    if (!feedEnabled || !hydrated) {
      setTransport("offline");
      return () => {
        stopped = true;
      };
    }

    /** Tunggu flag backend supaya jaringan OFF tidak di-poll. */
    let pollRealHead = false;
    let allowWs = false;
    let missStreak = 0;

    let wsUrl = resolveChainWs(activeChain);
    const applyBlock = (next: number, nextTransport: LiveHead["transport"]) => {
      if (stopped || next <= 0) return;
      missStreak = 0;
      lastGoodAtRef.current = Date.now();
      setBlockNumber((prev) => pickHeadBlock(prev, next));
      setTransport((current) => {
        if (current === "ws" && nextTransport === "http") return current;
        return nextTransport;
      });
    };

    const markDegraded = () => {
      if (stopped) return;
      missStreak += 1;
      const fresh = Date.now() - lastGoodAtRef.current < OFFLINE_GRACE_MS;
      if (fresh || missStreak < 2) return;
      setTransport((current) => (current === "ws" ? current : "offline"));
    };

    const pollHttp = async () => {
      if (!pollRealHead) return;
      try {
        const head = await fetchHeadFromApi(activeChain);
        const next = parseBlockNumber(head?.block);
        if (next > 0) applyBlock(next, "http");
        else markDegraded();
      } catch {
        markDegraded();
      }
    };

    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let openWatch: number | undefined;
    const schedulePoll = () => {
      if (stopped || !pollRealHead) return;
      pollTimer = setTimeout(() => {
        void (async () => {
          await pollHttp();
          schedulePoll();
        })();
      }, headPollDelayMs(activeChain, tickMsRef.current));
    };
    restartPollRef.current = () => {
      if (stopped || !pollRealHead) return;
      if (pollTimer !== undefined) clearTimeout(pollTimer);
      void (async () => {
        await pollHttp();
        schedulePoll();
      })();
    };

    const connectWs = (url: string) => {
      if (isSandbox || !allowWs || !clientWsAllowed(url, activeChain)) return;
      try {
        const socket = new WebSocket(url);
        socketRef.current = socket;
        socket.addEventListener("open", () => {
          if (openWatch !== undefined) window.clearTimeout(openWatch);
          if (solanaLive) {
            socket.send(
              JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "slotSubscribe",
                params: [],
              })
            );
          } else {
            socket.send(
              JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_subscribe",
                params: ["newHeads"],
              })
            );
          }
        });
        socket.addEventListener("message", (event) => {
          try {
            const payload = JSON.parse(String(event.data)) as {
              method?: string;
              params?: {
                result?: { number?: string; slot?: number } | number;
              };
            };
            if (solanaLive) {
              if (payload.method && payload.method !== "slotNotification") return;
              const result = payload.params?.result;
              const next =
                typeof result === "number"
                  ? result
                  : result && typeof result === "object" && typeof result.slot === "number"
                    ? result.slot
                    : 0;
              if (next > 0) applyBlock(next, "ws");
              return;
            }
            const hex =
              payload.params?.result && typeof payload.params.result === "object"
                ? payload.params.result.number
                : undefined;
            const next = parseBlockNumber(hex);
            if (next > 0) applyBlock(next, "ws");
          } catch {
            /* ignore */
          }
        });
        socket.addEventListener("close", () => {
          socketRef.current = null;
        });
        socket.addEventListener("error", () => {
          closeSocket(socket);
        });
        openWatch = window.setTimeout(() => {
          if (stopped) return;
          if (socket.readyState !== WebSocket.OPEN) closeSocket(socket);
        }, 2500);
      } catch {
        /* HTTP poll tetap sumber utama */
      }
    };

    void fetch(`/api/chain/endpoints?chain=${activeChain}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as {
          wss?: string;
          backupWss?: string;
          wssLive?: boolean;
          rpcLive?: boolean;
        };
        if (stopped) return;
        pollRealHead = !isSandbox && data.rpcLive === true;
        allowWs = !isSandbox && data.wssLive === true;
        if (!pollRealHead) {
          if (pollTimer !== undefined) {
            clearTimeout(pollTimer);
            pollTimer = undefined;
          }
          setTransport("offline");
        }
        const candidate = data.wss || data.backupWss || wsUrl;
        // Endpoint API sering di-redact — untuk Solana pakai resolveChainWs client-side bila perlu.
        wsUrl = clientWsAllowed(candidate, activeChain)
          ? candidate
          : solanaLive
            ? resolveChainWs(activeChain)
            : resolveChainWs(activeChain);
        if (!clientWsAllowed(wsUrl, activeChain) || !allowWs) wsUrl = "";
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        if (stopped) return;
        if (pollRealHead) {
          void pollHttp();
          schedulePoll();
        }
        if (allowWs) connectWs(wsUrl);
        else closeSocket(socketRef.current);
      });

    return () => {
      stopped = true;
      if (openWatch !== undefined) window.clearTimeout(openWatch);
      if (pollTimer !== undefined) clearTimeout(pollTimer);
      restartPollRef.current = () => {};
      closeSocket(socketRef.current);
      socketRef.current = null;
    };
  }, [activeChain, feedEnabled, hydrated, enabled, feedKey, isSandbox, solanaLive]);

  return useMemo(
    () => ({ blockNumber, transport, tickMs, setScanPaceMs, applyLiveBlock }),
    [blockNumber, transport, tickMs, setScanPaceMs, applyLiveBlock]
  );
}

export function LiveHeadProvider({ children }: { children: ReactNode }) {
  const { chain, chainId } = useNetwork();
  const { config, hydrated } = useBotConfig();
  const flashActive = hasActiveFlashLoanProvider(config.flashLoanPlatforms);
  // Tanpa FlashLoan Provider aktif → RPC/WSS head idle (hemat kuota).
  const head = useLiveBlockFeed(
    chainId,
    chain.evm || chainId === "solana",
    hydrated && flashActive
  );
  return <LiveHeadContext.Provider value={head}>{children}</LiveHeadContext.Provider>;
}

export function useSharedLiveHead(): LiveHead | null {
  return useContext(LiveHeadContext);
}

/** Header, P&L, dan log scan memakai instance live head yang sama. */
export function useLiveBlock(chainId: ChainId, evmHint = true): LiveHead {
  const shared = useSharedLiveHead();
  const enableFeed = evmHint || chainId === "solana";
  const local = useLiveBlockFeed(chainId, enableFeed, shared == null);
  return shared ?? local;
}
