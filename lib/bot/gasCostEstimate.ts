/**
 * Estimasi biaya gas EVM — modul murni (aman di Client Components).
 * Jangan taruh import next/server / telegram di sini.
 */

/** Default gasLimit pra-eksekusi (non-Arbitrum). */
export const DEFAULT_PREEXEC_GAS_LIMIT = 650_000;

/**
 * Plafon gasLimit simulasi / log untuk Arbitrum L2 (swap 2 DEX ~180k–250k).
 * Mencegah estimasi membengkak ke 600k+ dari config default.
 */
export const ARBITRUM_PREEXEC_GAS_LIMIT = 250_000;

/** gasLimit efektif untuk estimasi biaya pra-eksekusi / log ETH (Gas). */
export function resolvePreExecGasLimit(
  chainId: string | undefined | null,
  configuredLimit?: number
): number {
  const configured =
    Number.isFinite(configuredLimit) && (configuredLimit as number) > 0
      ? Math.floor(configuredLimit as number)
      : DEFAULT_PREEXEC_GAS_LIMIT;
  if (chainId === "arbitrum") {
    return Math.min(configured, ARBITRUM_PREEXEC_GAS_LIMIT);
  }
  return Math.max(21_000, configured);
}

/** Buffer 30% di atas gasLimit × price — untuk assert sebelum broadcast. */
export function estimatedTxGasWei(gasLimit: number, gasPriceWei: bigint): bigint {
  const limit = BigInt(Math.max(21_000, Math.floor(gasLimit || 0)));
  const price = gasPriceWei > 0n ? gasPriceWei : 0n;
  return (limit * price * 130n) / 100n;
}

/** Biaya gas mentah: gasLimit × gasPriceWei (tanpa buffer) — untuk tampilan log. */
export function estimateTxGasCostWei(gasLimit: number, gasPriceWei: bigint): bigint {
  const limit = BigInt(Math.max(21_000, Math.floor(gasLimit || DEFAULT_PREEXEC_GAS_LIMIT)));
  const price = gasPriceWei > 0n ? gasPriceWei : 0n;
  return limit * price;
}

/**
 * Format biaya gas native (ETH/BNB/POL).
 * Nilai &lt; 1 selalu 6–8 desimal agar sinkron dengan panel P&amp;L (mis. 0.000005 ETH).
 */
export function formatGasCostNative(wei: bigint): string {
  if (wei <= 0n) return "—";
  const n = Number(wei) / 1e18;
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1) {
    return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") || "0";
  }
  // L2 / gas kecil: selalu 6–8 tempat desimal (jangan trunc ke 4).
  if (n >= 0.000001) {
    return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") || "0";
  }
  return n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

/**
 * Estimasi biaya tx dari gasPrice (wei) × gasLimit pra-eksekusi.
 * Arbitrum: plafon 250_000 → ~0.000005 ETH @ 0.02 gwei.
 */
export function formatEstimatedTxGasFromPrice(
  gasPriceWei: string | undefined,
  gasLimit = DEFAULT_PREEXEC_GAS_LIMIT,
  chainId?: string | null
): string {
  try {
    const price = BigInt(gasPriceWei || "0");
    if (price <= 0n) return "—";
    const limit = resolvePreExecGasLimit(chainId, gasLimit);
    return formatGasCostNative(estimateTxGasCostWei(limit, price));
  } catch {
    return "—";
  }
}
