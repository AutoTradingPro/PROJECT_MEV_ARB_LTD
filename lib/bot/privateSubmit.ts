import {
  isMevProtectionEnabled,
  mevProtectFetchHeaders,
  privateExecutorRpcUrl,
  requireExecutorRpcUrl,
} from "@/lib/bot/dualProvider";
import type { ChainId } from "@/lib/chain/networks";
import { extractTxHash, explorerTxUrl, failedTxLogLines } from "@/lib/chain/explorer";

/**
 * Kirim raw tx ke QuickNode MEV-protect (executor).
 * Header x-qn-mev-protect mengarahkan broadcast ke jalur privat anti front-running.
 * Solana: dialihkan ke sendTransaction base64 via QuickNode Solana executor.
 */
export async function submitPrivateRawTx(
  signedRawTx: string,
  options?: { useBundle?: boolean; chainId?: ChainId }
): Promise<string> {
  const chainId: ChainId = options?.chainId ?? "arbitrum";

  if (chainId === "solana") {
    const { submitSolanaSignedTx } = await import("@/lib/bot/solana/executor");
    const payload = signedRawTx.startsWith("0x")
      ? Buffer.from(signedRawTx.slice(2), "hex").toString("base64")
      : signedRawTx;
    return submitSolanaSignedTx(payload);
  }

  const relay =
    chainId === "arbitrum" || chainId === "polygon" || chainId === "ethereum"
      ? requireExecutorRpcUrl(chainId)
      : privateExecutorRpcUrl(chainId);
  if (!relay) {
    throw new Error("RPC executor (QuickNode) belum dikonfigurasi untuk broadcast transaksi.");
  }
  if (!signedRawTx.startsWith("0x")) throw new Error("raw tx tidak valid");

  const useBundle = options?.useBundle !== false;
  const mevOn = isMevProtectionEnabled();
  console.log(useBundle ? "[EXEC MODE] Using Private Bundle" : "[EXEC MODE] Using Standard Queue");
  console.log(
    `[EXEC] broadcast ${chainId} via QuickNode` +
      (mevOn ? " · MEV Protection ON (anti front-running)" : " · MEV Protection OFF")
  );

  const res = await fetch(relay, {
    method: "POST",
    headers: mevProtectFetchHeaders(),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: process.env.PRIVATE_RELAY_METHOD || "eth_sendRawTransaction",
      params: [signedRawTx],
    }),
  });
  const json = (await res.json()) as { result?: string; error?: { message: string } };
  const hash = json.result || extractTxHash(json.error);
  if (hash) {
    console.log(`[TX HASH] ${hash}`);
    console.log(`[EXEC] Tx Hash: ${hash}`);
    console.log(`[EXEC] ${explorerTxUrl(hash, chainId)}`);
  }
  if (json.error) {
    throw new Error(
      hash
        ? `${json.error.message}\n${failedTxLogLines(hash, chainId)}`
        : json.error.message
    );
  }
  if (!json.result) throw new Error("Relay tidak mengembalikan hash");
  return json.result;
}
