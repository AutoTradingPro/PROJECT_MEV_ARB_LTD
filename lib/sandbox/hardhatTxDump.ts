import type { BotConfig, Opportunity } from "@/lib/bot/types";

export type DumpTokenTone = "key" | "string" | "bigint" | "number" | "punct" | "ident" | "undef";

export interface DumpToken {
  text: string;
  tone: DumpTokenTone;
}

/** Alamat akun #0 Hardhat — estetik fork lokal. */
export const HARDHAT_FORK_FROM = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
/** Kontrak pertama default `hardhat-ethers` deploy. */
export const HARDHAT_FORK_TO = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const HARDHAT_FORK_CHAIN_ID = 31337n;
const DUMP_WIDTH = 88;

function mix32(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function prng(seed: string): () => number {
  let s = mix32(seed) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

function randomHex(next: () => number, bytes: number): string {
  let out = "0x";
  for (let i = 0; i < bytes; i++) {
    out += (next() & 0xff).toString(16).padStart(2, "0");
  }
  return out;
}

function checksumish(addr: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return addr.toLowerCase();
  return addr;
}

function t(text: string, tone: DumpTokenTone): DumpToken {
  return { text, tone };
}

function field(key: string, value: DumpToken[], comma = true): DumpToken[] {
  return [
    t("  ", "punct"),
    t(key, "key"),
    t(": ", "punct"),
    ...value,
    ...(comma ? [t(",", "punct")] : []),
  ];
}

function wrapQuotedHex(hex: string, key: string): DumpToken[][] {
  const prefix = `  ${key}: `;
  const quoted = `'${hex}'`;
  const firstBudget = Math.max(24, DUMP_WIDTH - prefix.length);
  if (quoted.length <= firstBudget) {
    return [field(key, [t(quoted, "string")])];
  }
  const lines: DumpToken[][] = [];
  let remaining = quoted;
  let first = true;
  while (remaining.length > 0) {
    if (first) {
      const take = remaining.slice(0, firstBudget);
      remaining = remaining.slice(firstBudget);
      lines.push([
        t("  ", "punct"),
        t(key, "key"),
        t(": ", "punct"),
        t(take, "string"),
        ...(remaining.length === 0 ? [t(",", "punct")] : []),
      ]);
      first = false;
      continue;
    }
    const indent = "        ";
    const take = remaining.slice(0, DUMP_WIDTH - indent.length);
    remaining = remaining.slice(DUMP_WIDTH - indent.length);
    lines.push([
      t(indent, "punct"),
      t(take, "string"),
      ...(remaining.length === 0 ? [t(",", "punct")] : []),
    ]);
  }
  return lines;
}

function buildCalldata(opp: Opportunity, next: () => number): string {
  const selector = "0x0c6c3f76";
  const pad = (hex: string) => hex.replace(/^0x/, "").padStart(64, "0");
  const amount0 = BigInt(opp.amount0Out || opp.amountInWei || "0").toString(16);
  const amount1 = BigInt(opp.amount1Out || "0").toString(16);
  const repay = BigInt(opp.repayWei || "0").toString(16);
  const tailBytes = 180 + (next() % 90);
  return `${selector}${pad(amount0)}${pad(amount1)}${pad(repay)}${randomHex(next, tailBytes).slice(2)}`;
}

export function buildHardhatTxDump(input: {
  txHash: string;
  opportunity: Opportunity;
  config?: Partial<BotConfig>;
  from?: string;
  to?: string;
  blockNumber?: number;
}): DumpToken[][] {
  const seed = input.txHash || input.opportunity.id;
  const next = prng(seed);
  const from = checksumish(input.from || HARDHAT_FORK_FROM);
  const to = checksumish(input.to || HARDHAT_FORK_TO);
  const blockHash = randomHex(prng(`${seed}:block:${input.blockNumber || 0}`), 32);
  const hash = /^0x[a-fA-F0-9]{64}$/.test(input.txHash) ? input.txHash : randomHex(next, 32);
  const nonce = 120 + (mix32(`${seed}:nonce`) % 520);
  const gasPrice = 8_000_000_000n + BigInt(mix32(`${seed}:gp`) % 8_000_000_000);
  const maxFee = gasPrice + 3_000_000_000n + BigInt(mix32(`${seed}:mf`) % 2_000_000_000);
  const priority = 100_000_000n;
  const gasLimit = 30_000_000n;
  const r = randomHex(prng(`${seed}:r`), 32);
  const s = randomHex(prng(`${seed}:s`), 32);
  const yParity = mix32(`${seed}:yp`) % 2;
  const data = buildCalldata(input.opportunity, next);
  const bn = (v: bigint) => [t(`${v.toString()}n`, "bigint")];
  const num = (v: number) => [t(String(v), "number")];
  const str = (v: string) => [t(`'${v}'`, "string")];

  const lines: DumpToken[][] = [
    [t("Transaction {", "ident")],
    field("blockHash", str(blockHash)),
    field("index", [t("undefined", "undef")]),
    field("hash", str(hash)),
    field("type", num(2)),
    field("to", str(to)),
    field("from", str(from)),
    field("nonce", num(nonce)),
    field("gasLimit", bn(gasLimit)),
    field("gasPrice", bn(gasPrice)),
    field("maxPriorityFeePerGas", bn(priority)),
    field("maxFeePerGas", bn(maxFee)),
    ...wrapQuotedHex(data, "data"),
    field("value", bn(0n)),
    field("chainId", bn(HARDHAT_FORK_CHAIN_ID)),
    [
      t("  ", "punct"),
      t("signature", "key"),
      t(": ", "punct"),
      t("Signature {", "ident"),
    ],
    [
      t("    ", "punct"),
      t("r", "key"),
      t(": ", "punct"),
      t(`'${r}'`, "string"),
      t(",", "punct"),
    ],
    [
      t("    ", "punct"),
      t("s", "key"),
      t(": ", "punct"),
      t(`'${s}'`, "string"),
      t(",", "punct"),
    ],
    [
      t("    ", "punct"),
      t("yParity", "key"),
      t(": ", "punct"),
      t(String(yParity), "number"),
      t(",", "punct"),
    ],
    [
      t("    ", "punct"),
      t("networkV", "key"),
      t(": ", "punct"),
      t("null", "undef"),
    ],
    [t("  }", "ident"), t(",", "punct")],
    field("accessList", [t("[]", "punct")], false),
    [t("}", "ident")],
  ];

  return lines;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
