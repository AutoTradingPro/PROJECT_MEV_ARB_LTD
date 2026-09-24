/**
 * Live slot Solana via Ankr WSS (slotSubscribe) + cache untuk head/scanner.
 * HTTP getSlot dipakai sebagai bootstrap / fallback.
 */
import { envSolanaRpcUrl, envSolanaWsUrl } from "@/config/networks";
import { resolveChainRpc, resolveChainWs } from "@/lib/chain/networks";
import { redactEndpoint } from "@/lib/bot/rpc";

type LiveSlotGlobal = typeof globalThis & {
  __mevSolanaLiveSlot?: {
    slot: number;
    updatedAt: number;
    transport: "ws" | "http" | "offline";
    wsUrl: string;
    socket?: WebSocket;
    starting?: Promise<void>;
  };
};

function slotState() {
  const g = globalThis as LiveSlotGlobal;
  if (!g.__mevSolanaLiveSlot) {
    g.__mevSolanaLiveSlot = {
      slot: 0,
      updatedAt: 0,
      transport: "offline",
      wsUrl: "",
    };
  }
  return g.__mevSolanaLiveSlot;
}

function ankrWsUrl(): string {
  return (resolveChainWs("solana") || envSolanaWsUrl() || "").trim();
}

function ankrRpcUrl(): string {
  return (resolveChainRpc("solana") || envSolanaRpcUrl() || "").trim();
}

function scannerVia(rpcUrl: string): "Ankr" | "RPC" {
  return /ankr\.com/i.test(rpcUrl) ? "Ankr" : "RPC";
}

async function httpGetSlot(rpcUrl: string): Promise<number> {
  if (!rpcUrl) return 0;
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [] }),
    cache: "no-store",
  });
  const json = (await response.json()) as { result?: number; error?: { message?: string } };
  if (json.error?.message) throw new Error(json.error.message);
  return typeof json.result === "number" && Number.isFinite(json.result) ? json.result : 0;
}

function applySlot(slot: number, transport: "ws" | "http") {
  if (!Number.isFinite(slot) || slot <= 0) return;
  const state = slotState();
  if (slot < state.slot && transport === "http") return;
  state.slot = Math.max(state.slot, slot);
  state.updatedAt = Date.now();
  state.transport = transport;
}

function attachSocket(wsUrl: string) {
  const state = slotState();
  if (state.socket && state.wsUrl === wsUrl) {
    const ready = state.socket.readyState;
    if (ready === WebSocket.OPEN || ready === WebSocket.CONNECTING) return;
  }
  try {
    state.socket?.close();
  } catch {
    /* ignore */
  }
  state.wsUrl = wsUrl;
  const socket = new WebSocket(wsUrl);
  state.socket = socket;

  socket.addEventListener("open", () => {
    console.log(`[SOLANA-LIVE] Ankr WSS connected ${redactEndpoint(wsUrl)} · slotSubscribe`);
    socket.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "slotSubscribe",
        params: [],
      })
    );
  });

  socket.addEventListener("message", (event) => {
    try {
      const raw = typeof event.data === "string" ? event.data : String(event.data);
      const json = JSON.parse(raw) as {
        method?: string;
        params?: { result?: { slot?: number } | number };
        result?: number;
      };
      if (json.method === "slotNotification") {
        const result = json.params?.result;
        const slot =
          typeof result === "number"
            ? result
            : result && typeof result === "object" && typeof result.slot === "number"
              ? result.slot
              : 0;
        applySlot(slot, "ws");
        return;
      }
      if (typeof json.result === "number") applySlot(json.result, "ws");
    } catch {
      /* ignore parse */
    }
  });

  socket.addEventListener("close", () => {
    if (slotState().socket === socket) {
      slotState().socket = undefined;
      if (slotState().transport === "ws") slotState().transport = "http";
    }
  });

  socket.addEventListener("error", () => {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  });
}

/** Bootstrap HTTP slot + buka Ankr WSS untuk update real-time. */
export async function ensureSolanaLiveSlotMonitor(): Promise<{
  slot: number;
  transport: "ws" | "http" | "offline";
  rpcUrl: string;
  wsUrl: string;
  via: "Ankr" | "RPC";
}> {
  const state = slotState();
  const rpc = ankrRpcUrl();
  const ws = ankrWsUrl();

  if (!state.starting) {
    state.starting = (async () => {
      try {
        const slot = await httpGetSlot(rpc);
        applySlot(slot, "http");
        console.log(`[SOLANA-LIVE] Ankr HTTP getSlot #${slot} · ${redactEndpoint(rpc)}`);
      } catch (error) {
        console.warn(
          `[SOLANA-LIVE] HTTP getSlot gagal: ${error instanceof Error ? error.message : "unknown"}`
        );
      }
      if (ws) {
        try {
          attachSocket(ws);
        } catch (error) {
          console.warn(
            `[SOLANA-LIVE] WSS gagal: ${error instanceof Error ? error.message : "unknown"}`
          );
        }
      } else {
        console.warn("[SOLANA-LIVE] ANKR_SOLANA_WSS_URL / SOLANA_WS_URL kosong");
      }
    })().finally(() => {
      state.starting = undefined;
    });
  }
  await state.starting;

  const stale = Date.now() - state.updatedAt > 3_000;
  if (state.slot <= 0 || (stale && state.transport !== "ws")) {
    try {
      const slot = await httpGetSlot(rpc);
      applySlot(slot, "http");
    } catch {
      /* keep cache */
    }
  }

  if (ws && (!state.socket || state.socket.readyState === WebSocket.CLOSED)) {
    try {
      attachSocket(ws);
    } catch {
      /* ignore */
    }
  }

  return {
    slot: state.slot,
    transport: state.slot > 0 ? state.transport : "offline",
    rpcUrl: rpc,
    wsUrl: ws,
    via: scannerVia(rpc),
  };
}

export function peekSolanaLiveSlot(): {
  slot: number;
  transport: "ws" | "http" | "offline";
  ageMs: number;
} {
  const state = slotState();
  return {
    slot: state.slot,
    transport: state.slot > 0 ? state.transport : "offline",
    ageMs: state.updatedAt > 0 ? Date.now() - state.updatedAt : -1,
  };
}
