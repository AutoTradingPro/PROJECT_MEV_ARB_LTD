import { formatUnits, parseUnits, toBigInt, type Provider } from "ethers";

export const ARBITRUM_GAS_AGGRESSIVENESS = 1.2;
/** Plafon gasLimit flash loan berantai (sesuai alokasi aman di executor). */
export const FLASH_LOAN_GAS_CEILING = 5_000_000;

const FALLBACK_PRIORITY = parseUnits("0.05", "gwei");
const FALLBACK_MAX_FEE = parseUnits("0.2", "gwei");
const FLOOR_PRIORITY = parseUnits("0.01", "gwei");

export interface AggressiveGasSettings {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

type JsonRpcSender = Provider & {
  send: (method: string, params: unknown[]) => Promise<unknown>;
};

interface FeeHistoryResult {
  baseFeePerGas?: Array<string | number | bigint>;
  nextBaseFeePerGas?: Array<string | number | bigint>;
  reward?: Array<Array<string | number | bigint>>;
}

function hasSend(provider: Provider): provider is JsonRpcSender {
  return typeof (provider as JsonRpcSender).send === "function";
}

function asBigInt(value: string | number | bigint | undefined): bigint {
  if (value === undefined || value === null) return 0n;
  return toBigInt(value);
}

function aggressivenessPct(aggressiveness: number): bigint {
  const pct = Math.floor(aggressiveness * 100);
  return BigInt(Number.isFinite(pct) && pct > 0 ? pct : 100);
}

function applyCap(
  settings: AggressiveGasSettings,
  capGwei?: number
): AggressiveGasSettings {
  if (!capGwei || capGwei <= 0) return settings;
  const capWei = BigInt(Math.ceil(capGwei * 1e9));
  let maxFeePerGas = settings.maxFeePerGas > capWei ? capWei : settings.maxFeePerGas;
  let maxPriorityFeePerGas = settings.maxPriorityFeePerGas;
  if (maxPriorityFeePerGas > maxFeePerGas) maxPriorityFeePerGas = maxFeePerGas;
  return { maxFeePerGas, maxPriorityFeePerGas };
}

function pickNextBaseFee(history: FeeHistoryResult): bigint {
  const next = history.nextBaseFeePerGas;
  if (Array.isArray(next) && next.length > 0) {
    return asBigInt(next[0]);
  }
  const bases = history.baseFeePerGas;
  if (Array.isArray(bases) && bases.length > 0) {
    return asBigInt(bases[bases.length - 1]);
  }
  return 0n;
}

function pickP75Reward(history: FeeHistoryResult): bigint {
  const row = history.reward?.[0];
  if (!row || row.length === 0) return 0n;
  return asBigInt(row[2] ?? row[1] ?? row[0]);
}

/**
 * Menghitung Gas Price & Priority Fee secara agresif untuk Arbitrum (EIP-1559).
 * Sumber: eth_feeHistory via readProvider (Ankr WSS), bukan write/private RPC.
 * @param provider Instance readProvider Ankr WSS untuk membaca data pasar
 * @param aggressiveness Faktor pengali kelonggaran gas (misal 1.20 = +20%)
 */
export async function calculateAggressiveGasArbitrum(
  provider: Provider,
  aggressiveness = 1.15,
  capGwei?: number,
  bribePriorityWei?: bigint
): Promise<AggressiveGasSettings> {
  try {
    if (!hasSend(provider)) {
      throw new Error("readProvider tidak mendukung eth_feeHistory");
    }

    const feeHistory = (await provider.send("eth_feeHistory", [
      1,
      "latest",
      [25, 50, 75],
    ])) as FeeHistoryResult;

    const latestBaseFee = pickNextBaseFee(feeHistory);
    if (latestBaseFee <= 0n) {
      throw new Error("eth_feeHistory tidak mengembalikan base fee");
    }

    const pct = aggressivenessPct(aggressiveness);
    const secureBaseFee = (latestBaseFee * pct) / 100n;
    let dynamicPriorityFee = pickP75Reward(feeHistory);
    if (dynamicPriorityFee < FLOOR_PRIORITY) {
      dynamicPriorityFee = FLOOR_PRIORITY;
    }
    const marketPriority = (dynamicPriorityFee * pct) / 100n;
    const bribePriority =
      bribePriorityWei && bribePriorityWei > 0n ? bribePriorityWei : 0n;
    let aggressivePriorityFee = bribePriority > 0n ? bribePriority : marketPriority;
    if (aggressivePriorityFee < FLOOR_PRIORITY) {
      aggressivePriorityFee = FLOOR_PRIORITY;
    }
    const maxFeePerGas = secureBaseFee * 2n + aggressivePriorityFee;

    console.log(
      `[GAS] feeHistory · base ${formatUnits(latestBaseFee, "gwei")} gwei` +
        ` · p75 ${formatUnits(dynamicPriorityFee, "gwei")} gwei` +
        (bribePriority > 0n
          ? ` · bribePriority ${formatUnits(bribePriority, "gwei")} gwei`
          : "") +
        ` · x${aggressiveness.toFixed(2)}` +
        ` · priority ${formatUnits(aggressivePriorityFee, "gwei")} gwei` +
        ` · maxFee ${formatUnits(maxFeePerGas, "gwei")} gwei`
    );

    return applyCap(
      { maxPriorityFeePerGas: aggressivePriorityFee, maxFeePerGas },
      capGwei
    );
  } catch (error) {
    console.error(
      "Gagal menghitung gas otomatis, menggunakan fallback aman:",
      error instanceof Error ? error.message : error
    );
    return applyCap(
      { maxPriorityFeePerGas: FALLBACK_PRIORITY, maxFeePerGas: FALLBACK_MAX_FEE },
      capGwei
    );
  }
}

export function formatPriorityGwei(wei: bigint): string {
  const gwei = Number(formatUnits(wei, "gwei"));
  if (!Number.isFinite(gwei)) return formatUnits(wei, "gwei");
  return gwei >= 1 ? gwei.toFixed(4) : gwei.toFixed(6);
}
