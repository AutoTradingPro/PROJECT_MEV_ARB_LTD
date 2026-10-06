export type DexId =
  | "pancake-v2"
  | "pancake-v3"
  | "biswap"
  | "mdex"
  | "bakeryswap"
  | "sushiswap-v2"
  | "uniswap-v2"
  | "uniswap-base"
  | "uniswap-avax"
  | "uniswap-linea"
  | "uniswap-monad"
  | "camelot"
  | "quickswap"
  | "balancer-v2"
  | "sushiswap-eth"
  | "curve"
  | "velodrome"
  | "aerodrome"
  | "traderjoe"
  | "osmosis"
  | "raydium"
  | "orca"
  | "meteora";

export type ScanMode = "single" | "full";

export type FlashLoanProviderId = "aave" | "kamino" | "uniswap" | "balancer" | "sushiswap";

export interface FlashLoanPlatformState {
  enabled: boolean;
  chain: string;
  feeMode?: string;
}

export interface DexRoute {
  id: DexId;
  label: string;
  router: string;
  factory: string;
  feeBps: number;
  enabled: boolean;
  networks: Array<
    | "bsc"
    | "arbitrum"
    | "polygon"
    | "ethereum"
    | "optimism"
    | "base"
    | "avalanche"
    | "monad"
    | "linea"
    | "cosmos"
    | "solana"
  >;
  /** Uniswap V3: getPool + slot0. vault: Balancer. curve: get_dy. solidly: Velodrome/Aerodrome. cosmos: Osmosis. solana: Raydium/Orca. sisanya V2 getPair. */
  kind?: "v2" | "v3" | "vault" | "curve" | "solidly" | "cosmos" | "solana";
  /** Factory Uniswap-V3-compatible tambahan (mis. SushiSwap V3) jika likuiditas V2 tipis. */
  v3Factory?: string;
  /** Factory Algebra / Camelot V3 (`poolByPair` + `globalState`). */
  algebraFactory?: string;
}

export interface BotConfig {
  /** Target profit minimum dalam USDT/USDC (nominal USD) */
  minProfitUsd: number;
  /** Tip validator / Dynamic Profit Sharing Bribe dari gross profit (persen, maks 50). */
  minerTipPct: number;
  /** Alias tersimpan di config lokal — sama dengan minerTipPct. */
  dynamicBribePercent?: number;
  /** Spread minimum agar peluang ditandai siap, dalam persen */
  minSpreadPct: number;
  /** Spread maksimum wajar (persen). Di atas ini SCAN_ONLY menandai glitch V3/V2. */
  maxSpotSpreadPct: number;
  gasLimit: number;
  activeDexIds: DexId[];
  /** Nominal pinjaman kilat dalam USD (dikonversi ke desimal token quote on-chain) */
  loanAmountUsd: number;
  /** Provider flashloan yang dipakai untuk estimasi / pilihan UI */
  flashLoanProvider: FlashLoanProviderId;
  /** Premi Aave dalam persen: FREE 0.09, PRO 0.05 (eksekusi on-chain BSC) */
  aaveFeePct: number;
  /** Toggle & opsi jaringan per platform flashloan */
  flashLoanPlatforms: Record<FlashLoanProviderId, FlashLoanPlatformState>;
  /** Slow = signer privat otonom; Extreme = perang gas + approval ekstra */
  gasStrategyMode: "slow" | "extreme";
  /** Batas gas Mode Slow (gwei) — di atas ini auto-exec Slow ditahan */
  slowMaxGasGwei: number;
  /** Batas gas Mode Extreme (gwei) — di atas ini transaksi diblokir */
  extremeMaxGasGwei: number;
  /** Skip pool jika TVL cadangan (kedua sisi, USD) di bawah ini. */
  minPoolLiquidityUsd: number;
  /** SCAN_ONLY: skip jika impact Max Safe Loan di atas ini. Eksekusi live: netProfitUsd >= loan × 0.10%. */
  maxPriceImpactPct: number;
  /** true = kirim via private bundle/RPC; false = mempool publik (JSON-RPC standar). */
  useBundle: boolean;
  chainId?: string;
  pairId?: string;
  /** single = RPC/WSS hanya pair terpilih; full = seluruh katalog jaringan aktif. */
  scanMode?: ScanMode;
}

export interface Opportunity {
  id: string;
  tokenPair: string;
  tokenIn: string;
  tokenOut: string;
  buyDex: DexId;
  sellDex: DexId;
  buyExchange: string;
  sellExchange: string;
  /** Nama DEX beli (kolom DEX A di UI). */
  dexAName?: string;
  /** Nama DEX jual (kolom DEX B di UI). */
  dexBName?: string;
  /** Harga spot base token (USD) di DEX beli */
  priceDexAUsd?: number;
  /** Harga spot base token (USD) di DEX jual */
  priceDexBUsd?: number;
  amountInWei: string;
  amountOutWei: string;
  repayWei: string;
  spreadBps: number;
  estimatedProfitWei: string;
  gasCostWei: string;
  netProfitWei: string;
  flashPair: string;
  amount0Out: string;
  amount1Out: string;
  live: boolean;
  pairId: string;
  chainId: string;
  /** Desimal token quote yang dipinjam (USDC Arbitrum = 6, DAI/WETH = 18). */
  quoteDecimals?: number;
  /** Harga 1 unit token quote dalam USD saat scan. */
  quoteUsd?: number;
  /** Nomor blok saat peluang dihitung (pengaman data basi sebelum kirim tx). */
  detectedBlock?: number;
  status: "ready" | "validated" | "simulated" | "rejected" | "executing" | "completed" | "failed";
  reason?: string;
  /** Fee swap pool DEX yang dipindai (persen), dari feeBps pool beli. */
  scanPoolFeePct?: number;
  /** Fee Uniswap V3 yang terdeteksi otomatis untuk pair (persen). */
  uniswapPoolFeePct?: number;
  /** Fee tier Uniswap V3 untuk leg beli (uint24, cth 500 / 3000). */
  buyPoolFee?: number;
  /** Fee tier Uniswap V3 untuk leg jual (uint24, cth 500 / 3000). */
  sellPoolFee?: number;
  /** TVL pool tersempit pada rute (USD), dari cadangan on-chain. */
  poolLiquidityUsd?: number;
  /** TVL pool DEX beli (USD). */
  buyLiquidityUsd?: number;
  /** TVL pool DEX jual (USD). */
  sellLiquidityUsd?: number;
  /** Price impact terburuk di dua hop (persen). */
  priceImpactPct?: number;
  /** Tip/bribe estimasi (USD) untuk net tampilan = pinjaman × spread − gas − bribe. */
  bribeUsd?: number;
}

/** Snapshot jejak flash-loan yang disimpan saat eksekusi sukses. */
export interface TradeTraceSnapshot {
  blockNumber: number;
  gasUsed: number;
  gasPriceWei: string;
  durationMs: number;
  loanToken: string;
  loanAmountWei: string;
  providerLabel: string;
  buyDex: string;
  sellDex: string;
  buyToken: string;
  sellToken: string;
  amountOutWei: string;
  repayWei: string;
  protocolFeePct: number;
  protocolFeeWei: string;
  gasCostWei: string;
  priceBuyUsd?: number;
  priceSellUsd?: number;
}

export interface TradeRecord {
  id: string;
  at: string;
  pair: string;
  route: string;
  netProfitWei: string;
  txHash?: string;
  outcome: "success" | "reverted" | "skipped";
  trace?: TradeTraceSnapshot;
}

export interface BotState {
  killed: boolean;
  running: boolean;
  config: BotConfig;
  lastBlock: number;
  gasPriceWei: string;
  opportunities: Opportunity[];
  trades: TradeRecord[];
  realizedProfitWei: string;
  lastError?: string;
  updatedAt: string;
  lastAutonomousAt?: number;
  lastAutonomousOppId?: string;
  /** Rute terakhir yang dicoba (sukses atau skip) — antrian ≥ min spread berputar dari sini. */
  lastExecRotateOppId?: string;
}
