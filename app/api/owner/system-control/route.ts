import { appendNodeFeedLog, listNodeFeedLogs, type NodeFeedChannel } from "@/lib/owner/nodeFeedLog";
import { hydrateChainQuotaFromDisk, patchChainQuotaPersistent } from "@/lib/owner/chainQuotaPersist";
import { bumpRpcProviderEpoch } from "@/lib/owner/nodeEndpoints";
import type { ChainQuotaState } from "@/lib/owner/chainQuota";
import { isOwnerNodeChainId, type OwnerNodeChainId } from "@/lib/owner/ownerNodeChains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { logs: listNodeFeedLogs(), quota: hydrateChainQuotaFromDisk() },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(request: Request) {
  let body: {
    channel?: NodeFeedChannel | "chain" | "rpc-primary" | "rpc-backup";
    enabled?: boolean;
    chainId?: OwnerNodeChainId;
    quota?: Partial<ChainQuotaState>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  if (body.quota) {
    const quota = patchChainQuotaPersistent(body.quota);
    return Response.json({ ok: true, quota, logs: listNodeFeedLogs() });
  }

  if (body.channel === "chain") {
    if (!isOwnerNodeChainId(body.chainId)) {
      return Response.json({ error: "chainId jaringan Overview tidak valid." }, { status: 400 });
    }
    if (typeof body.enabled !== "boolean") {
      return Response.json({ error: "enabled wajib boolean." }, { status: 400 });
    }
    const quota = patchChainQuotaPersistent({ chains: { [body.chainId]: body.enabled } });
    const entry = appendNodeFeedLog({
      channel: "rpc",
      enabled: body.enabled,
      message: `${body.chainId} ${body.enabled ? "ON" : "OFF"} · kuota jaringan`,
    });
    return Response.json({ entry, quota, logs: listNodeFeedLogs() });
  }

  if (body.channel === "rpc-primary" || body.channel === "rpc-backup") {
    if (!isOwnerNodeChainId(body.chainId)) {
      return Response.json({ error: "chainId jaringan Overview tidak valid." }, { status: 400 });
    }
    if (typeof body.enabled !== "boolean") {
      return Response.json({ error: "enabled wajib boolean." }, { status: 400 });
    }
    const role = body.channel === "rpc-primary" ? "rpcPrimary" : "rpcBackup";
    const quota = patchChainQuotaPersistent({ [role]: { [body.chainId]: body.enabled } });
    bumpRpcProviderEpoch();
    const label = body.channel === "rpc-primary" ? "Primary RPC" : "Backup RPC";
    const extra =
      body.channel === "rpc-backup" && body.enabled && quota.rpcPrimary[body.chainId] === false
        ? " · scan/monitor cadangan saja"
        : body.channel === "rpc-primary" && !body.enabled && quota.rpcBackup[body.chainId]
          ? " · Primary OFF"
          : "";
    const entry = appendNodeFeedLog({
      channel: "rpc",
      enabled: body.enabled,
      message: `${body.chainId} ${label} ${body.enabled ? "ON" : "OFF"}${extra}`,
    });
    return Response.json({ entry, quota, logs: listNodeFeedLogs() });
  }

  if (body.channel !== "wss" && body.channel !== "rpc") {
    return Response.json({ error: "channel wajib wss, rpc, chain, rpc-primary, atau rpc-backup." }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "enabled wajib boolean." }, { status: 400 });
  }

  const quota = patchChainQuotaPersistent(
    body.channel === "wss" ? { wssEnabled: body.enabled } : { rpcFallbackEnabled: body.enabled }
  );
  const entry = appendNodeFeedLog({ channel: body.channel, enabled: body.enabled });
  return Response.json({ entry, quota, logs: listNodeFeedLogs() });
}
