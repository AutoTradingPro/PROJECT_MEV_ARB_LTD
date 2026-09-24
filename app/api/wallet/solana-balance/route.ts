import { NextRequest } from "next/server";
import { fetchSolanaLamports, formatSolBalance } from "@/lib/bot/solana/balances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request: NextRequest) {
  const address = (request.nextUrl.searchParams.get("address") || "").trim();
  if (!address || !BASE58_RE.test(address)) {
    return Response.json(
      { ok: false, error: "Alamat Solana tidak valid.", lamports: "0", balance: "0" },
      { status: 400 }
    );
  }

  try {
    const lamports = await fetchSolanaLamports(address);
    const balance = formatSolBalance(lamports);
    return Response.json({
      ok: true,
      address,
      lamports: lamports.toString(),
      balance,
      symbol: "SOL",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membaca saldo Solana.";
    return Response.json(
      { ok: false, error: message, lamports: "0", balance: "0", address },
      { status: 502 }
    );
  }
}
