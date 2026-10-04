import {
  assertPanelPassword,
  readOperatorPublicSettings,
  saveOperatorSettings,
} from "@/lib/operator/settings";
import { OPERATOR_CHAINS, type OperatorChain } from "@/lib/operator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(readOperatorPublicSettings(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      panelPassword?: string;
      minProfitThreshold?: string;
      chain?: string;
      rpcUrl?: string;
      privateKey?: string;
    };
    assertPanelPassword(body.panelPassword);
    const chain = OPERATOR_CHAINS.find((item) => item === body.chain) as OperatorChain | undefined;
    await saveOperatorSettings({
      minProfitThreshold: body.minProfitThreshold,
      chain,
      rpcUrl: body.rpcUrl,
      privateKey: body.privateKey,
    });
    return Response.json(readOperatorPublicSettings());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan pengaturan.";
    const status = /kata sandi/i.test(message) ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
