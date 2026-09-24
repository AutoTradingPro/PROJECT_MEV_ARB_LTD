import { AbiCoder, Interface, id } from "ethers";

const EXECUTOR_IFACE = new Interface([
  "error NotOwner()",
  "error IsKilled()",
  "error Unprofitable()",
  "error InvalidCallback()",
  "error NativeTransferFailed()",
  "error BadPath()",
  "error RepayFailed()",
]);

const ROUTER_IFACE = new Interface([
  "error InsufficientOutput()",
  "error InsufficientLiquidity()",
  "error SlippageExceeded()",
  "error SlippageExceeded(uint256 amountOut, uint256 amountOutMin)",
  "error TooLittleReceived()",
  "error TooMuchRequested()",
  "error NotEnoughLiquidity()",
  "error InvalidPath()",
  "error TransactionTooOld()",
  "error PriceSlippageCheck()",
  "error STF()",
  "error TF()",
  "error SPL()",
  "error IIA()",
  "error LOK()",
  "error TLU()",
  "error TLM()",
  "error TUM()",
  "error AS()",
]);

const HINTS: Record<string, string> = {
  "Not Owner": "pemanggil bukan owner/DEPLOYER (BalancerFlashArb.onlyOwner / executeFlashLoan)",
  NotOwner: "pemanggil bukan owner/DEPLOYER (BalancerFlashArb.onlyOwner / executeFlashLoan)",
  "Invalid Callback": "callback/parameter flash loan tidak valid (BalancerFlashArb.receiveFlashLoan)",
  InvalidCallback: "callback/parameter flash loan tidak valid (BalancerFlashArb.receiveFlashLoan)",
  Unprofitable: "laba quote setelah repay < minProfitWei (BalancerFlashArb.receiveFlashLoan)",
  "Bad Path": "buyPath/sellPath tidak cocok borrowToken (BalancerFlashArb._swap)",
  BadPath: "buyPath/sellPath tidak cocok borrowToken (BalancerFlashArb._swap)",
  "Repay Failed":
    "saldo quote tidak cukup bayar flash loan (BalancerFlashArb.receiveFlashLoan)",
  RepayFailed:
    "saldo quote tidak cukup bayar flash loan, atau swap V3 exactInputSingle gagal semua fee tier (BalancerFlashArb._swap / repay)",
  "Slippage Exceeded": "amountOut di bawah amountOutMin (swap V2/V3)",
  SlippageExceeded: "amountOut di bawah amountOutMin (swap Camelot / Uniswap V3 / SushiSwap)",
  CamelotSwapFailed: "swap Camelot V2/V3 gagal tanpa payload (ArbitrumFlashArbExecutor)",
  UniswapV3SwapFailed: "exactInputSingle Uniswap V3 gagal tanpa payload (ArbitrumFlashArbExecutor)",
  SushiSwapFailed: "swap SushiSwap V2 gagal tanpa payload (ArbitrumFlashArbExecutor)",
  UnknownRouter: "alamat router bukan Camelot / Uniswap V3 SwapRouter02 / Sushi V2",
  ZeroAmountIn: "jumlah deposit, withdraw, flash loan, atau amountIn swap = 0",
  ApproveFailed: "ERC-20 approve ke router gagal",
  InvalidVault: "alamat Balancer vault di constructor kosong",
  InvalidWrappedNative: "alamat WETH di constructor kosong",
  "Native Transfer Failed": "transfer ETH ke coinbase/penerima gagal",
  NativeTransferFailed: "transfer ETH ke coinbase/penerima gagal",
  InsufficientOutput: "amountOut di bawah batas slippage router",
  InsufficientLiquidity: "likuiditas pool tidak cukup",
  TooLittleReceived: "Uniswap V3: amountOut < amountOutMinimum",
  TooMuchRequested: "Uniswap V3 exactOutput: amountIn terlalu besar",
  NotEnoughLiquidity: "likuiditas pool router tidak cukup",
  InvalidPath: "path token swap tidak valid",
  TransactionTooOld: "deadline router sudah lewat",
  PriceSlippageCheck: "Camelot/Algebra: slippage on-chain",
  STF: "safeTransferFrom gagal (Uniswap V3 / token fee-on-transfer)",
  TF: "transfer token gagal",
  INSUFFICIENT_OUTPUT_AMOUNT: "Uniswap V2: amountOut < amountOutMin (slippage atau impact)",
  INSUFFICIENT_LIQUIDITY: "Uniswap V2: cadangan pool terlalu tipis",
  EXPIRED: "deadline router sudah lewat",
  TRANSFER_FAILED: "ERC-20 transfer/approve gagal di router",
  EXCESSIVE_INPUT_AMOUNT: "jumlah input melebihi batas router",
};

export class RpcCallError extends Error {
  data?: unknown;
  constructor(message: string, data?: unknown) {
    super(message);
    this.name = "RpcCallError";
    this.data = data;
  }
}

function errorSelector(signature: string): string {
  return id(signature).slice(0, 10).toLowerCase();
}

const DEX_SELECTOR_HINTS: Record<string, string> = {
  [errorSelector("TooLittleReceived()")]: "TooLittleReceived() — Uniswap V3: amountOut < amountOutMinimum",
  [errorSelector("TooMuchRequested()")]: "TooMuchRequested() — Uniswap V3 exactOutput",
  [errorSelector("NotEnoughLiquidity()")]: "NotEnoughLiquidity() — likuiditas router habis",
  [errorSelector("InvalidPath()")]: "InvalidPath() — path token tidak valid",
  [errorSelector("TransactionTooOld()")]: "TransactionTooOld() — deadline terlewat",
  [errorSelector("PriceSlippageCheck()")]: "PriceSlippageCheck() — Camelot/Algebra slippage",
  [errorSelector("SlippageExceeded()")]: "SlippageExceeded() — amountOut < amountOutMin",
  [errorSelector("InsufficientOutput()")]: "InsufficientOutput() — amountOut di bawah batas router",
};

export type RevertPayload = {
  hex: string | null;
  empty: boolean;
  selector: string | null;
};

function hexCandidateFromString(value: string): { hex: string; empty: boolean } | null {
  const text = value.trim();
  if (!text) return null;
  if (/^0x$/i.test(text)) return { hex: "0x", empty: true };
  const matches = text.match(/0x[0-9a-fA-F]*/gi) || [];
  for (const match of matches) {
    if (/^0x$/i.test(match)) return { hex: "0x", empty: true };
    if (match.length === 66) continue;
    if (match.length >= 10) return { hex: match, empty: false };
  }
  return null;
}

export function extractRevertPayload(error: unknown): RevertPayload {
  const seen = new Set<unknown>();
  let empty = false;
  const walk = (value: unknown): string | null => {
    if (value == null || seen.has(value)) return null;
    if (typeof value === "string") {
      const hit = hexCandidateFromString(value);
      if (!hit) return null;
      if (hit.empty) {
        empty = true;
        return null;
      }
      return hit.hex;
    }
    if (typeof value !== "object") return null;
    seen.add(value);
    const record = value as Record<string, unknown>;
    for (const key of ["data", "error", "info", "payload", "body", "result", "revert", "cause", "originalError", "value"]) {
      const nested = record[key];
      if (typeof nested === "string") {
        const hit = hexCandidateFromString(nested);
        if (hit?.empty) empty = true;
        else if (hit?.hex) return hit.hex;
      }
      const deeper = walk(nested);
      if (deeper) return deeper;
    }
    return null;
  };
  const hex = walk(error);
  const selector = hex && hex.length >= 10 ? hex.slice(0, 10).toLowerCase() : null;
  return {
    hex: hex || (empty ? "0x" : null),
    empty: Boolean(empty && !hex),
    selector,
  };
}

export function extractRevertHex(error: unknown): string | null {
  const payload = extractRevertPayload(error);
  if (payload.empty) return "0x";
  return payload.hex;
}

export function isEmptySelectorRevert(error: unknown): boolean {
  if (typeof error === "string") {
    return /EVM revert tanpa data|selector kosong/i.test(error);
  }
  const payload = extractRevertPayload(error);
  if (payload.empty) return true;
  const text =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "reason" in error
        ? String((error as { reason?: string }).reason || "")
        : "";
  return /EVM revert tanpa data|selector kosong/i.test(text);
}

function decodePanic(code: bigint): string {
  const map: Record<string, string> = {
    "1": "assert gagal",
    "17": "overflow/underflow aritmetika",
    "18": "pembagian/modulo nol",
    "33": "enum tidak valid",
    "34": "storage byte array rusak",
    "49": "pop array kosong",
    "50": "akses array di luar batas",
    "65": "alokasi memori terlalu besar",
    "81": "call ke zero address",
  };
  return map[code.toString()] || `kode ${code}`;
}

function decodeRevertHex(hex: string): string | null {
  const data = hex.startsWith("0x") ? hex : `0x${hex}`;
  if (data.length < 10) {
    return `EVM revert tanpa data (selector kosong) · raw=${data}`;
  }
  const selector = data.slice(0, 10).toLowerCase();

  if (selector === "0x08c379a0") {
    try {
      const [reason] = AbiCoder.defaultAbiCoder().decode(["string"], `0x${data.slice(10)}`);
      const text = String(reason || "").trim();
      if (!text) return "Error(string) kosong";
      const hint = HINTS[text];
      return hint ? `${text} — ${hint}` : `Error(string): ${text}`;
    } catch {
      return "Error(string) tidak bisa di-decode";
    }
  }

  if (selector === "0x4e487b71") {
    try {
      const [code] = AbiCoder.defaultAbiCoder().decode(["uint256"], `0x${data.slice(10)}`);
      return `Panic(uint256) — ${decodePanic(BigInt(code))}`;
    } catch {
      return "Panic(uint256)";
    }
  }

  for (const iface of [EXECUTOR_IFACE, ROUTER_IFACE]) {
    try {
      const parsed = iface.parseError(data);
      if (parsed) {
        const hint = HINTS[parsed.name];
        if (parsed.name === "SlippageExceeded" && parsed.args.length >= 2) {
          const actual = parsed.args[0]?.toString?.() ?? String(parsed.args[0]);
          const minOut = parsed.args[1]?.toString?.() ?? String(parsed.args[1]);
          const labeled = `SlippageExceeded(actualOut=${actual}, amountOutMin=${minOut})`;
          return hint ? `${labeled} — ${hint}` : labeled;
        }
        return hint ? `${parsed.name}() — ${hint}` : `${parsed.signature}`;
      }
    } catch {
      /* selector lain */
    }
  }

  const mapped = DEX_SELECTOR_HINTS[selector];
  if (mapped) return mapped;

  return `custom error ${selector} (kemungkinan error kustom router DEX; tidak ada di ABI executor/router)`;
}

export function describeRevert(error: unknown): string {
  const payload = extractRevertPayload(error);
  if (payload.hex && payload.hex !== "0x") {
    const decoded = decodeRevertHex(payload.hex);
    if (decoded) return decoded;
  }
  if (payload.empty || payload.hex === "0x") {
    return `EVM revert tanpa data (selector kosong) · raw=${payload.hex || "0x"}`;
  }
  if (error && typeof error === "object") {
    const revert = (error as { revert?: { name?: string; signature?: string } }).revert;
    if (revert?.name) {
      const hint = HINTS[revert.name];
      const sig = revert.signature || `${revert.name}()`;
      return hint ? `${sig} — ${hint}` : sig;
    }
  }
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const cleaned = text.replace(/^Error:\s*/i, "").trim();
  if (/execution reverted/i.test(cleaned)) {
    const rest = cleaned.replace(/execution reverted[:\s]*/i, "").trim();
    return rest || "EVM revert tanpa data (selector kosong / node tidak mengembalikan revert payload)";
  }
  return cleaned || "EVM revert tanpa pesan";
}

export function toExecRevertLog(error: unknown): string {
  const detail = describeRevert(error);
  if (/^execution reverted\n/i.test(detail)) return detail;
  return `execution reverted\nalasan revert: ${detail}`;
}

function compactUsd(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  const text = n.toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return `$${text}`;
}

function compactPct(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const text = n.toFixed(2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return `${text}%`;
}

export function formatConfigSnapshot(config?: {
  loanAmountUsd?: number;
  minProfitUsd?: number;
  minerTipPct?: number;
  dynamicBribePercent?: number;
  minSpreadPct?: number;
  minPoolLiquidityUsd?: number;
  maxPriceImpactPct?: number;
  useBundle?: boolean;
} | null): string {
  const bribe = config?.dynamicBribePercent ?? config?.minerTipPct ?? 0;
  const bundle = config?.useBundle !== false ? "bundle" : "public";
  return `[CONFIG SNAPSHOT] loan=${compactUsd(config?.loanAmountUsd ?? 0)} · minProfit=max(loan×0.60%,costFloor) (${compactUsd(config?.minProfitUsd ?? 0)}) · slippage=adaptif 0.5%–1.0% · bribe=${compactPct(bribe)} · minSpread=${compactPct(config?.minSpreadPct ?? 0)} · minLiq=${compactUsd(config?.minPoolLiquidityUsd ?? 100000)} · exec=${bundle}`;
}

export function isExecRevertFailure(raw: string): boolean {
  return /execution reverted|RepayFailed|SlippageExceeded|alasan revert/i.test(raw);
}

export function extractSlippageAmounts(error: unknown): { actualOut?: bigint; amountOutMin?: bigint } {
  const hex = extractRevertHex(error);
  if (!hex) return {};
  const data = hex.startsWith("0x") ? hex : `0x${hex}`;
  try {
    const parsed = ROUTER_IFACE.parseError(data);
    if (parsed?.name === "SlippageExceeded" && parsed.args.length >= 2) {
      return {
        actualOut: BigInt(parsed.args[0].toString()),
        amountOutMin: BigInt(parsed.args[1].toString()),
      };
    }
  } catch {
    /* selector tanpa argumen / bukan SlippageExceeded */
  }
  return {};
}

export function logExecRevertSnapshot(config?: Parameters<typeof formatConfigSnapshot>[0]): void {
  console.warn(formatConfigSnapshot(config));
}
