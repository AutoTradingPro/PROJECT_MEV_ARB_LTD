/**
 * Solana executor — QuickNode Dedicated RPC/WSS (broadcast + slot monitor).
 * Terpisah dari Ankr scanner di lib/bot/solana/scanner.ts.
 */
import { envSolanaExecutorRpcUrl, envSolanaExecutorWsUrl } from "@/config/networks";
import {
  privateExecutorRpcUrl,
  privateExecutorWsUrl,
  requireExecutorRpcUrl,
} from "@/lib/bot/dualProvider";
import { redactEndpoint } from "@/lib/bot/rpc";

export function solanaExecutorRpcUrl(): string {
  return privateExecutorRpcUrl("solana") || envSolanaExecutorRpcUrl();
}

export function solanaExecutorWsUrl(): string {
  return privateExecutorWsUrl("solana") || envSolanaExecutorWsUrl();
}

export function requireSolanaExecutorRpcUrl(): string {
  return requireExecutorRpcUrl("solana");
}

/** JSON-RPC ke QuickNode Solana executor (HTTP). */
export async function solanaExecutorRpc<T = unknown>(
  method: string,
  params: unknown[] = []
): Promise<T> {
  const url = requireSolanaExecutorRpcUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const json = (await res.json()) as { result?: T; error?: { message?: string } };
  if (json.error?.message) throw new Error(json.error.message);
  return json.result as T;
}

/**
 * Kirim transaksi Solana yang sudah ditandatangani (base64) via QuickNode.
 */
export async function submitSolanaSignedTx(
  signedTxBase64: string,
  options?: { skipPreflight?: boolean; maxRetries?: number }
): Promise<string> {
  const payload = (signedTxBase64 || "").trim();
  if (!payload || payload.length < 32) {
    throw new Error(
      "[SOLANA-EXEC] Payload transaksi kosong. Bangun + tanda tangani ix Kamino/Jupiter dulu, lalu kirim base64."
    );
  }
  const url = requireSolanaExecutorRpcUrl();
  console.log(`[SOLANA-EXEC] broadcast via QuickNode ${redactEndpoint(url)}`);
  const signature = await solanaExecutorRpc<string>("sendTransaction", [
    payload,
    {
      encoding: "base64",
      skipPreflight: options?.skipPreflight === true,
      maxRetries: options?.maxRetries ?? 3,
      preflightCommitment: "confirmed",
    },
  ]);
  if (!signature) throw new Error("QuickNode Solana tidak mengembalikan signature.");
  console.log(`[TX HASH] ${signature}`);
  console.log(`[SOLANA-EXEC] https://solscan.io/tx/${signature}`);
  return signature;
}

/** Slot terkini lewat QuickNode executor (bukan Ankr scanner). */
export async function fetchSolanaExecutorSlot(): Promise<number> {
  const slot = await solanaExecutorRpc<number>("getSlot", [{ commitment: "processed" }]);
  return typeof slot === "number" ? slot : 0;
}

/** Health check QuickNode Dedicated — siap siaga bila getSlot > 0. */
export async function pingSolanaExecutor(): Promise<
  { ok: true; slot: number } | { ok: false; slot: number; error: string }
> {
  try {
    const url = requireSolanaExecutorRpcUrl();
    const slot = await fetchSolanaExecutorSlot();
    if (!(slot > 0)) {
      return { ok: false, slot: 0, error: "getSlot mengembalikan 0" };
    }
    console.log(`[SOLANA-EXEC] health OK · slot #${slot} · ${redactEndpoint(url)}`);
    return { ok: true, slot };
  } catch (error) {
    return {
      ok: false,
      slot: 0,
      error: error instanceof Error ? error.message : "executor unreachable",
    };
  }
}

/**
 * Buka WSS QuickNode untuk pantau slot (proxy mempool/block real-time).
 * Caller wajib menutup socket.
 */
export function openSolanaExecutorSlotStream(handlers: {
  onSlot?: (slot: number) => void;
  onError?: (message: string) => void;
  onOpen?: () => void;
}): WebSocket {
  const wsUrl = solanaExecutorWsUrl();
  if (!wsUrl) {
    throw new Error(
      "[SOLANA-EXEC] QuickNode WS belum diisi. Set SOLANA_EXECUTOR_WS_URL di .env.local."
    );
  }
  console.log(`[SOLANA-EXEC] WSS monitor ${redactEndpoint(wsUrl)}`);
  const ws = new WebSocket(wsUrl);
  ws.addEventListener("open", () => {
    handlers.onOpen?.();
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "slotSubscribe",
        params: [],
      })
    );
  });
  ws.addEventListener("message", (event) => {
    try {
      const raw = typeof event.data === "string" ? event.data : String(event.data);
      const json = JSON.parse(raw) as {
        method?: string;
        params?: { result?: { slot?: number } | number };
      };
      if (json.method !== "slotNotification") return;
      const result = json.params?.result;
      const slot =
        typeof result === "number"
          ? result
          : result && typeof result === "object" && typeof result.slot === "number"
            ? result.slot
            : 0;
      if (slot > 0) handlers.onSlot?.(slot);
    } catch (error) {
      handlers.onError?.(error instanceof Error ? error.message : "parse WSS gagal");
    }
  });
  ws.addEventListener("error", () => {
    handlers.onError?.("Solana executor WSS error");
  });
  return ws;
}

export function describeSolanaExecutor(): {
  rpcUrl: string;
  wsUrl: string;
  via: "QuickNode" | "unset";
} {
  const rpcUrl = solanaExecutorRpcUrl();
  const wsUrl = solanaExecutorWsUrl();
  return {
    rpcUrl,
    wsUrl,
    via: rpcUrl ? "QuickNode" : "unset",
  };
}
