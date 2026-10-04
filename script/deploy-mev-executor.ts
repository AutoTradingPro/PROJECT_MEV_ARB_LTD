/**
 * Deploy MevExecutor ke Optimism, Base, Avalanche, Fantom, dan Linea.
 *
 *   npm run deploy:executors
 *   npm run deploy:executor:optimism
 *   npx tsx --env-file=.env.local script/deploy-mev-executor.ts --network linea
 *   npx tsx --env-file=.env.local script/deploy-mev-executor.ts --network base --force
 *
 * Gas dibayar signer PRIVATE_KEY_<CHAIN>, lalu PRIVATE_KEY, lalu kunci EVM
 * yang sudah aktif (PRIVATE_KEY_ETHEREUM / POLYGON / ARBITRUM / BSC / EXECUTOR_PRIVATE_KEY).
 * Setelah CREATE terkonfirmasi, NEXT_PUBLIC_<CHAIN>_ARBITRAGE_EXECUTOR ditulis ke .env.local.
 * Chain yang sudah punya alamat itu dilewati, kecuali --force.
 * Skrip ini tidak mencetak private key.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Wallet } from "ethers";
import { redactSensitiveUrl } from "../lib/security/redactUrl";
import {
  AMM_LOAN_BPS,
  assertDynamicSizingBps,
  KIND_AAVE_V3,
  KIND_BALANCER,
  KIND_PANCAKE_V3,
  KIND_UNISWAP_V3_FLASH,
  MEV_EXECUTOR_DEPLOY_TARGETS,
  V3_LOAN_BPS,
  type MevExecutorTarget,
} from "./mev-executor-targets";

const ZERO = "0x0000000000000000000000000000000000000000";

function env(name: string): string {
  return (process.env[name] || "").trim();
}

function networkFromArgv(): string {
  const argv = process.argv.slice(2);
  const flag = argv.findIndex((item) => item === "--network" || item === "--chain");
  if (flag >= 0 && argv[flag + 1]) return argv[flag + 1].trim().toLowerCase();
  const eq = argv.find((item) => item.startsWith("--network=") || item.startsWith("--chain="));
  if (!eq) return "";
  return eq.slice(eq.indexOf("=") + 1).trim().toLowerCase();
}

function normalizeKey(value: string): string {
  return value.startsWith("0x") ? value : `0x${value}`;
}

const ACTIVE_SIGNER_KEYS = [
  "PRIVATE_KEY_ETHEREUM",
  "PRIVATE_KEY_POLYGON",
  "PRIVATE_KEY_ARBITRUM",
  "PRIVATE_KEY_BSC",
  "EXECUTOR_PRIVATE_KEY",
] as const;

function signerFor(chain: string): { wallet: Wallet; source: string } {
  const names = [`PRIVATE_KEY_${chain.toUpperCase()}`, "PRIVATE_KEY", ...ACTIVE_SIGNER_KEYS];
  for (const name of names) {
    const value = env(name);
    if (!value) continue;
    return { wallet: new Wallet(normalizeKey(value)), source: name };
  }
  throw new Error(
    `PRIVATE_KEY_${chain.toUpperCase()}, PRIVATE_KEY, dan kunci signer EVM aktif kosong. Signer tidak bisa membayar gas.`
  );
}

function rpcFor(chain: string): string {
  const key = `BLOCKPI_RPC_${chain.toUpperCase()}`;
  const rpc = env(key);
  if (!rpc) throw new Error(`${key} kosong.`);
  return rpc;
}

function flashSourceFor(target: MevExecutorTarget): string {
  if (target.kind === KIND_PANCAKE_V3) {
    return env("LINEA_PANCAKE_V3_FACTORY") || target.flashSource;
  }
  if (target.kind === KIND_AAVE_V3) {
    return env(`${target.chain.toUpperCase()}_AAVE_V3_POOL`) || target.flashSource;
  }
  if (target.kind === KIND_UNISWAP_V3_FLASH) {
    return env(`${target.chain.toUpperCase()}_UNISWAP_V3_FACTORY`) || target.flashSource;
  }
  return env(`${target.chain.toUpperCase()}_BALANCER_VAULT`) || target.flashSource;
}

function wrappedFor(target: MevExecutorTarget, singleChain: boolean): string {
  return (
    env(`WRAPPED_NATIVE_${target.chain.toUpperCase()}`) ||
    (singleChain ? env("WRAPPED_NATIVE") : "") ||
    target.wrappedNative
  );
}

function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value) && value.toLowerCase() !== ZERO;
}

function hexToBigInt(value: string): bigint {
  const hex = (value || "0x0").replace(/^0x/i, "");
  return hex ? BigInt(`0x${hex}`) : 0n;
}

/** Gas CREATE dari simulasi Forge sebelumnya, sebelum buffer 130%. */
/** CREATE bytecode MevExecutor ~17 KB. Angka ini hanya pagar saldo, bukan gas limit transaksi. */
const CREATE_GAS_UNITS = 6_000_000n;

async function affordableGasArgs(rpc: string, balance: bigint): Promise<string[]> {
  let gasPrice = 0n;
  try {
    gasPrice = hexToBigInt(String(await rpcCall(rpc, "eth_gasPrice")));
  } catch {
    return [];
  }
  if (gasPrice <= 0n) return [];
  const paddedCost = ((CREATE_GAS_UNITS * 130n) / 100n) * gasPrice;
  if (paddedCost <= balance) return [];
  const budget = (balance * 95n) / 100n;
  const minimum = CREATE_GAS_UNITS * gasPrice;
  if (minimum > budget) {
    throw new Error(
      `Saldo tidak cukup untuk CREATE. Saldo ${balance} wei, perkiraan minimum ${minimum} wei. Env tidak ditulis.`
    );
  }
  const multiplier = (budget * 100n) / minimum;
  const capped = multiplier > 130n ? 130n : multiplier;
  return ["--gas-estimate-multiplier", capped.toString()];
}

async function rpcCall(url: string, method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (json.error?.message) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

function upsertEnv(file: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=`, "m").test(file)) {
    return file.replace(new RegExp(`^${key}=.*$`, "m"), line);
  }
  return `${file.trimEnd()}\n${line}\n`;
}

function confirmedCreate(chainId: number): { address: string; txHash: string } {
  const latest = path.join(
    process.cwd(),
    "broadcast",
    "DeployMevExecutor.s.sol",
    String(chainId),
    "run-latest.json"
  );
  if (!existsSync(latest)) return { address: "", txHash: "" };
  try {
    const json = JSON.parse(readFileSync(latest, "utf8")) as {
      receipts?: { status?: string; transactionHash?: string; contractAddress?: string }[];
      transactions?: {
        hash?: string;
        transactionType?: string;
        contractName?: string;
        contractAddress?: string;
      }[];
    };
    const created = json.transactions?.find(
      (tx) => tx.transactionType === "CREATE" && /MevExecutor/i.test(tx.contractName || "")
    );
    const receipt = (json.receipts || []).find(
      (item) =>
        (item.status === "0x1" || item.status === "1") &&
        (item.contractAddress || item.transactionHash === created?.hash)
    );
    if (!receipt) return { address: "", txHash: created?.hash || "" };
    return {
      address: created?.contractAddress || receipt.contractAddress || "",
      txHash: created?.hash || receipt.transactionHash || "",
    };
  } catch {
    return { address: "", txHash: "" };
  }
}

function persistDeploy(
  target: MevExecutorTarget,
  deployed: string,
  txHash: string,
  rpc: string,
  source: string,
  wrapped: string,
  signer: string
): void {
  const recordDir = path.join(process.cwd(), "broadcast");
  mkdirSync(recordDir, { recursive: true });
  writeFileSync(
    path.join(recordDir, `${target.chain}-mev-executor.json`),
    JSON.stringify(
      {
        chainId: target.chainId,
        network: target.chain,
        contract: "MevExecutor",
        address: deployed,
        txHash,
        kind: target.kind,
        providerId: target.providerId,
        providerName: target.providerName,
        flashFee: target.flashFee,
        feePpm: target.feePpm,
        v3LoanBps: V3_LOAN_BPS,
        ammLoanBps: AMM_LOAN_BPS,
        flashSource: source,
        wrappedNative: wrapped,
        signer,
        rpc: redactSensitiveUrl(rpc),
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  const envPath = path.join(process.cwd(), ".env.local");
  let envText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  for (const key of target.envKeys) {
    envText = upsertEnv(envText, key, deployed);
  }
  writeFileSync(envPath, envText.endsWith("\n") ? envText : `${envText}\n`);
  console.log(`Menulis ${target.envKeys.join(" dan ")} ke .env.local`);
}

async function deployOne(target: MevExecutorTarget, singleChain: boolean, force: boolean): Promise<void> {
  const primaryKey = target.envKeys[0];
  const existing = env(primaryKey);
  if (!force && isAddress(existing)) {
    console.log(`${target.chain} sudah punya ${primaryKey}=${existing}. Lewati (pakai --force untuk deploy ulang).`);
    return;
  }

  assertDynamicSizingBps();
  const rpc = rpcFor(target.chain);
  const { wallet, source: keySource } = signerFor(target.chain);
  const flashSource = flashSourceFor(target);
  const wrapped = wrappedFor(target, singleChain);
  if (!isAddress(flashSource)) throw new Error(`Flash source ${target.chain} bukan alamat.`);
  if (!isAddress(wrapped)) throw new Error(`Wrapped native ${target.chain} bukan alamat.`);
  if (target.kind === KIND_BALANCER && target.flashFee !== 0) {
    throw new Error(`${target.chain} Balancer harus fee 0.`);
  }
  if (target.kind === KIND_PANCAKE_V3 && target.flashFee !== 100) {
    throw new Error(`${target.chain} PancakeSwap V3 harus fee tier 100.`);
  }
  if (target.kind === KIND_AAVE_V3 && target.flashFee !== 900) {
    throw new Error(`${target.chain} Aave V3 harus fee 900 ppm.`);
  }
  if (target.kind === KIND_UNISWAP_V3_FLASH && target.flashFee !== 100) {
    throw new Error(`${target.chain} Uniswap V3 flash harus fee tier 100.`);
  }

  const chainHex = String(await rpcCall(rpc, "eth_chainId"));
  if (Number(chainHex) !== target.chainId) {
    throw new Error(`RPC ${target.chain} chain id ${chainHex} bukan ${target.chainId}.`);
  }
  const balance = hexToBigInt(String(await rpcCall(rpc, "eth_getBalance", [wallet.address, "latest"])));
  if (balance === 0n) {
    throw new Error(`Saldo ${target.nativeSymbol} signer ${wallet.address} kosong. Env tidak ditulis.`);
  }
  const code = String(await rpcCall(rpc, "eth_getCode", [flashSource, "latest"]));
  if (!code || code === "0x" || code === "0x0") {
    throw new Error(
      `Flash source ${flashSource} tidak punya bytecode di ${target.chain}. Env tidak ditulis.`
    );
  }

  const gasArgs = await affordableGasArgs(rpc, balance);
  console.log(`Deploy MevExecutor ${target.chain} (evm ${target.chainId})`);
  console.log(`RPC ${redactSensitiveUrl(rpc)}`);
  console.log(`Signer ${wallet.address} (${keySource}) saldo wei ${balance}`);
  if (gasArgs.length > 0) {
    console.log(`Gas estimate multiplier ${gasArgs[1]} agar biaya CREATE muat di saldo.`);
  }
  console.log(
    `Provider ${target.providerName} fee ${target.feePpm} ppm · kind ${target.kind} · source ${flashSource}`
  );
  console.log(`Wrapped ${wrapped} · sizing V3 ${V3_LOAN_BPS} bps / AMM ${AMM_LOAN_BPS} bps`);

  const forgeEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DEPLOYER_PK: normalizeKey(keySource === "PRIVATE_KEY" ? env("PRIVATE_KEY") : env(keySource)),
    FLASH_SOURCE: flashSource,
    WRAPPED_NATIVE: wrapped,
    FLASH_KIND: String(target.kind),
    FLASH_FEE: String(target.flashFee),
    EXPECTED_CHAIN_ID: String(target.chainId),
  };

  const result = spawnSync(
    "forge",
    [
      "script",
      "script/DeployMevExecutor.s.sol:DeployMevExecutor",
      "--rpc-url",
      rpc,
      "--broadcast",
      "--chain-id",
      String(target.chainId),
      "--sender",
      wallet.address,
      "--timeout",
      "180",
      "--non-interactive",
      ...gasArgs,
    ],
    {
      encoding: "utf8",
      env: forgeEnv,
      shell: false,
      stdio: "inherit",
    }
  );

  if (result.error || result.status !== 0) {
    throw new Error(`forge gagal di ${target.chain} (status ${result.status ?? "unknown"}). Env tidak ditulis.`);
  }

  const confirmed = confirmedCreate(target.chainId);
  if (!isAddress(confirmed.address) || !confirmed.txHash) {
    throw new Error(`${target.chain} tidak punya receipt CREATE terkonfirmasi. Env tidak ditulis.`);
  }

  console.log(`Deployed ${target.chain} MevExecutor ${confirmed.address} tx ${confirmed.txHash}`);
  persistDeploy(target, confirmed.address, confirmed.txHash, rpc, flashSource, wrapped, wallet.address);
}

async function main(): Promise<void> {
  assertDynamicSizingBps();
  const requested = networkFromArgv();
  const force = process.argv.includes("--force");
  const selected = requested
    ? MEV_EXECUTOR_DEPLOY_TARGETS.filter((target) => target.chain === requested)
    : [...MEV_EXECUTOR_DEPLOY_TARGETS];
  if (requested && selected.length === 0) {
    throw new Error("Jaringan tidak dikenal. Gunakan optimism, base, avalanche, fantom, atau linea.");
  }

  const failures: string[] = [];
  for (const target of selected) {
    try {
      await deployOne(target, selected.length === 1, force);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${target.chain}: ${message}`);
      console.error(`[deploy] ${target.chain}: ${message}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n[deploy] ${failures.length} jaringan gagal.`);
    process.exit(1);
  }
  console.log("\n[deploy] selesai.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
