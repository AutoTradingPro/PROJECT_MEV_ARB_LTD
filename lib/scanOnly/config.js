/**
 * Scan & Analysis Mode — terisolasi dari eksekusi on-chain / flash loan.
 * Toggle UI menulis BOT_MODE runtime; default aman = SCAN_ONLY.
 */

/** @typedef {"SCAN_ONLY" | "EXECUTE"} BotMode */

/** @type {BotMode} */
export const BOT_MODE = "SCAN_ONLY";

export const TARGET_PAIR_COUNT = 10;
export const MAX_PRICE_IMPACT_PCT = 1.0;
export const MIN_NET_PROFIT_USD = 10;
/** Batas atas spread wajar (glitch V3 vs V2). Override lewat Konfigurasi Operasional. */
export const MAX_ALLOWABLE_SPREAD_PCT = 5.0;

/**
 * Rute DEX A → DEX B per jaringan (indeks 0..9 dipasangkan ke 10 pair utama).
 * @type {Record<string, Array<[string, string]>>}
 */
export const DEX_A_TO_B_ROUTES = {
  polygon: [
    ["uniswap-v2", "quickswap"],
    ["uniswap-v2", "sushiswap-v2"],
    ["quickswap", "balancer-v2"],
    ["uniswap-v2", "balancer-v2"],
    ["quickswap", "sushiswap-v2"],
    ["sushiswap-v2", "balancer-v2"],
    ["uniswap-v2", "quickswap"],
    ["quickswap", "balancer-v2"],
    ["uniswap-v2", "sushiswap-v2"],
    ["sushiswap-v2", "quickswap"],
  ],
  ethereum: [
    ["uniswap-v2", "sushiswap-eth"],
    ["uniswap-v2", "balancer-v2"],
    ["sushiswap-eth", "balancer-v2"],
    ["uniswap-v2", "curve"],
    ["sushiswap-eth", "uniswap-v2"],
    ["balancer-v2", "uniswap-v2"],
    ["uniswap-v2", "sushiswap-eth"],
    ["curve", "uniswap-v2"],
    ["sushiswap-eth", "balancer-v2"],
    ["balancer-v2", "sushiswap-eth"],
  ],
  arbitrum: [
    ["uniswap-v2", "camelot"],
    ["uniswap-v2", "sushiswap-v2"],
    ["camelot", "balancer-v2"],
    ["uniswap-v2", "balancer-v2"],
    ["camelot", "sushiswap-v2"],
    ["sushiswap-v2", "balancer-v2"],
    ["uniswap-v2", "camelot"],
    ["camelot", "balancer-v2"],
    ["uniswap-v2", "sushiswap-v2"],
    ["sushiswap-v2", "camelot"],
  ],
  bsc: [
    ["pancake-v3", "pancake-v2"],
    ["pancake-v3", "biswap"],
    ["pancake-v2", "biswap"],
    ["pancake-v3", "pancake-v2"],
    ["pancake-v2", "pancake-v3"],
    ["biswap", "pancake-v3"],
    ["pancake-v3", "biswap"],
    ["pancake-v2", "biswap"],
    ["pancake-v3", "pancake-v2"],
    ["biswap", "pancake-v2"],
  ],
  optimism: [
    ["velodrome", "uniswap-v2"],
    ["velodrome", "sushiswap-v2"],
    ["uniswap-v2", "sushiswap-v2"],
    ["velodrome", "uniswap-v2"],
    ["uniswap-v2", "velodrome"],
    ["sushiswap-v2", "velodrome"],
    ["velodrome", "sushiswap-v2"],
    ["uniswap-v2", "sushiswap-v2"],
    ["velodrome", "uniswap-v2"],
    ["sushiswap-v2", "uniswap-v2"],
  ],
  avalanche: [
    ["traderjoe", "uniswap-avax"],
    ["traderjoe", "sushiswap-v2"],
    ["uniswap-avax", "sushiswap-v2"],
    ["traderjoe", "uniswap-avax"],
    ["uniswap-avax", "traderjoe"],
    ["sushiswap-v2", "traderjoe"],
    ["traderjoe", "sushiswap-v2"],
    ["uniswap-avax", "sushiswap-v2"],
    ["traderjoe", "uniswap-avax"],
    ["sushiswap-v2", "uniswap-avax"],
  ],
  base: [
    ["aerodrome", "uniswap-base"],
    ["aerodrome", "sushiswap-v2"],
    ["uniswap-base", "sushiswap-v2"],
    ["aerodrome", "uniswap-base"],
    ["uniswap-base", "aerodrome"],
    ["sushiswap-v2", "aerodrome"],
    ["aerodrome", "sushiswap-v2"],
    ["uniswap-base", "sushiswap-v2"],
    ["aerodrome", "uniswap-base"],
    ["sushiswap-v2", "uniswap-base"],
  ],
  fantom: [
    ["spookyswap", "sushiswap-v2"],
    ["sushiswap-v2", "spookyswap"],
    ["spookyswap", "sushiswap-v2"],
    ["sushiswap-v2", "spookyswap"],
    ["spookyswap", "sushiswap-v2"],
    ["sushiswap-v2", "spookyswap"],
    ["spookyswap", "sushiswap-v2"],
    ["sushiswap-v2", "spookyswap"],
    ["spookyswap", "sushiswap-v2"],
    ["sushiswap-v2", "spookyswap"],
  ],
};

/**
 * 10 pair utama per jaringan (katalog trading).
 * @type {Record<string, string[]>}
 */
export const TARGET_PAIR_IDS = {
  polygon: [
    "wmatic-usdc-pol",
    "wmatic-usdt-pol",
    "wmatic-weth-pol",
    "weth-usdc-pol",
    "weth-usdt-pol",
    "usdt-usdc-pol",
    "wbtc-weth-pol",
    "link-weth-pol",
    "aave-weth-pol",
    "matic-usdt-pol",
  ],
  ethereum: [
    "weth-usdc-eth",
    "weth-usdt-eth",
    "wbtc-weth-eth",
    "dai-usdc-eth",
    "link-weth-eth",
    "uni-weth-eth",
    "aave-weth-eth",
    "crv-weth-eth",
    "ldo-weth-eth",
    "mkr-weth-eth",
  ],
  arbitrum: [
    "weth-usdc-arb",
    "wbtc-weth-arb",
    "arb-weth",
    "link-weth-arb",
    "uni-weth-arb",
    "gmx-weth-arb",
    "usdt-usdc-arb",
    "dai-weth-arb",
    "magic-weth-arb",
    "pendle-weth-arb",
  ],
  bsc: [
    "wbnb-usdt",
    "wbnb-busd",
    "wbnb-usdc",
    "eth-wbnb",
    "btcb-wbnb",
    "cake-wbnb",
    "link-wbnb",
    "xrp-wbnb",
    "ada-wbnb",
    "doge-wbnb",
  ],
  optimism: [
    "weth-usdc-op",
    "op-weth",
    "wbtc-weth-op",
    "usdt-usdc-op",
    "snx-weth-op",
    "link-weth-op",
    "dai-weth-op",
    "aave-weth-op",
    "perp-weth-op",
    "ldo-weth-op",
  ],
  avalanche: [
    "wavax-usdce",
    "wavax-usdt",
    "wethe-wavax",
    "wbtce-wavax",
    "joe-wavax",
    "link-wavax",
    "daie-wavax",
    "aave-wavax",
    "qi-wavax",
    "usdc-usdt-avax",
  ],
  base: [
    "weth-usdbc-base",
    "weth-usdc-base",
    "cbeth-weth-base",
    "aero-weth-base",
    "toshi-weth-base",
    "brett-weth-base",
    "degen-weth-base",
    "link-weth-base",
    "dai-weth-base",
    "wbtc-weth-base",
  ],
  fantom: [
    "wftm-usdc",
    "wftm-usdt",
    "weth-wftm",
    "wbtc-wftm",
    "boo-wftm",
    "spirit-wftm",
    "link-wftm",
    "dai-wftm",
    "aave-wftm",
    "crv-wftm",
  ],
};
