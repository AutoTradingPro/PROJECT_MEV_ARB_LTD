import { getVaultSession, readVaultToken, requireVaultSession, touchVaultSession } from "@/lib/owner/vaultAuth";
import { getVaultRegistry, patchVaultRegistry } from "@/lib/owner/vaultRegistry";
import type { ChainId } from "@/lib/chain/networks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = getVaultSession(readVaultToken(request));
  if (!session) {
    return Response.json(
      { unlocked: false },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
  const fresh = touchVaultSession(session.token) ?? session;
  return Response.json(
    {
      unlocked: true,
      expiresAt: fresh.expiresAt,
      registry: getVaultRegistry(),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function PATCH(request: Request) {
  try {
    const session = requireVaultSession(request);
    const body = (await request.json().catch(() => null)) as {
      vaultContracts?: Partial<Record<ChainId, string>>;
      operationalWallets?: Partial<Record<ChainId, string>>;
    } | null;
    const registry = patchVaultRegistry({
      vaultContracts: body?.vaultContracts,
      operationalWallets: body?.operationalWallets,
    });
    return Response.json({ ok: true, registry, expiresAt: session.expiresAt });
  } catch (error) {
    const status = (error as { status?: number }).status === 401 ? 401 : 400;
    const message = error instanceof Error ? error.message : "Gagal menyimpan alamat brankas.";
    return Response.json({ error: message }, { status });
  }
}
