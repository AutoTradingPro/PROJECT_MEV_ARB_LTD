import { normalizeTradingChainId } from "@/config/networks";
import type { ChainId } from "@/lib/chain/networks";
import {
  getChain,
  resolveChainRpc,
  resolveChainRpcFallback,
  resolveChainWs,
  resolveChainWsFallback,
} from "@/lib/chain/networks";
import { getChainNodeConfig } from "@/lib/owner/nodeEndpoints";
import { getChainQuota, isHttpRpcAllowed, isWssAllowed } from "@/lib/owner/chainQuota";
import { hydrateChainQuotaFromDisk } from "@/lib/owner/chainQuotaPersist";
import { readBotState } from "@/lib/bot/store";
import { redactSensitiveUrl } from "@/lib/security/redactUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseChain(value: string | null): ChainId {
  return normalizeTradingChainId(value);
}

export async function GET(request: Request) {
  const chainId = parseChain(new URL(request.url).searchParams.get("chain"));
  await readBotState().catch(() => null);
  hydrateChainQuotaFromDisk();
  const row = getChainNodeConfig(chainId);
  const chain = getChain(chainId);
  const quota = getChainQuota();
  return Response.json(
    {
      chainId,
      rpc: redactSensitiveUrl(row.primaryRpc || resolveChainRpc(chainId)),
      backupRpc: redactSensitiveUrl(row.backupRpc || resolveChainRpcFallback(chainId)),
      wss: redactSensitiveUrl(row.primaryWss || resolveChainWs(chainId) || chain.wsUrl),
      backupWss: redactSensitiveUrl(row.backupWss || resolveChainWsFallback(chainId)),
      enabled: quota.chains[chainId as keyof typeof quota.chains] !== false,
      wssLive: isWssAllowed(chainId),
      rpcLive: isHttpRpcAllowed(chainId),
      policy: {
        wssEnabled: quota.wssEnabled,
        rpcFallbackEnabled: quota.rpcFallbackEnabled,
        modeWss: quota.wssEnabled ? "publik" : "hemat",
        modeRpc: quota.rpcFallbackEnabled ? "publik" : "hemat",
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
