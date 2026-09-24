import type { ChainId } from "@/lib/chain/networks";
import { OWNER_NODE_CHAIN_IDS } from "@/lib/owner/ownerNodeChains";
import { appendServerLog } from "@/lib/bot/serverLog";
import {
  getNodeConfigMap,
  patchNodeConfigMap,
  redactNodeConfigMap,
  type ChainNodeConfig,
} from "@/lib/owner/nodeEndpoints";
import { redactSensitiveUrl } from "@/lib/security/redactUrl";
import { pingChainNodes } from "@/lib/owner/nodePing";
import { getChainQuota, isChainFeedEnabled, isHttpRpcAllowed, isWssAllowed } from "@/lib/owner/chainQuota";
import { hydrateChainQuotaFromDisk } from "@/lib/owner/chainQuotaPersist";
import { readBotState } from "@/lib/bot/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  hydrateChainQuotaFromDisk();
  return Response.json(
    { nodes: redactNodeConfigMap(getNodeConfigMap()), quota: getChainQuota() },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      nodes?: Partial<Record<ChainId, Partial<ChainNodeConfig>>>;
    } | null;
    if (!body?.nodes) {
      return Response.json({ error: "Body nodes wajib diisi." }, { status: 400 });
    }
    const nodes = patchNodeConfigMap(body.nodes);
    appendServerLog({
      level: "info",
      source: "node-config",
      message: `Konfigurasi Primary/Backup RPC·WSS disimpan untuk ${OWNER_NODE_CHAIN_IDS.length} jaringan Overview.`,
    });
    return Response.json({ ok: true, nodes: redactNodeConfigMap(nodes) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan konfigurasi node.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { chainId?: ChainId; all?: boolean } | null;
    await readBotState().catch(() => null);
    hydrateChainQuotaFromDisk();
    const requested: ChainId[] =
      body?.all || !body?.chainId ? [...OWNER_NODE_CHAIN_IDS] : [body.chainId];
    const chainIds = requested.filter((id) => isChainFeedEnabled(id) && (isHttpRpcAllowed(id) || isWssAllowed(id)));
    const samples = (await Promise.all(chainIds.map((id) => pingChainNodes(id)))).flat();
    const failed = samples.filter((sample) => !sample.ok).length;
    appendServerLog({
      level: failed > 0 ? "warn" : "info",
      source: "node-ping",
      message: `Test ping node: ${samples.length - failed} OK, ${failed} gagal.`,
    });
    return Response.json({
      samples: samples.map((sample) => ({
        ...sample,
        url: redactSensitiveUrl(sample.url),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ping node gagal.";
    return Response.json({ error: message }, { status: 500 });
  }
}
