/**
 * API worker Solana mandiri — tidak melewati loop EVM.
 * GET  → metadata modul (Ankr scan / QuickNode exec / Kamino)
 * POST → jalankan runSolanaWorker (latensi rendah)
 */
import {
  describeSolanaWorker,
  runSolanaWorker,
} from "@/lib/bot/solana/worker";
import type { BotConfig } from "@/lib/bot/types";
import { redactEndpoint } from "@/lib/bot/rpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redactWorkerMeta() {
  const meta = describeSolanaWorker();
  return {
    ...meta,
    scanner: {
      ...meta.scanner,
      rpcUrl: redactEndpoint(meta.scanner.rpcUrl),
      wsUrl: redactEndpoint(meta.scanner.wsUrl),
    },
    executor: {
      ...meta.executor,
      rpcUrl: redactEndpoint(meta.executor.rpcUrl),
      wsUrl: redactEndpoint(meta.executor.wsUrl),
    },
    flash: {
      ...meta.flash,
      rpcUrl: redactEndpoint(meta.flash.rpcUrl),
      wsUrl: redactEndpoint(meta.flash.wsUrl),
      pairs: meta.flash.pairs.map((p) => ({ id: p.id, label: p.label })),
    },
  };
}

export async function GET() {
  try {
    return Response.json(
      {
        ok: true,
        worker: redactWorkerMeta(),
        modules: {
          solana: "lib/bot/solana",
          evm: "lib/bot/evm",
          router: "lib/bot/router",
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "solana worker meta gagal";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      pairIds?: string[];
      config?: Partial<BotConfig>;
      persist?: boolean;
    };
    const result = await runSolanaWorker({
      pairIds: body.pairIds,
      config: body.config as BotConfig | undefined,
      persist: body.persist,
    });
    return Response.json(
      {
        ok: true,
        kind: "solana",
        chainId: result.chainId,
        slot: result.slot,
        executorSlot: result.executorSlot,
        elapsedMs: result.elapsedMs,
        opportunityCount: result.opportunities.length,
        readyCount: result.opportunities.filter((o) => o.status === "ready").length,
        opportunities: result.opportunities,
        scanner: {
          via: result.scanner.via,
          rpcUrl: redactEndpoint(result.scanner.rpcUrl),
        },
        executor: {
          via: result.executor.via,
          rpcUrl: redactEndpoint(result.executor.rpcUrl),
        },
        kamino: {
          feePct: result.kamino.feePct,
          programId: result.kamino.programId,
          popularPairIds: result.kamino.popularPairIds,
        },
        modules: {
          solana: "lib/bot/solana",
          evm: "lib/bot/evm",
          router: "lib/bot/router",
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "solana worker gagal";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
