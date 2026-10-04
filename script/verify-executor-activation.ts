/**
 * Verifikasi aktivasi executor EVM + program Solana.
 * Tidak mengirim transaksi.
 *
 *   npx tsx script/verify-executor-activation.ts
 *   npx tsx --env-file=.env.local script/verify-executor-activation.ts
 *   npx tsx --env-file=.env.local script/verify-executor-activation.ts --live
 */
import { BALANCER_V2_VAULT } from "@/config/networks";
import { kaminoFlashFeeWei } from "@/lib/bot/solana/kaminoConstants";
import { SOLANA_POPULAR_PAIR_IDS } from "@/lib/bot/solana/pairs";
import { describeSolanaExecutor, pingSolanaExecutor } from "@/lib/bot/solana/executor";
import { redactEndpoint } from "@/lib/bot/rpc";
import {
  SOLANA_PROGRAM_CHECK,
  evmExecutorActivations,
  resolveEvmExecutorAddress,
} from "@/lib/bot/executorActivation";
import { flashRepayFromPpm } from "@/lib/bot/dexMath";
import { estimateTwoDexFlashArb } from "@/lib/bot/profitEngine";
import {
  bestFlashloanForTradingChain,
  FANTOM_EXECUTOR_SKIP_REASON,
  flashloanExecutionBlock,
  rankFlashloanProvidersForChain,
} from "@/src/flashloan/globalProviderSelector";
import { AMM_LOAN_BPS, assertDynamicSizingBps, V3_LOAN_BPS } from "./mev-executor-targets";

const EXPECTED = [
  "ethereum",
  "optimism",
  "polygon",
  "base",
  "bsc",
  "avalanche",
  "fantom",
  "linea",
] as const;

function shortAddress(value: string): string {
  if (!value) return "belum diisi";
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function fail(message: string): never {
  console.error(`[verify] ${message}`);
  process.exit(1);
}

assertDynamicSizingBps();
if (V3_LOAN_BPS !== 200 || AMM_LOAN_BPS !== 300) {
  fail("bps MevExecutor bukan 200/300");
}

const rows = evmExecutorActivations().filter((row) =>
  (EXPECTED as readonly string[]).includes(row.chainId)
);
if (rows.length !== EXPECTED.length) {
  fail(`katalog EVM tidak lengkap: ${rows.map((row) => row.chainId).join(", ")}`);
}

const LOCKED_WINNERS: Record<string, { id: string; feePpm: number; vault: boolean }> = {
  ethereum: { id: "balancer-v2", feePpm: 0, vault: true },
  polygon: { id: "balancer-v2", feePpm: 0, vault: true },
  arbitrum: { id: "balancer-v2", feePpm: 0, vault: true },
  optimism: { id: "aave-v3", feePpm: 900, vault: false },
  avalanche: { id: "aave-v3", feePpm: 900, vault: false },
  base: { id: "uniswap-v3", feePpm: 100, vault: false },
  bsc: { id: "pancakeswap-v3", feePpm: 100, vault: false },
  linea: { id: "pancakeswap-v3", feePpm: 100, vault: false },
  fantom: { id: "sushiswap-v2", feePpm: 3000, vault: false },
};

console.log("Executor EVM");
console.log("V3 loan 2% · AMM loan 3%");
for (const row of rows) {
  const address = resolveEvmExecutorAddress(row.chainId);
  const pool = row.flashPool ? shortAddress(row.flashPool) : "pool env / tidak kanonik";
  console.log(
    [
      row.label.padEnd(12),
      `chain ${row.evmChainId}`,
      `executor ${shortAddress(address)}`,
      `flash ${row.flashloanName || "—"} ${row.feePct}%`,
      `pool ${pool}`,
      `sizing V3 ${row.v3LoanPct}% / AMM ${row.ammLoanPct}%`,
    ].join(" · ")
  );
  if (row.v3LoanPct !== 2 || row.ammLoanPct !== 3) {
    fail(`${row.chainId} rasio sizing bukan 2/3`);
  }
  if (!row.flashloanProviderId) {
    fail(`${row.chainId} tidak punya flashloan provider`);
  }
  const raw = process.env[row.envKeys[0]]?.trim() ?? "";
  if (raw && !/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    fail(`${row.envKeys[0]} bukan alamat`);
  }
  const locked = LOCKED_WINNERS[row.chainId];
  if (!locked) {
    fail(`${row.chainId} tidak ada di matriks flash loan`);
    continue;
  }
  if (row.flashloanProviderId !== locked.id || row.feePpm !== locked.feePpm) {
    fail(
      `${row.chainId} provider ${row.flashloanProviderId} ${row.feePpm} ppm, kunci ${locked.id} ${locked.feePpm} ppm`
    );
  }
  if (locked.vault && row.flashPool.toLowerCase() !== BALANCER_V2_VAULT.toLowerCase()) {
    fail(`${row.chainId} vault Balancer bukan alamat kanonik`);
  }
  if (!locked.vault && row.flashloanProviderId === "balancer-v2") {
    fail(`${row.chainId} masih memakai Balancer V2`);
  }
}

if (rankFlashloanProvidersForChain(56).some((item) => item.id === "balancer-v2")) {
  fail("BNB Chain masih mengizinkan Balancer V2");
}
if (flashloanExecutionBlock("fantom") !== FANTOM_EXECUTOR_SKIP_REASON) {
  fail("alasan skip Fantom berubah");
}

const winnerCases: Array<[string, number | undefined, string, number]> = [
  ["ethereum", undefined, "balancer-v2", 0],
  ["ethereum", 3000, "balancer-v2", 0],
  ["polygon", undefined, "balancer-v2", 0],
  ["arbitrum", undefined, "balancer-v2", 0],
  ["linea", 3000, "pancakeswap-v3", 100],
  ["base", undefined, "uniswap-v3", 100],
  ["base", 3000, "uniswap-v3", 3000],
  ["bsc", undefined, "pancakeswap-v3", 100],
  ["bsc", 3000, "pancakeswap-v3", 3000],
  ["avalanche", undefined, "aave-v3", 900],
  ["optimism", undefined, "aave-v3", 900],
  ["fantom", undefined, "sushiswap-v2", 3000],
  ["solana", undefined, "kamino", 10],
];
for (const [chain, poolFee, id, feePpm] of winnerCases) {
  const best = bestFlashloanForTradingChain(chain, poolFee == null ? undefined : { poolFee });
  if (!best || best.id !== id || best.feePpm !== feePpm) {
    fail(`${chain} pemenang ${best?.id ?? "kosong"} ${best?.feePpm ?? "?"} ppm, kunci ${id} ${feePpm}`);
  }
}
if (flashRepayFromPpm(1_000_000n, 10n) !== 1_000_010n) fail("repay 10 ppm tidak tepat");
if (flashRepayFromPpm(1_000_000n, 100n) !== 1_000_100n) fail("repay 100 ppm tidak tepat");
if (flashRepayFromPpm(1_000_000n, 900n) !== 1_000_900n) fail("repay 900 ppm tidak tepat");
if (flashRepayFromPpm(1_000_000n, 0n) !== 1_000_000n) fail("repay 0 ppm tidak tepat");
const priced = estimateTwoDexFlashArb({
  amountIn: 1_000_000n,
  buy: { reserveIn: 10n ** 30n, reserveOut: 10n ** 30n, feeBps: 0n },
  sell: { reserveIn: 10n ** 30n, reserveOut: 10n ** 30n, feeBps: 0n },
  gasPriceWei: 0n,
  gasLimit: 0n,
  spotSpreadBps: 0,
  config: {
    minProfitWei: "0",
    minerTipBps: 0,
    minSpreadBps: 0,
    gasLimit: 0,
    activeDexIds: [],
    aaveFeeBps: 0,
    flashFeePpm: 900,
  },
});
if (priced.repay !== 1_000_900n) fail(`estimateTwoDexFlashArb repay ${priced.repay} bukan 1000900`);

const program = SOLANA_PROGRAM_CHECK;
if (program.programId !== "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD") {
  fail(`program Solana berubah: ${program.programId}`);
}
if (program.feePct !== 0.001) fail(`fee Kamino bukan 0.001%`);
if (kaminoFlashFeeWei(100_000n) !== 1n) fail("kaminoFlashFeeWei(100000) bukan 1");
if (program.loanPct !== 2) fail("rasio Solana bukan 2%");
if (SOLANA_POPULAR_PAIR_IDS.length < 1) fail("daftar pair Solana kosong");

const exec = describeSolanaExecutor();
console.log("");
console.log("Solana");
console.log(`program ${program.programId}`);
console.log(`provider ${program.provider} · fee ${program.feePct}% · loan ${program.loanPct}%`);
console.log(program.loanReason);
console.log(`pair populer ${SOLANA_POPULAR_PAIR_IDS.length}`);
console.log(
  `executor HTTP ${exec.rpcUrl ? redactEndpoint(exec.rpcUrl) : "belum diisi"} · WSS ${
    exec.wsUrl ? redactEndpoint(exec.wsUrl) : "belum diisi"
  }`
);

async function main(): Promise<void> {
  if (process.argv.includes("--live")) {
    const ping = await pingSolanaExecutor();
    if (!ping.ok) fail(`Solana live: ${ping.error}`);
    console.log(`Solana live OK · slot #${ping.slot}`);
  }

  console.log("");
  console.log("[verify] katalog executor dan program Solana konsisten.");
}

void main();
