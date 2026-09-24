import { AbiCoder, Interface, ZeroAddress, getAddress } from "ethers";
import { bpsOf } from "./dexMath";
import { contractAddressFromEnv, flashLoanPoolFromEnv, resolveOpportunitySwapRouters, USDT, WBNB } from "./constants";
import { toEngineConfig } from "./configUnits";
import { floorAmountOutMin, minAmountOutForExec } from "./dynamicSlippage";
import { buildBalancerExecuteCalldata } from "./encodeBalancerArb";
import { isKaminoFlashProvider } from "@/lib/bot/solana/kaminoConstants";
import { resolveKaminoFlashLoanRoute } from "@/lib/bot/solana/kamino";
import { getPair } from "@/lib/chain/tokenPairs";
import type { ChainId } from "@/lib/chain/networks";
import { defaultTradingChainId } from "@/config/networks";
import type { BotConfig, Opportunity } from "./types";

function asAddress(value: string): string {
  return getAddress((value || ZeroAddress).toLowerCase());
}

const ARB_IFACE = new Interface([
  "function executeFlashArb(address pair,uint256 amount0Out,uint256 amount1Out,bytes data)",
]);

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

  if (config.flashLoanProvider === "balancer" || chainId !== "bsc") {
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
