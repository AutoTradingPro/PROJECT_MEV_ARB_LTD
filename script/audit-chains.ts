/**
 * Audit jaringan MEV: executor EVM, RPC, calldata, plus Solana (RPC + program).
 * Tidak memanggil sendTransaction dan tidak mencetak kunci privat.
 *
 *   npm run audit:chains
 */
import bs58 from "bs58";
import { DEFAULT_BOT_CONFIG, contractAddressFromEnv } from "@/lib/bot/constants";
import { buildExecuteCalldata } from "@/lib/bot/encodeArb";
import { evmExecutorActivation, resolveEvmExecutorAddress } from "@/lib/bot/executorActivation";
import { defaultDexIdsForChain, resolveOpportunitySwapRouters } from "@/lib/bot/dexRegistry";
import { redactEndpoint } from "@/lib/bot/rpc";
import { KAMINO_KLEND_PROGRAM_ID } from "@/lib/bot/solana/kaminoConstants";
import type { Opportunity } from "@/lib/bot/types";
import { getChain, type ChainId } from "@/lib/chain/networks";
import { pairsForChain } from "@/lib/chain/tokenPairs";
import { getChainNodeConfig } from "@/lib/owner/nodeEndpoints";
import { EXECUTOR_BY_CHAIN_ID, executorConfigForChainId } from "@/lib/vault/executors";

const SOLANA_PROGRAM_ENV_KEYS = ["NEXT_PUBLIC_SOLANA_PROGRAM_ID", "SOLANA_EXECUTOR_PROGRAM_ID"] as const;

const SHARED_EXECUTOR = "0x564abBC67F07C7621F86EABe25346eb5C5c81c7c";
const RPC_TIMEOUT_MS = 12_000;

type ActiveChain = {
  id: ChainId;
  label: string;
  chainId: number;
  sharedExecutor: boolean;
};

const ACTIVE: ActiveChain[] = [
  { id: "ethereum", label: "Ethereum", chainId: 1, sharedExecutor: false },
  { id: "polygon", label: "Polygon", chainId: 137, sharedExecutor: false },
  { id: "bsc", label: "BNB Chain", chainId: 56, sharedExecutor: true },
  { id: "arbitrum", label: "Arbitrum", chainId: 42161, sharedExecutor: false },
  { id: "optimism", label: "Optimism", chainId: 10, sharedExecutor: false },
  { id: "base", label: "Base", chainId: 8453, sharedExecutor: false },
  { id: "linea", label: "Linea", chainId: 59144, sharedExecutor: true },
  { id: "avalanche", label: "Avalanche", chainId: 43114, sharedExecutor: false },
  { id: "monad", label: "Monad", chainId: 143, sharedExecutor: true },
];

type RpcProbe = {
  ok: boolean;
  chainId: number | null;
  block: number | null;
  url: string;
  endpoint: string;
  error: string;
};

type ExecProbe = {
  address: string;
  mapped: boolean;
  envKey: string;
  envSet: boolean;
  codeBytes: number | null;
  calldataTo: string;
  selector: string;
  txReady: boolean;
  note: string;
};

function unique(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw.trim();
    if (!url || seen.has(url.replace(/\/$/, "").toLowerCase())) continue;
    seen.add(url.replace(/\/$/, "").toLowerCase());
    out.push(url);
  }
  return out;
}

function rpcUrls(chainId: ChainId): string[] {
  const row = getChainNodeConfig(chainId);
  const chain = getChain(chainId);
  return unique([row.primaryRpc, row.backupRpc, chain.rpcUrl]);
}

async function rpcCall(url: string, method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (json.error?.message) throw new Error(json.error.message);
  return json.result;
}

async function probeRpc(urls: string[], expected: number): Promise<RpcProbe> {
  let lastError = "tidak ada endpoint";
  for (const url of urls) {
    try {
      const [chainHex, blockHex] = await Promise.all([
        rpcCall(url, "eth_chainId"),
        rpcCall(url, "eth_blockNumber"),
      ]);
      const chainId = Number(chainHex);
      const block = Number(blockHex);
      if (chainId !== expected) {
        return {
          ok: false,
          chainId,
          block: Number.isFinite(block) ? block : null,
          url,
          endpoint: redactEndpoint(url),
          error: `chain ${chainId} bukan ${expected}`,
        };
      }
      return {
        ok: true,
        chainId,
        block: Number.isFinite(block) ? block : null,
        url,
        endpoint: redactEndpoint(url),
        error: "",
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "gagal";
    }
  }
  return {
    ok: false,
    chainId: null,
    block: null,
    url: urls[0] || "",
    endpoint: urls[0] ? redactEndpoint(urls[0]) : "—",
    error: lastError,
  };
}

async function codeBytes(url: string, address: string): Promise<number | null> {
  try {
    const code = String(await rpcCall(url, "eth_getCode", [address, "latest"]));
    if (!code || code === "0x" || code === "0x0") return 0;
    return Math.max(0, (code.length - 2) / 2);
  } catch {
    return null;
  }
}

function sampleOpportunity(chainId: ChainId): Opportunity | null {
  const pair = pairsForChain(chainId).find((item) => item.baseAddress && item.quoteAddress);
  if (!pair) return null;
  const dexes = defaultDexIdsForChain(chainId).filter((id) => {
    const route = resolveOpportunitySwapRouters({ buyDex: id, sellDex: id });
    return Boolean(route?.buy.router);
  });
  if (dexes.length < 2) return null;
  return {
    id: `${pair.id}-audit`,
    tokenPair: pair.label,
    tokenIn: pair.quoteSymbol,
    tokenOut: pair.baseSymbol,
    buyDex: dexes[0],
    sellDex: dexes[1],
    buyExchange: dexes[0],
    sellExchange: dexes[1],
    amountInWei: "1000000",
    amountOutWei: "1000000",
    repayWei: "1000000",
    spreadBps: 10,
    estimatedProfitWei: "1000",
    gasCostWei: "100",
    netProfitWei: "100",
    flashPair: pair.quoteAddress || "",
    amount0Out: "0",
    amount1Out: "0",
    live: false,
    pairId: pair.id,
    chainId,
    quoteDecimals: pair.quoteDecimals ?? 18,
    status: "ready",
  };
}

function probeExecution(chainId: ChainId, executor: string): Pick<ExecProbe, "calldataTo" | "selector" | "txReady" | "note"> {
  const opp = sampleOpportunity(chainId);
  if (!opp) return { calldataTo: "", selector: "", txReady: false, note: "pair/DEX tidak cukup" };
  const activation = evmExecutorActivation(chainId);
  const built = buildExecuteCalldata(
    opp,
    {
      ...DEFAULT_BOT_CONFIG,
      chainId,
      pairId: opp.pairId,
      flashLoanProvider: "uniswap",
      activeDexIds: defaultDexIdsForChain(chainId),
    },
    "0x05F41c27821793D28788b91161Bd7026027bc387"
  );
  if (!built?.to || !built.data || built.data.length < 10) {
    return { calldataTo: built?.to || "", selector: "", txReady: false, note: "calldata kosong" };
  }
  const populated = {
    to: built.to,
    data: built.data,
    chainId: activation?.evmChainId,
    value: 0n,
  };
  const matches = executor && populated.to.toLowerCase() === executor.toLowerCase();
  return {
    calldataTo: populated.to,
    selector: populated.data.slice(0, 10),
    txReady: Boolean(matches && populated.chainId),
    note: matches
      ? `populateTransaction to=${populated.to} selector=${populated.data.slice(0, 10)} · tidak di-broadcast`
      : `to calldata ${populated.to || "kosong"} tidak sama dengan executor`,
  };
}

function pad(value: string, width: number): string {
  const text = value.length > width ? `${value.slice(0, width - 1)}…` : value;
  return text.padEnd(width);
}

async function auditActive(chain: ActiveChain): Promise<string[]> {
  const activation = evmExecutorActivation(chain.id);
  const mapped = executorConfigForChainId(chain.chainId);
  const inMap = Boolean(EXECUTOR_BY_CHAIN_ID[chain.chainId]);
  const resolved = resolveEvmExecutorAddress(chain.id);
  const fromEnvModule = contractAddressFromEnv(chain.id);
  const executor = fromEnvModule || resolved || mapped?.address || "";
  const envKey = activation?.envKeys.find((key) => key.startsWith("NEXT_PUBLIC_")) || activation?.envKeys[0] || "";
  const envValue = envKey ? (process.env[envKey]?.trim() ?? "") : "";
  const urls = rpcUrls(chain.id);
  const rpc = await probeRpc(urls, chain.chainId);
  const bytes = rpc.ok && rpc.url && executor ? await codeBytes(rpc.url, executor) : null;
  const exec = executor ? probeExecution(chain.id, executor) : { calldataTo: "", selector: "", txReady: false, note: "executor kosong" };
  const sharedOk = !chain.sharedExecutor || executor.toLowerCase() === SHARED_EXECUTOR.toLowerCase();
  const ready =
    rpc.ok &&
    Boolean(executor) &&
    bytes !== null &&
    bytes > 0 &&
    exec.txReady &&
    sharedOk;
  const rpcStatus = rpc.ok ? `OK #${rpc.block ?? "—"}` : rpc.error.slice(0, 42);
  const notes = [
    inMap ? "map OK" : "tidak ada di EXECUTOR_BY_CHAIN_ID",
    envValue ? `${envKey} terisi` : `${envKey || "env"} kosong`,
    bytes === 0 ? "tidak ada bytecode" : bytes === null ? "bytecode tidak dicek" : `bytecode ${bytes} B`,
    !sharedOk ? `bukan ${SHARED_EXECUTOR}` : "",
    exec.note,
    rpc.endpoint,
  ].filter(Boolean);
  return [
    chain.label,
    String(chain.chainId),
    rpcStatus,
    executor || "kosong",
    ready ? "Ready" : "Not Ready",
    notes.join(" · "),
  ];
}

function isSolanaPubkey(value: string): boolean {
  try {
    return bs58.decode(value).length === 32;
  } catch {
    return false;
  }
}

function resolveSolanaProgram(): { id: string; source: string; envSet: boolean } {
  for (const key of SOLANA_PROGRAM_ENV_KEYS) {
    const value = process.env[key]?.trim() ?? "";
    if (value) return { id: value, source: key, envSet: true };
  }
  return { id: KAMINO_KLEND_PROGRAM_ID, source: "KAMINO_KLEND_PROGRAM_ID", envSet: false };
}

async function timedRpc(url: string, method: string, params: unknown[] = []): Promise<{ result: unknown; ms: number }> {
  const started = Date.now();
  const result = await rpcCall(url, method, params);
  return { result, ms: Math.max(0, Date.now() - started) };
}

type SolanaAccount = {
  value?: { executable?: boolean; owner?: string } | null;
};

async function auditSolana(): Promise<string[]> {
  const urls = rpcUrls("solana");
  const program = resolveSolanaProgram();
  const pubkeyOk = isSolanaPubkey(program.id);
  let lastError = "tidak ada endpoint";
  let endpoint = urls[0] ? redactEndpoint(urls[0]) : "—";

  for (const url of urls) {
    endpoint = redactEndpoint(url);
    try {
      let health = "tidak dicek";
      let healthMs = 0;
      try {
        const healthCall = await timedRpc(url, "getHealth");
        health = typeof healthCall.result === "string" ? healthCall.result : "ok";
        healthMs = healthCall.ms;
      } catch (error) {
        health = error instanceof Error ? error.message : "getHealth gagal";
      }
      const first = await timedRpc(url, "getSlot", [{ commitment: "confirmed" }]);
      const second = await timedRpc(url, "getSlot", [{ commitment: "confirmed" }]);
      const firstSlot = Number(first.result);
      const slot = Number(second.result);
      if (!Number.isFinite(firstSlot) || firstSlot <= 0 || !Number.isFinite(slot) || slot <= 0) {
        throw new Error("getSlot tidak mengembalikan slot");
      }
      const slow = Math.max(first.ms, second.ms);
      const stable = slow <= 4_000;
      let executable = false;
      let owner = "";
      let accountError = pubkeyOk ? "" : "program id bukan pubkey Solana";
      if (pubkeyOk) {
        const account = (await rpcCall(url, "getAccountInfo", [
          program.id,
          { encoding: "base64", commitment: "confirmed" },
        ])) as SolanaAccount;
        if (!account?.value) {
          accountError = "akun program tidak ada";
        } else {
          executable = account.value.executable === true;
          owner = account.value.owner || "";
          if (!executable) accountError = "akun ada tetapi bukan program executable";
        }
      }
      const envNote = program.envSet
        ? `${program.source} terisi`
        : `${SOLANA_PROGRAM_ENV_KEYS.join(" dan ")} kosong · fallback ${program.source}`;
      const ready = pubkeyOk && executable && stable;
      const notes = [
        `getHealth ${health}${healthMs ? ` ${healthMs}ms` : ""}`,
        `getSlot ${first.ms}ms/${second.ms}ms${stable ? " stabil" : " tinggi"}`,
        envNote,
        executable ? `executable owner ${owner}` : accountError,
        endpoint,
      ].filter(Boolean);
      return [
        "Solana",
        "mainnet",
        `OK #${slot} · ${second.ms}ms`,
        program.id,
        ready ? "Ready" : "Not Ready",
        notes.join(" · "),
      ];
    } catch (error) {
      lastError = error instanceof Error ? error.message : "gagal";
    }
  }

  const envNote = program.envSet
    ? `${program.source} terisi`
    : `${SOLANA_PROGRAM_ENV_KEYS.join(" dan ")} kosong · fallback ${program.source}`;
  return [
    "Solana",
    "mainnet",
    lastError.slice(0, 42),
    program.id || "kosong",
    "Not Ready",
    [envNote, pubkeyOk ? "deploy tidak dicek" : "program id bukan pubkey Solana", endpoint].join(" · "),
  ];
}

async function auditFantom(): Promise<string[]> {
  const legacy = (process.env.BLOCKPI_RPC_FANTOM || "").trim();
  const rpc = legacy
    ? await probeRpc([legacy], 250)
    : { ok: false, chainId: null, block: null, url: "", endpoint: "—", error: "endpoint aktif tidak ada" };
  const rpcStatus = rpc.ok ? `OK #${rpc.block} (legacy)` : "Deprecated";
  return [
    "Fantom",
    "250",
    rpcStatus,
    "kosong",
    "Not Ready",
    "digantikan Monad chain 143 · tidak ada di EXECUTOR_BY_CHAIN_ID",
  ];
}

async function main(): Promise<void> {
  const header = ["Jaringan", "Chain ID", "Status RPC", "Alamat Executor", "Eksekusi"];
  const widths = [12, 8, 28, 44, 12];
  const rows = await Promise.all([
    ...ACTIVE.map((chain) => auditActive(chain)),
    auditSolana(),
    auditFantom(),
  ]);
  console.log("Audit multi-chain MEV · tanpa broadcast");
  console.log(header.map((cell, index) => pad(cell, widths[index])).join(" "));
  for (const row of rows) {
    console.log(row.slice(0, 5).map((cell, index) => pad(cell, widths[index])).join(" "));
  }
  console.log("\nCatatan");
  for (const row of rows) {
    console.log(`- ${row[0]} (${row[1]}): ${row[5]}`);
  }
  const notReady = rows.filter((row) => row[4] !== "Ready" && row[0] !== "Fantom");
  const mapGaps = rows.filter((row) => row[0] !== "Fantom" && row[5].includes("tidak ada di EXECUTOR_BY_CHAIN_ID"));
  console.log(`\n${rows.filter((row) => row[4] === "Ready").length}/${rows.length} Ready · Fantom Deprecated`);
  if (mapGaps.length > 0) {
    console.log(`Pemetaan EXECUTOR_BY_CHAIN_ID kosong untuk: ${mapGaps.map((row) => row[0]).join(", ")}`);
  }
  if (notReady.length > 0 || mapGaps.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
