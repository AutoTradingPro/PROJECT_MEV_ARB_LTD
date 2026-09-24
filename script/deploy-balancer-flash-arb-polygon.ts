/**
 * Deploy BalancerFlashArb to Polygon PoS (chain id 137), separate from Arbitrum.
 *
 *   npm run deploy:balancer-arb:polygon
 *
 * Server .env.local only — never NEXT_PUBLIC_ for these:
 *   BLOCKPI_RPC_POLYGON                       deploy/broadcast RPC (required)
 *   PRIVATE_KEY_POLYGON                       deployer Polygon-only (never PRIVATE_KEY)
 *   POLYGON_BALANCER_VAULT / BALANCER_VAULT   optional; default Balancer V2 Vault
 *   WRAPPED_NATIVE_POLYGON                    optional; default WMATIC
 */
process.env.CHAIN = "polygon";
process.env.FORCE_DEPLOY_CHAIN = "polygon";
require("./deploy-balancer-flash-arb.ts");
