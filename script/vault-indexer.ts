/**
 * Polls MevVault Deposit, Withdraw, and ArbExecuted logs into PostgreSQL.
 * Read-only RPC. No private key. Apply db/migrations/001_mev_vault.sql first.
 *
 * DATABASE_URL, VAULT_RPC_URL, VAULT_CHAIN_ID, VAULT_PROXY,
 * VAULT_ASSET, VAULT_IMPLEMENTATION, VAULT_ADMIN, VAULT_START_BLOCK
 */
import { Pool } from "pg";
import { createPublicClient, getAddress, http, isAddress, parseAbiItem, type Address } from "viem";

const DEPOSIT = parseAbiItem("event Deposited(address indexed user, uint256 assets, uint256 shares)");
const WITHDRAW = parseAbiItem("event Withdrawn(address indexed user, uint256 assets, uint256 shares)");
const ARB = parseAbiItem("event ArbExecuted(address indexed executor, address indexed midToken, uint256 amountIn, uint256 profit)");
const READ_ABI = [
  { type: "function", name: "userBalances", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "assetsOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const CHUNK = 2_000n;
const POLL_MS = 15_000;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} kosong`);
  return value;
}

function address(name: string): Address {
  const value = required(name);
  if (!isAddress(value)) throw new Error(`${name} bukan alamat`);
  return getAddress(value);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: required("DATABASE_URL"), max: 2 });
  const chainId = Number(required("VAULT_CHAIN_ID"));
  if (!Number.isInteger(chainId) || chainId <= 0) throw new Error("VAULT_CHAIN_ID tidak valid");
  const proxy = address("VAULT_PROXY");
  const asset = address("VAULT_ASSET");
  const implementation = address("VAULT_IMPLEMENTATION");
  const admin = address("VAULT_ADMIN");
  const startBlock = BigInt(process.env.VAULT_START_BLOCK?.trim() || "0");
  const client = createPublicClient({ transport: http(required("VAULT_RPC_URL")) });

  const cursorStart = startBlock > 0n ? startBlock - 1n : 0n;
  await pool.query(
    `INSERT INTO vault_deployments (chain_id, asset, proxy_address, implementation_address, admin_address, indexed_block)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (chain_id, proxy_address) DO UPDATE
       SET asset = EXCLUDED.asset,
           implementation_address = EXCLUDED.implementation_address,
           admin_address = EXCLUDED.admin_address`,
    [chainId, asset.toLowerCase(), proxy.toLowerCase(), implementation.toLowerCase(), admin.toLowerCase(), cursorStart.toString()],
  );

  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopped) {
    try {
      await indexOnce(pool, client, chainId, proxy, startBlock);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[vault-index] ${message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  await pool.end();
}

async function indexOnce(
  pool: Pool,
  client: ReturnType<typeof createPublicClient>,
  chainId: number,
  proxy: Address,
  startBlock: bigint,
): Promise<void> {
  const latest = await client.getBlockNumber();
  const cursor = await pool.query<{ indexed_block: string }>(
    "SELECT indexed_block FROM vault_deployments WHERE chain_id = $1 AND proxy_address = $2",
    [chainId, proxy.toLowerCase()],
  );
  let from = BigInt(cursor.rows[0]?.indexed_block ?? startBlock.toString());
  if (from < startBlock) from = startBlock;
  if (from >= latest) return;

  const to = from + CHUNK > latest ? latest : from + CHUNK;
  const logs = await client.getLogs({
    address: proxy,
    events: [DEPOSIT, WITHDRAW, ARB],
    fromBlock: from + 1n,
    toBlock: to,
  });

  for (const log of logs) {
    if (log.args == null || log.transactionHash == null || log.logIndex == null) continue;
    const base = [chainId, proxy.toLowerCase(), log.transactionHash, log.logIndex, log.blockNumber.toString()];
    if (log.eventName === "Deposited" || log.eventName === "Withdrawn") {
      const user = String(log.args.user).toLowerCase();
      const assets = (log.args.assets ?? 0n).toString();
      const shares = (log.args.shares ?? 0n).toString();
      await pool.query(
        `INSERT INTO vault_events (chain_id, proxy_address, tx_hash, log_index, kind, user_address, assets, shares, profit, block_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9)
         ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING`,
        [...base.slice(0, 4), log.eventName === "Deposited" ? "deposit" : "withdraw", user, assets, shares, base[4]],
      );
      await refreshPosition(pool, client, chainId, proxy, user as Address);
    } else if (log.eventName === "ArbExecuted") {
      const executor = String(log.args.executor).toLowerCase();
      await pool.query(
        `INSERT INTO vault_events (chain_id, proxy_address, tx_hash, log_index, kind, user_address, assets, shares, profit, block_number)
         VALUES ($1, $2, $3, $4, 'arb', $5, $6, NULL, $7, $8)
         ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING`,
        [...base.slice(0, 4), executor, (log.args.amountIn ?? 0n).toString(), (log.args.profit ?? 0n).toString(), base[4]],
      );
    }
  }

  await pool.query(
    "UPDATE vault_deployments SET indexed_block = $3 WHERE chain_id = $1 AND proxy_address = $2",
    [chainId, proxy.toLowerCase(), to.toString()],
  );
  if (logs.length > 0) console.log(`[vault-index] ${logs.length} log · blok ${to.toString()}`);
}

async function refreshPosition(
  pool: Pool,
  client: ReturnType<typeof createPublicClient>,
  chainId: number,
  proxy: Address,
  user: Address,
): Promise<void> {
  const [shares, assets] = await Promise.all([
    client.readContract({ address: proxy, abi: READ_ABI, functionName: "userBalances", args: [user] }),
    client.readContract({ address: proxy, abi: READ_ABI, functionName: "assetsOf", args: [user] }),
  ]);
  await pool.query(
    `INSERT INTO vault_position_cache (wallet_address, chain_id, proxy_address, shares, assets, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (wallet_address, chain_id, proxy_address) DO UPDATE
       SET shares = EXCLUDED.shares, assets = EXCLUDED.assets, updated_at = now()`,
    [user.toLowerCase(), chainId, proxy.toLowerCase(), shares.toString(), assets.toString()],
  );
}

main().catch((err) => {
  console.error(`[vault-index] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
