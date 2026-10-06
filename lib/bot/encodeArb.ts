import { AbiCoder, Interface, ZeroAddress, getAddress } from "ethers";
import { bpsOf } from "./dexMath";
import { contractAddressFromEnv, flashLoanPoolFromEnv, resolveOpportunitySwapRouters, USDT, WBNB } from "./constants";
import { toEngineConfig } from "./configUnits";
import { floorAmountOutMin, minAmountOutForExec } from "./dynamicSlippage";
import {
  buildBalancerExecuteCalldata,
  encodeBalancerUserData,
  resolveUniV3PoolFee,
} from "./encodeBalancerArb";
import { isKaminoFlashProvider } from "@/lib/bot/solana/kaminoConstants";
import { resolveKaminoFlashLoanRoute } from "@/lib/bot/solana/kamino";
import { getPair } from "@/lib/chain/tokenPairs";
import type { ChainId } from "@/lib/chain/networks";
import { defaultTradingChainId } from "@/config/networks";
import { appendServerLog } from "@/lib/bot/serverLog";
import { MONAD_EXECUTOR_ADDRESS } from "@/lib/vault/executors";
import type { BotConfig, Opportunity } from "./types";

function asAddress(value: string): string {
  return getAddress((value || ZeroAddress).toLowerCase());
}

const ARB_IFACE = new Interface([
  "function executeFlashArb(address pair,uint256 amount0Out,uint256 amount1Out,bytes data)",
]);

/** Masuk owner ke MevExecutor. Kontrak yang memanggil callback, bukan dompet. */
const MEV_EXECUTOR_IFACE = new Interface([
  "function executeFlashLoan(address[] tokens,uint256[] amounts,bytes paramsData)",
]);

/** Pool Aave V3 Optimism dan Avalanche. Sama dengan flashSource kind 3. */
const AAVE_V3_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
/** Factory Uniswap V3 Base. Sama dengan flashSource kind 4. */
const BASE_UNISWAP_V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
const BALANCER_V2_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";

export function encodeCallback(input: {
  borrowToken: string;
  profitToken: string;
  routerBuy: string;
  routerSell: string;
  buyPath: string[];
  sellPath: string[];
  amountOutMinBuy: bigint;
  amountOutMinSell: bigint;
  repayAmount: bigint;
  minerTipWei: bigint;
  withdrawTo: string;
}): string {
  return AbiCoder.defaultAbiCoder().encode(
    [
      "tuple(address borrowToken,address profitToken,address routerBuy,address routerSell,address[] buyPath,address[] sellPath,uint256 amountOutMinBuy,uint256 amountOutMinSell,uint256 repayAmount,uint256 minerTipWei,address withdrawTo)",
    ],
    [
      {
        borrowToken: asAddress(input.borrowToken),
        profitToken: asAddress(input.profitToken),
        routerBuy: asAddress(input.routerBuy),
        routerSell: asAddress(input.routerSell),
        buyPath: input.buyPath.map(asAddress),
        sellPath: input.sellPath.map(asAddress),
        amountOutMinBuy: input.amountOutMinBuy,
        amountOutMinSell: input.amountOutMinSell,
        repayAmount: input.repayAmount,
        minerTipWei: input.minerTipWei,
        withdrawTo: asAddress(input.withdrawTo || ZeroAddress),
      },
    ]
  );
}

/**
 * Calldata MevExecutor yang sudah di-redeploy.
 * Optimism / Avalanche: params di-decode `executeOperation` (Aave V3).
 * Base: params di-decode `uniswapV3FlashCallback` (Uniswap V3, tier 100 lalu 3000).
 * Transaksi tetap `executeFlashLoan` ke executor. Bukan Vault Balancer.
 */
function buildRedeployedMevExecutorCalldata(
  opp: Opportunity,
  config: BotConfig,
  withdrawTo: string,
  chainId: "optimism" | "avalanche" | "base"
): {
  to: string;
  data: string;
  pair: string;
  callback: string;
} | null {
  const pairMeta = getPair(chainId, opp.pairId);
  const quote = pairMeta?.quoteAddress;
  const base = pairMeta?.baseAddress;
  if (!quote || !base) return null;
  const contractAddress = contractAddressFromEnv(chainId);
  if (!contractAddress) return null;
  const routers = resolveOpportunitySwapRouters(opp);
  if (!routers) return null;
  const { buy, sell } = routers;
  try {
    if (asAddress(sell.router) === ZeroAddress || asAddress(buy.router) === ZeroAddress) return null;
  } catch {
    return null;
  }

  const flashSource = chainId === "base" ? BASE_UNISWAP_V3_FACTORY : AAVE_V3_POOL;
  if (asAddress(flashSource).toLowerCase() === BALANCER_V2_VAULT.toLowerCase()) return null;

  const engine = toEngineConfig(config);
  const loan = BigInt(opp.amountInWei || "0");
  const minerTip = bpsOf(BigInt(opp.estimatedProfitWei || "0"), engine.minerTipBps);
  const quoteDecimals = opp.quoteDecimals ?? pairMeta.quoteDecimals ?? 18;
  const floor = minAmountOutForExec({ ...opp, quoteDecimals }, config, minerTip);
  const amountOutMinSell = floorAmountOutMin(floor.minAmountOut, quoteDecimals);
  const poolFeeBuy = resolveUniV3PoolFee(opp.buyPoolFee, opp.uniswapPoolFeePct ?? opp.scanPoolFeePct);
  const poolFeeSell = resolveUniV3PoolFee(opp.sellPoolFee, opp.uniswapPoolFeePct ?? opp.scanPoolFeePct);

  const callback = encodeBalancerUserData({
    borrowToken: quote,
    profitToken: quote,
    routerBuy: buy.router,
    routerSell: sell.router,
    buyPath: [quote, base],
    sellPath: [base, quote],
    amountOutMinBuy: 1n,
    amountOutMinSell,
    poolFeeBuy,
    poolFeeSell,
    minProfitWei: floor.minProfitWei,
    minerTipWei: minerTip,
    withdrawTo,
  });

  const data = MEV_EXECUTOR_IFACE.encodeFunctionData("executeFlashLoan", [
    [asAddress(quote)],
    [loan > 0n ? loan : 1n],
    callback,
  ]);

  return { to: contractAddress, data, pair: flashSource, callback };
}

function tokensForOpp(opp: Opportunity, config: BotConfig): { quote: string; base: string; chainId: ChainId } {
  const chainId = ((config.chainId || opp.chainId || defaultTradingChainId()) as ChainId);
  const pair = getPair(chainId, opp.pairId);
  return {
    chainId,
    quote: pair?.quoteAddress || USDT,
    base: pair?.baseAddress || WBNB,
  };
}

export function buildExecuteCalldata(
  opp: Opportunity,
  config: BotConfig,
  withdrawTo: string
): {
  to: string;
  data: string;
  pair: string;
  callback: string;
} | null {
  const chainId = ((config.chainId || opp.chainId || defaultTradingChainId()) as ChainId);

  // Kamino: diganti jalur live Jupiter dual-swap di autonomousExecute (executeSolanaLiveArb).
  if (isKaminoFlashProvider(config.flashLoanProvider)) {
    const route = resolveKaminoFlashLoanRoute();
    console.log(
      `[FLASH ROUTE] ${route.label} · chain=${route.chainId} · program=${route.programId} · fee=${route.feePct}% · cluster=${route.rpcCluster} · exec=jupiter-dual-wallet`
    );
    return null;
  }

  if (chainId === "optimism" || chainId === "avalanche" || chainId === "base") {
    return buildRedeployedMevExecutorCalldata(opp, config, withdrawTo, chainId);
  }

  if (chainId === "monad") {
    const built = buildBalancerExecuteCalldata(opp, config, withdrawTo);
    const expected = MONAD_EXECUTOR_ADDRESS.toLowerCase();
    const to = (built?.to || "").toLowerCase();
    const line =
      built && to === expected
        ? `[MONAD 143] executeFlashLoan to=${built.to}`
        : `[MONAD 143] executeFlashLoan to=${built?.to || "kosong"}`;
    console.log(line);
    appendServerLog({
      level: to === expected ? "exec" : "warn",
      source: "MONAD",
      chainId: "monad",
      message: line,
    });
    return built;
  }

  // BNB Chain tidak boleh memakai Balancer V2. Jalur ini selalu flash swap V2/V3.
  if (chainId !== "bsc") {
    return buildBalancerExecuteCalldata(opp, config, withdrawTo);
  }

  const { quote, base } = tokensForOpp(opp, config);
  const contractAddress = contractAddressFromEnv(chainId);
  const flashPair = opp.flashPair || flashLoanPoolFromEnv(chainId);
  if (!contractAddress || !flashPair) return null;
  const routers = resolveOpportunitySwapRouters(opp);
  if (!routers) return null;
  const { buy, sell } = routers;
  try {
    if (asAddress(sell.router) === ZeroAddress || asAddress(buy.router) === ZeroAddress) return null;
  } catch {
    return null;
  }

  const engine = toEngineConfig(config);
  const repay = BigInt(opp.repayWei || "0");
  const minerTip = bpsOf(BigInt(opp.estimatedProfitWei || "0"), engine.minerTipBps);
  const pairMeta = getPair(chainId, opp.pairId);
  const quoteDecimals = opp.quoteDecimals ?? pairMeta?.quoteDecimals ?? 18;
  const floor = minAmountOutForExec(
    { ...opp, quoteDecimals },
    config,
    minerTip
  );
  const amountOutMinSell = floorAmountOutMin(floor.minAmountOut, quoteDecimals);
  const callback = encodeCallback({
    borrowToken: quote,
    profitToken: quote,
    routerBuy: buy.router,
    routerSell: sell.router,
    buyPath: [quote, base],
    sellPath: [base, quote],
    amountOutMinBuy: 1n,
    amountOutMinSell,
    repayAmount: repay > 0n ? repay : 1n,
    minerTipWei: minerTip,
    withdrawTo,
  });

  const data = ARB_IFACE.encodeFunctionData("executeFlashArb", [
    asAddress(flashPair),
    BigInt(opp.amount0Out || "0"),
    BigInt(opp.amount1Out || "0"),
    callback,
  ]);

  return { to: contractAddress, data, pair: flashPair, callback };
}

export { ARB_IFACE };
