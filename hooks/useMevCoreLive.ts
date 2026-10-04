"use client";

import { useEffect, useMemo, useState } from "react";
import type { ConsoleLine, FeedRow } from "@/components/mev-core/types";
import type { LiveServerMessage } from "@/lib/bot/liveTypes";

const LIVE_URL = "ws://127.0.0.1:4101";

function sameChain(chainId: string | undefined, selected: string): boolean {
  return Boolean(selected) && chainId === selected;
}

export function useMevCoreLive(chainId: string) {
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [logs, setLogs] = useState<ConsoleLine[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let stopped = false;
    let timer = 0;

    const connect = () => {
      if (stopped) return;
      socket = new WebSocket(LIVE_URL);
      socket.onopen = () => setConnected(true);
      socket.onmessage = (event) => {
        let message: LiveServerMessage;
        try {
          message = JSON.parse(String(event.data)) as LiveServerMessage;
        } catch {
          return;
        }
        if (message.type === "ARBITRAGE_FEED") {
          setFeed(message.rows);
          return;
        }
        if (message.type === "CONSOLE_LOG") {
          setLogs((current) => [message.line, ...current].slice(0, 40));
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!stopped) timer = window.setTimeout(connect, 1500);
      };
      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      socket?.close();
    };
  }, []);

  const rows = useMemo(
    () => feed.filter((row) => sameChain(row.chainId, chainId)),
    [feed, chainId]
  );
  const lines = useMemo(
    () => logs.filter((line) => !line.chainId || sameChain(line.chainId, chainId)),
    [logs, chainId]
  );

  return { rows, lines, connected };
}
