import { attachTxHash, bscscanTxUrl, extractTxHash, isTxHash } from "@/lib/chain/explorer";
import { formatWalletError } from "@/lib/wallet/rpcError";

export { bscscanTxUrl, isTxHash, formatWalletError };

export async function sendContractTx(
  to: string,
  data: string,
  opts?: { gasLimit?: number }
): Promise<string> {
  if (!window.ethereum) {
    throw new Error("MetaMask tidak terdeteksi. Pasang atau buka ekstensi wallet lalu muat ulang halaman.");
  }
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  const from = accounts?.[0];
  if (!from) {
    throw new Error("Tidak ada akun MetaMask yang terhubung.");
  }
  const tx: { from: string; to: string; data: string; gas?: string } = { from, to, data };
  if (opts?.gasLimit && opts.gasLimit > 0) {
    tx.gas = `0x${Math.floor(opts.gasLimit).toString(16)}`;
  }
  try {
    const result = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
    if (!isTxHash(result)) {
      throw new Error("Wallet tidak mengembalikan transaction hash yang valid.");
    }
    return result;
  } catch (error) {
    const hash = extractTxHash(error);
    const message = formatWalletError(error);
    if (hash) {
      throw attachTxHash(
        new Error(`${message}\n[TX HASH] ${hash}\n[EXEC] Tx Hash: ${hash}`),
        hash
      );
    }
    throw error instanceof Error ? error : new Error(message);
  }
}
