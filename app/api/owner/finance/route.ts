import { buildFinancialReport } from "@/lib/finance/buildReport";
import { parseFinancePeriod } from "@/lib/finance/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = parseFinancePeriod(searchParams.get("period"));

  try {
    const report = await buildFinancialReport(period);
    return Response.json(
      { report },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyusun laporan.";
    return Response.json({ error: message }, { status: 500 });
  }
}
