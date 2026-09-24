import { requireVaultSession } from "@/lib/owner/vaultAuth";
import { fetchVaultBalanceSnapshot } from "@/lib/owner/vaultBalances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = requireVaultSession(request);
    const balances = await fetchVaultBalanceSnapshot();
    return Response.json(
      { balances, expiresAt: session.expiresAt },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    const status = (error as { status?: number }).status === 401 ? 401 : 500;
    const message = error instanceof Error ? error.message : "Gagal membaca saldo brankas.";
    return Response.json({ error: message }, { status });
  }
}
