"use client";

import { useEffect, useRef, useState } from "react";
import { useRpcLiveFeed } from "@/context/RpcLiveFeedContext";
import { useNetwork } from "@/context/NetworkContext";
import { isTradingChainId } from "@/config/networks";
import type { ChainId } from "@/lib/chain/networks";

const POLL_MS = 5000;

interface HeadPayload {
  block?: number;
  gasPriceWei?: string;
  live?: boolean;
}

export interface LiveNetworkFees {
  gasPriceWei: string;
  blockNumber: number;
  live: boolean;
}

/**
 * Poling ringan ke /api/chain/head (RPC primary→backup owner).
 * Tidak memicu scan bot; overlap request dilewati.
 */
export function useLiveNetworkFees(chainId: ChainId, evm: boolean): LiveNetworkFees {
  const { wssEnabled, rpcFallbackEnabled, chains } = useRpcLiveFeed();
  const { hydrated } = useNetwork();
  const networkOn = wssEnabled || rpcFallbackEnabled || Object.values(chains).some(Boolean);
  const activeChain = (() => {
    const raw = (process.env.NEXT_PUBLIC_SCANNER_LOCK_CHAIN || "").trim().toLowerCase();
    return isTradingChainId(raw) ? raw : chainId;
  })();
  const supportsFees = evm || activeChain === "solana";
  const [gasPriceWei, setGasPriceWei] = useState("0");
  const [blockNumber, setBlockNumber] = useState(0);
  const [live, setLive] = useState(false);
  const inflight = useRef(false);

  useEffect(() => {
    setGasPriceWei("0");
    setBlockNumber(0);
    setLive(false);
  }, [activeChain]);

  useEffect(() => {
    if (!hydrated || !supportsFees || !networkOn) {
      setLive(false);
      return;
    }

    let stopped = false;

    const tick = async () => {
      if (stopped || inflight.current) return;
      inflight.current = true;
      try {
        const response = await fetch(`/api/chain/head?chain=${activeChain}`, { cache: "no-store" });
        const data = (await response.json()) as HeadPayload;
        if (stopped) return;
        const wei = typeof data.gasPriceWei === "string" ? data.gasPriceWei : "0";
        let parsed = 0n;
        try {
          parsed = BigInt(wei);
        } catch {
          parsed = 0n;
        }
        if (parsed > 0n) {
          setGasPriceWei(wei);
          setLive(true);
        } else if (activeChain === "solana" && data.block && data.block > 0) {
          // Slot live tapi fee belum — jaga fallback agar auto-exec tidak tertahan.
          setGasPriceWei((prev) => (prev !== "0" ? prev : "50000"));
          setLive(true);
        }
        if (data.block && data.block > 0) setBlockNumber(data.block);
      } catch {
        /* jaga nilai gas terakhir; jangan ganggu UI/scan */
      } finally {
        inflight.current = false;
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [activeChain, supportsFees, hydrated, networkOn, chains]);

  return { gasPriceWei, blockNumber, live };
}
