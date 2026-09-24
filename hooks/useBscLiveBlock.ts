"use client";

import { useEffect, useRef, useState } from "react";
import { useRpcLiveFeed } from "@/context/RpcLiveFeedContext";
import { isBlockmachineHost } from "@/config/blockmachine";
import { parseHexBlock, publicBscWsUrl } from "@/lib/chain/publicEnv";

export interface BscLiveHead {
  blockNumber: number;
  transport: "ws" | "http" | "offline";
}

interface HeadPayload {
  block?: number;
  gasPriceWei?: string;
}

async function fetchHeadFromApi(): Promise<HeadPayload | null> {
  const res = await fetch("/api/chain/head?chain=polygon", { cache: "no-store" });
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

export function useBscLiveBlock(): BscLiveHead {
  const { wssEnabled, rpcFallbackEnabled } = useRpcLiveFeed();
  const [blockNumber, setBlockNumber] = useState(0);
  const [transport, setTransport] = useState<BscLiveHead["transport"]>("offline");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let stopped = false;
    setTransport("offline");
    closeSocket(socketRef.current);
    socketRef.current = null;

    if (!wssEnabled && !rpcFallbackEnabled) {
      return () => {
        stopped = true;
      };
    }

    const wsUrl = publicBscWsUrl();
    const allowDirectWs = (() => {
      if (!wsUrl) return false;
      try {
        return !isBlockmachineHost(new URL(wsUrl).hostname);
      } catch {
        return false;
      }
    })();

    const applyBlock = (next: number, nextTransport: BscLiveHead["transport"]) => {
      if (stopped || next <= 0) return;
      setBlockNumber(next);
      setTransport(nextTransport);
    };

    const pollHttp = async () => {
      try {
        const head = await fetchHeadFromApi();
        if (head?.block) applyBlock(head.block, "http");
      } catch {
        if (!stopped) setTransport((current) => (current === "ws" ? current : "offline"));
      }
    };

    let pollId: number | undefined;
    const startHttpFallback = () => {
      if (!rpcFallbackEnabled || pollId !== undefined) return;
      void pollHttp();
      pollId = window.setInterval(() => {
        void pollHttp();
      }, 4000);
    };

    if (wssEnabled && allowDirectWs) {
      try {
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        socket.addEventListener("open", () => {
          socket.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_subscribe",
              params: ["newHeads"],
            })
          );
          if (!stopped) setTransport("ws");
        });
        socket.addEventListener("message", (event) => {
          try {
            const payload = JSON.parse(String(event.data)) as {
              params?: { result?: { number?: string } };
              result?: string;
            };
            const headNumber = payload.params?.result?.number;
            if (!headNumber) return;
            const next = parseHexBlock(headNumber);
            applyBlock(next, "ws");
          } catch {
            /* ignore malformed frames */
          }
        });
        socket.addEventListener("close", () => {
          socketRef.current = null;
          if (!stopped) startHttpFallback();
        });
      } catch {
        startHttpFallback();
      }
    } else {
      startHttpFallback();
    }

    return () => {
      stopped = true;
      if (pollId !== undefined) window.clearInterval(pollId);
      closeSocket(socketRef.current);
      socketRef.current = null;
    };
  }, [wssEnabled, rpcFallbackEnabled]);

  return { blockNumber, transport };
}
