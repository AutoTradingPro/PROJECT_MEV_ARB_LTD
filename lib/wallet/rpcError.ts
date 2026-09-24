import { toExecRevertLog } from "@/lib/bot/revertReason";
import { extractTxHash } from "@/lib/chain/explorer";

/** Pesan UI dari Error, objek RPC, atau nilai non-Error (hindari "[object Object]"). */
export function stringifyUnknownError(err: unknown): string {
  const nested = nestedMessage(err).replace(/^Error:\s*/i, "").trim();
  if (nested && nested !== "[object Object]") return nested;
  if (typeof err === "string" && err.trim()) return err.trim();
  try {
    const json = JSON.stringify(err);
    if (json && json !== "{}" && json !== "null") return json.slice(0, 400);
  } catch {
    /* ignore */
  }
  return "Terjadi kesalahan yang tidak terduga.";
}

function nestedMessage(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err;
  if (typeof err !== "object") return String(err);
  const e = err as Record<string, unknown>;
  const inner = e.error ?? e.data ?? e.info;
  const parts = [
    e.message,
    e.reason,
    e.shortMessage,
    typeof inner === "object" && inner ? nestedMessage(inner) : inner,
  ];
  return parts
    .map((p) => (typeof p === "string" ? p : ""))
    .filter(Boolean)
    .join(" · ");
}

function nestedCode(err: unknown): string | number | undefined {
  if (err == null || typeof err !== "object") return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e.code === "number" || typeof e.code === "string") return e.code;
  if (e.error && typeof e.error === "object") return nestedCode(e.error);
  if (e.info && typeof e.info === "object") return nestedCode(e.info);
  return undefined;
}

/** Pesan UI untuk error EIP-1193 / MetaMask / RPC. */
export function formatWalletError(err: unknown): string {
  const code = nestedCode(err);
  const msg = nestedMessage(err);
  const combined = `${code ?? ""} ${msg}`.toLowerCase();

  if (
    code === 4001 ||
    code === "ACTION_REJECTED" ||
    /user rejected|rejected the request|user denied|denied transaction|request rejected/i.test(combined)
  ) {
    return "Transaksi ditolak di MetaMask. Tidak ada transaksi yang dikirim ke jaringan.";
  }
  if (code === 4100 || /unauthorized/i.test(combined)) {
    return "Dompet menolak izin akun. Hubungkan ulang MetaMask lalu coba lagi.";
  }
  if (code === 4900 || /disconnected/i.test(combined)) {
    return "Dompet terputus dari jaringan. Buka MetaMask dan sambungkan kembali.";
  }
  if (code === 4902) {
    return "Jaringan belum ditambahkan di MetaMask. Tambahkan Arbitrum One atau BSC, lalu ulangi.";
  }
  if (/execution reverted/i.test(combined)) {
    const log = toExecRevertLog(err);
    const hash = extractTxHash(err);
    if (hash && !log.includes(hash)) {
      return `${log}\n[TX HASH] ${hash}\n[EXEC] Tx Hash: ${hash}`;
    }
    return log;
  }
  if (code === -32000 || /insufficient funds/i.test(combined)) {
    return "Saldo native tidak cukup untuk gas. Isi ETH/BNB di jaringan aktif lalu coba lagi.";
  }
  if (/nonce|already known|replacement/i.test(combined)) {
    return msg || "Transaksi bentrok di mempool (nonce). Cek aktivitas MetaMask lalu ulangi.";
  }

  const cleaned = msg.replace(/^Error:\s*/i, "").trim();
  if (cleaned && cleaned !== "[object Object]") return cleaned;
  return stringifyUnknownError(err) || "Eksekusi gagal. Periksa konfigurasi kontrak, jaringan aktif, dan dompet.";
}
