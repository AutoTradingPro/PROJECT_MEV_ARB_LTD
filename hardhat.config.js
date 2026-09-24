/**
 * Hardhat networks for BalancerFlashArb deploy.
 * Polygon PoS chainId 137. Foundry (`npm run deploy:balancer-arb:polygon`) is the primary path.
 *
 * Server env only (never NEXT_PUBLIC_ for keys or keyed RPCs):
 *   BLOCKPI_RPC_POLYGON (preferred) / POLYGON_RPC_URL fallback
 *   PRIVATE_KEY_POLYGON (required; not PRIVATE_KEY)
 *   BLOCKPI_RPC_ARBITRUM / PRIVATE_KEY_ARBITRUM
 *   BLOCKPI_RPC_ETHEREUM / PRIVATE_KEY_ETHEREUM
 */
const fs = require("fs");
const path = require("path");

function loadEnvLocal() {
  const file = path.join(__dirname, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvLocal();

function env(name) {
  return (process.env[name] || "").trim();
}

function accountsFor(...names) {
  for (const name of names) {
    const pk = env(name);
    if (pk) return [pk.startsWith("0x") ? pk : `0x${pk}`];
  }
  return [];
}

module.exports = {
  solidity: "0.8.24",
  networks: {
    polygon: {
      url: env("BLOCKPI_RPC_POLYGON") || env("POLYGON_EXEC_RPC_URL") || "",
      chainId: 137,
      accounts: accountsFor("PRIVATE_KEY_POLYGON"),
    },
    arbitrum: {
      url:
        env("BLOCKPI_RPC_ARBITRUM") ||
        env("ARBITRUM_EXEC_RPC_URL") ||
        env("NEXT_PUBLIC_ARBITRUM_FLASHBOTS_RPC_URL") ||
        "",
      chainId: 42161,
      accounts: accountsFor("PRIVATE_KEY_ARBITRUM", "PRIVATE_KEY"),
    },
    ethereum: {
      url: env("BLOCKPI_RPC_ETHEREUM") || env("ETHEREUM_EXEC_RPC_URL") || "",
      chainId: 1,
      accounts: accountsFor("PRIVATE_KEY_ETHEREUM"),
    },
  },
};
