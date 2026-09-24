/**
 * Deploy BalancerFlashArb via Foundry (preferred) or print the forge command.
 *
 *   npx tsx --env-file=.env.local script/deploy-balancer-flash-arb.ts
 *   npx tsx --env-file=.env.local script/deploy-balancer-flash-arb.ts --network polygon
 *   npm run deploy:balancer-arb:polygon
 *
 * Server .env.local only (never NEXT_PUBLIC_ for keys or keyed RPCs):
 *   BLOCKPI_RPC_POLYGON                      Polygon deploy/broadcast RPC
 *   PRIVATE_KEY_POLYGON                      deployer key Polygon-only (never PRIVATE_KEY)
 *   POLYGON_BALANCER_VAULT / BALANCER_VAULT  optional vault override
 *   WRAPPED_NATIVE                           optional; Polygon defaults to WMATIC
 *   BLOCKPI_RPC_ETHEREUM                     Ethereum deploy/broadcast RPC
 *   PRIVATE_KEY_ETHEREUM                     deployer key Ethereum-only (never PRIVATE_KEY)
 *   WRAPPED_NATIVE_ETHEREUM                  optional; default WETH
 *   BLOCKPI_RPC_ARBITRUM / PRIVATE_KEY_ARBITRUM
 *   CHAIN                                    ethereum | polygon | arbitrum
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BALANCER_V2_VAULT,
  POLYGON_CHAIN_ID,
  POLYGON_WMATIC,
  balancerVaultForChainId,
} from "../config/networks";
import { redactSensitiveUrl } from "../lib/security/redactUrl";
import { Wallet } from "ethers";

const WRAPPED: Record<string, string> = {
  ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  polygon: POLYGON_WMATIC,
  arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
};

const EVM_CHAIN_ID: Record<string, number> = {
  ethereum: 1,
  polygon: POLYGON_CHAIN_ID,
  arbitrum: 42161,
};

function env(name: string, fallback = ""): string {
  return (process.env[name] || fallback).trim();
}

function networkFromArgv(): string {
  const argv = process.argv.slice(2);
  const flag = argv.findIndex((item) => item === "--network" || item === "--chain");
  if (flag >= 0 && argv[flag + 1]) return argv[flag + 1].trim().toLowerCase();
  const eq = argv.find((item) => item.startsWith("--network=") || item.startsWith("--chain="));
  if (!eq) return "";
  return eq.slice(eq.indexOf("=") + 1).trim().toLowerCase();
}

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = env(key);
    if (value) return value;
  }
  return "";
}

function rpcFor(chain: string): string {
  if (chain === "polygon") return firstEnv("BLOCKPI_RPC_POLYGON");
  if (chain === "ethereum") return firstEnv("BLOCKPI_RPC_ETHEREUM");
  if (chain === "arbitrum") {
    return firstEnv(
      "BLOCKPI_RPC_ARBITRUM",
      "ARBITRUM_EXEC_RPC_URL",
      "NEXT_PUBLIC_ARBITRUM_FLASHBOTS_RPC_URL"
    );
  }
  return "";
}

function pkFor(chain: string): string {
  if (chain === "polygon") return env("PRIVATE_KEY_POLYGON");
  if (chain === "ethereum") return env("PRIVATE_KEY_ETHEREUM");
  if (chain === "arbitrum") return env("PRIVATE_KEY_ARBITRUM");
  return "";
}

function vaultFor(chain: string): string {
  const evmId = EVM_CHAIN_ID[chain] ?? 1;
  if (chain === "polygon") {
    return env("POLYGON_BALANCER_VAULT") || env("BALANCER_VAULT") || balancerVaultForChainId(evmId);
  }
  return env("BALANCER_VAULT") || balancerVaultForChainId(evmId);
}

const chain = (
  env("FORCE_DEPLOY_CHAIN") ||
  networkFromArgv() ||
  env("CHAIN", "arbitrum") ||
  "arbitrum"
).toLowerCase();
const rpc = rpcFor(chain);
const pk = pkFor(chain);
const wrapped =
  chain === "polygon"
    ? env("WRAPPED_NATIVE_POLYGON") || env("WRAPPED_NATIVE", WRAPPED.polygon)
    : chain === "ethereum"
      ? env("WRAPPED_NATIVE_ETHEREUM") || env("WRAPPED_NATIVE", WRAPPED.ethereum)
      : env("WRAPPED_NATIVE", WRAPPED[chain] || "");
const vault = vaultFor(chain);
const minProfit = env("MIN_PROFIT_WEI", "0");

if (!rpc) {
  console.error(
    chain === "polygon"
      ? "Set BLOCKPI_RPC_POLYGON in .env.local (server only)."
      : chain === "ethereum"
        ? "Set BLOCKPI_RPC_ETHEREUM in .env.local (server only)."
        : "Set BLOCKPI_RPC_ARBITRUM / BLOCKPI_RPC_POLYGON / BLOCKPI_RPC_ETHEREUM."
  );
  process.exit(1);
}
if (!pk) {
  console.error(
    chain === "polygon"
      ? "Set PRIVATE_KEY_POLYGON in .env.local (server only). Deploy Polygon tidak memakai PRIVATE_KEY universal."
      : chain === "ethereum"
        ? "Set PRIVATE_KEY_ETHEREUM in .env.local (server only). Deploy Ethereum tidak memakai PRIVATE_KEY universal."
        : "Set PRIVATE_KEY_ARBITRUM in .env.local (server only)."
  );
  process.exit(1);
}
if (!wrapped) {
  console.error("Set WRAPPED_NATIVE or CHAIN=ethereum|polygon|arbitrum.");
  process.exit(1);
}

const deployer = new Wallet(pk.startsWith("0x") ? pk : `0x${pk}`);
const broadcastPath = path.join(
  process.cwd(),
  "broadcast",
  "DeployBalancerFlashArb.s.sol",
  String(EVM_CHAIN_ID[chain] ?? 0),
  "run-latest.json"
);

function hexToBigInt(value: string): bigint {
  const hex = (value || "0x0").replace(/^0x/i, "");
  return hex ? BigInt(`0x${hex}`) : 0n;
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

async function ethereumFeeFlags(): Promise<string[]> {
  const publicRpc = "https://ethereum.publicnode.com";
  const [gasPriceHex, balanceHex] = await Promise.all([
    rpcCall(publicRpc, "eth_gasPrice") as Promise<string>,
    rpcCall(publicRpc, "eth_getBalance", [deployer.address, "latest"]) as Promise<string>,
  ]);
  const gasPrice = hexToBigInt(gasPriceHex);
  const balance = hexToBigInt(balanceHex);
  const gasLimit = 2_500_000n;
  const floor = 500_000_000n;
  let maxFee = gasPrice * 6n;
  if (maxFee < floor) maxFee = floor;
  const affordable = balance > 0n ? (balance * 70n) / 100n / gasLimit : 0n;
  if (affordable > 0n && maxFee > affordable) maxFee = affordable;
  if (maxFee <= 0n) {
    throw new Error("Ethereum deployer ETH balance is too low to cover CREATE gas.");
  }
  let priority = maxFee / 2n;
  if (priority < 200_000_000n) priority = maxFee < 200_000_000n ? maxFee : 200_000_000n;
  if (priority >= maxFee) priority = maxFee > 1n ? maxFee - 1n : maxFee;
  console.log(
    `Ethereum fees maxFee=${maxFee} wei (${Number(maxFee) / 1e9} gwei) priority=${priority} wei publicGasPrice=${gasPrice} wei balanceWei=${balance}`
  );
  return [
    "--with-gas-price",
    maxFee.toString(),
    "--priority-gas-price",
    priority.toString(),
    "--timeout",
    "180",
    "--rpc-timeout",
    "60",
  ];
}

function shouldResumeEthereum(): boolean {
  if (chain !== "ethereum" || !existsSync(broadcastPath)) return false;
  try {
    const json = JSON.parse(readFileSync(broadcastPath, "utf8")) as {
      receipts?: unknown[];
      transactions?: unknown[];
    };
    return (json.transactions?.length || 0) > 0 && (json.receipts?.length || 0) === 0;
  } catch {
    return false;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function confirmOnPublicNode(txHash: string): Promise<boolean> {
  const publicRpc = "https://ethereum.publicnode.com";
  let seen = false;
  for (let i = 0; i < 36; i++) {
    try {
      const tx = await rpcCall(publicRpc, "eth_getTransactionByHash", [txHash]);
      if (tx && typeof tx === "object") {
        seen = true;
        const rec = await rpcCall(publicRpc, "eth_getTransactionReceipt", [txHash]);
        const block = rec && typeof rec === "object" ? (rec as { blockNumber?: string }).blockNumber : undefined;
        if (block) {
          console.log(`Public node confirmed ${txHash} in block ${block}`);
          return true;
        }
        console.log(`Public node mempool hit ${txHash} (waiting for receipt)`);
      }
    } catch (err) {
      console.warn(`Public node poll failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(5000);
  }
  if (seen) {
    console.error(`Public node saw ${txHash} in mempool but it did not confirm in time.`);
    return true;
  }
  console.error(`Public node never saw ${txHash} (not in mempool after ~3 min).`);
  return false;
}

async function main(): Promise<void> {
  const resume = shouldResumeEthereum();
  const args = [
    "script",
    "script/DeployBalancerFlashArb.s.sol:DeployBalancerFlashArb",
    "--rpc-url",
    rpc,
    "--sender",
    deployer.address,
    "--private-key",
    pk,
  ];
  args.push("--broadcast");
  if (resume) {
    args.push("--resume");
    console.log("Resuming discarded Ethereum CREATE with replacement fees.");
  }
  if (chain === "polygon") args.push("--chain-id", "137");
  if (chain === "arbitrum") args.push("--chain-id", "42161");
  if (chain === "ethereum") {
    args.push("--chain-id", "1");
    args.push(...(await ethereumFeeFlags()));
  }

  console.log(`Deploying BalancerFlashArb on ${chain} (evm ${EVM_CHAIN_ID[chain] ?? "?"})`);
  console.log(`RPC ${redactSensitiveUrl(rpc)}`);
  console.log(`Vault ${vault}`);
  console.log(`Wrapped ${wrapped}`);
  console.log(
    `Sender ${deployer.address}${
      chain === "polygon"
        ? " (PRIVATE_KEY_POLYGON)"
        : chain === "ethereum"
          ? " (PRIVATE_KEY_ETHEREUM)"
          : chain === "arbitrum"
            ? " (PRIVATE_KEY_ARBITRUM)"
            : ""
    }`
  );
  if (vault.toLowerCase() !== BALANCER_V2_VAULT.toLowerCase()) {
    console.warn("Vault override is not the canonical Balancer V2 address.");
  }

  const forgeEnv = {
    ...process.env,
    BALANCER_VAULT: vault,
    WRAPPED_NATIVE: wrapped,
    MIN_PROFIT_WEI: minProfit,
    BLOCKPI_RPC_POLYGON: chain === "polygon" ? rpc : env("BLOCKPI_RPC_POLYGON"),
    BLOCKPI_RPC_ARBITRUM: chain === "arbitrum" ? rpc : env("BLOCKPI_RPC_ARBITRUM"),
    BLOCKPI_RPC_ETHEREUM: chain === "ethereum" ? rpc : env("BLOCKPI_RPC_ETHEREUM"),
  };

  const result = spawnSync("forge", args, {
    encoding: "utf8",
    env: forgeEnv,
    shell: true,
    stdio: "inherit",
  });

  if (result.error || result.status !== 0) {
    console.error("\nforge gagal atau belum terpasang. Install Foundry lalu:");
    console.error("  forge install foundry-rs/forge-std --no-git");
    console.error(
      "  forge script script/DeployBalancerFlashArb.s.sol:DeployBalancerFlashArb --rpc-url $BLOCKPI_RPC_POLYGON --broadcast"
    );
    process.exit(result.status || 1);
  }

  const confirmed = confirmedCreateFromBroadcast(EVM_CHAIN_ID[chain] ?? 0);
  if (!confirmed.address || !confirmed.txHash) {
    console.error(`${chain} broadcast finished without a confirmed CREATE receipt. Not writing .env.local.`);
    process.exit(1);
  }
  if (chain === "ethereum") {
    const seen = await confirmOnPublicNode(confirmed.txHash);
    if (!seen) process.exit(1);
  }
  persistDeploy(confirmed.address, confirmed.txHash);
}

function confirmedCreateFromBroadcast(evmId: number): { address: string; txHash: string } {
  const latest = path.join(
    process.cwd(),
    "broadcast",
    "DeployBalancerFlashArb.s.sol",
    String(evmId),
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
      (tx) => tx.transactionType === "CREATE" && /BalancerFlashArb/i.test(tx.contractName || "")
    );
    const receiptOk = (json.receipts || []).some(
      (receipt) => receipt.status === "0x1" || receipt.status === "1"
    );
    if (!receiptOk) {
      return { address: "", txHash: created?.hash || json.transactions?.[0]?.hash || "" };
    }
    return {
      address: created?.contractAddress || json.receipts?.[0]?.contractAddress || "",
      txHash: created?.hash || json.receipts?.[0]?.transactionHash || "",
    };
  } catch {
    return { address: "", txHash: "" };
  }
}

function upsertEnv(file: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=`, "m").test(file)) {
    return file.replace(new RegExp(`^${key}=.*$`, "m"), line);
  }
  return `${file.trimEnd()}\n${line}\n`;
}

function persistDeploy(deployed: string, txHash: string): void {
  if (!deployed) return;
  console.log(`\nDeployed ${chain} BalancerFlashArb: ${deployed}${txHash ? ` tx ${txHash}` : ""}`);
  const recordDir = path.join(process.cwd(), "broadcast");
  mkdirSync(recordDir, { recursive: true });
  writeFileSync(
    path.join(recordDir, `${chain}-balancer-flash-arb.json`),
    JSON.stringify(
      {
        chainId: EVM_CHAIN_ID[chain],
        network: chain,
        contract: "BalancerFlashArb",
        address: deployed,
        txHash,
        vault,
        wrappedNative: wrapped,
        rpc: redactSensitiveUrl(rpc),
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  if (chain === "polygon" || chain === "ethereum" || chain === "arbitrum") {
    const envPath = path.join(process.cwd(), ".env.local");
    if (existsSync(envPath)) {
      let envText = readFileSync(envPath, "utf8");
      if (chain === "polygon") {
        envText = upsertEnv(envText, "NEXT_PUBLIC_POLYGON_ARBITRAGE_EXECUTOR", deployed);
        envText = upsertEnv(envText, "POLYGON_BALANCER_FLASH_ARB", deployed);
        console.log("Wrote NEXT_PUBLIC_POLYGON_ARBITRAGE_EXECUTOR and POLYGON_BALANCER_FLASH_ARB to .env.local");
      } else if (chain === "ethereum") {
        envText = upsertEnv(envText, "NEXT_PUBLIC_ETHEREUM_ARBITRAGE_EXECUTOR", deployed);
        envText = upsertEnv(envText, "ETHEREUM_BALANCER_FLASH_ARB", deployed);
        console.log("Wrote NEXT_PUBLIC_ETHEREUM_ARBITRAGE_EXECUTOR and ETHEREUM_BALANCER_FLASH_ARB to .env.local");
      } else {
        envText = upsertEnv(envText, "NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR", deployed);
        envText = upsertEnv(envText, "NEXT_PUBLIC_BALANCER_FLASH_ARB", deployed);
        envText = upsertEnv(envText, "ARBITRUM_BALANCER_FLASH_ARB", deployed);
        console.log("Wrote NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR and NEXT_PUBLIC_BALANCER_FLASH_ARB to .env.local");
      }
      writeFileSync(envPath, envText);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
