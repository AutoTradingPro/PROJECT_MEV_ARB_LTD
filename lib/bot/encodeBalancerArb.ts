import { AbiCoder, Interface, ZeroAddress, getAddress } from "ethers";
import {
  ARBITRUM_BALANCER_FLASH_ARB,
  BALANCER_V2_VAULT,
  balancerVaultForChainId,
} from "@/config/networks";
import { bpsOf } from "./dexMath";
import { contractAddressFromEnv, resolveOpportunitySwapRouters } from "./constants";
import { toEngineConfig } from "./configUnits";
import { floorAmountOutMin, minAmountOutForExec } from "./dynamicSlippage";
import { getPair } from "@/lib/chain/tokenPairs";
import { getChain, type ChainId } from "@/lib/chain/networks";
import type { BotConfig, Opportunity } from "./types";

function asAddress(value: string): string {
  return getAddress((value || ZeroAddress).toLowerCase());
}

export { BALANCER_V2_VAULT };

export const BALANCER_ARB_IFACE = new Interface([
  "function executeFlashLoan(address[] tokens,uint256[] amounts,bytes userData)",
]);

export function balancerArbFromEnv(): string {
  for (const key of ["NEXT_PUBLIC_BALANCER_FLASH_ARB", "BALANCER_FLASH_ARB", "NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR"]) {
    const value = process.env[key]?.trim();
    if (value && value.toLowerCase() !== BALANCER_V2_VAULT.toLowerCase()) return value;
  }
  return ARBITRUM_BALANCER_FLASH_ARB;
}

/** Fee Uniswap V3 default (0.05%) jika scan tidak mengisi uint24. */
const DEFAULT_UNI_V3_FEE = 500;

export function resolveUniV3PoolFee(fee: number | undefined, feePct?: number): number {
  if (typeof fee === "number" && Number.isFinite(fee) && fee > 0) return Math.round(fee);
  if (typeof feePct === "number" && Number.isFinite(feePct) && feePct > 0) {
    return Math.max(1, Math.round(feePct * 10_000));
  }
  return DEFAULT_UNI_V3_FEE;
}

export function encodeBalancerUserData(input: {
  borrowToken: string;
  profitToken: string;
  routerBuy: string;
  routerSell: string;
  buyPath: string[];
  sellPath: string[];
  amountOutMinBuy: bigint;
  amountOutMinSell: bigint;
  poolFeeBuy: number;
  poolFeeSell: number;
  minProfitWei: bigint;
  minerTipWei: bigint;
  withdrawTo: string;
}): string {
  return AbiCoder.defaultAbiCoder().encode(
    [
      "tuple(" +
        "address borrowToken," +
        "address profitToken," +
        "address routerBuy," +
        "address routerSell," +
        "address[] buyPath," +
        "address[] sellPath," +
        "uint256 amountOutMinBuy," +
        "uint256 amountOutMinSell," +
        "uint24 poolFeeBuy," +
        "uint24 poolFeeSell," +
        "uint256 minProfitWei," +
        "uint256 minerTipWei," +
        "address withdrawTo" +
        ")",
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
        poolFeeBuy: input.poolFeeBuy,
        poolFeeSell: input.poolFeeSell,
        minProfitWei: input.minProfitWei,
        minerTipWei: input.minerTipWei,
        withdrawTo: asAddress(input.withdrawTo || ZeroAddress),
      },
    ]
  );
}

export function buildBalancerExecuteCalldata(
  opp: Opportunity,
  config: BotConfig,
  withdrawTo: string
): {
  to: string;
  data: string;
  pair: string;
  callback: string;
} | null {
  const chainId = ((config.chainId || opp.chainId || "arbitrum") as ChainId);
  const pair = getPair(chainId, opp.pairId);
  const quote = pair?.quoteAddress;
  const base = pair?.baseAddress;
  if (!quote || !base) return null;
  const contractAddress = contractAddressFromEnv(chainId) || (chainId === "arbitrum" ? balancerArbFromEnv() : "");
  if (!contractAddress) return null;
  const routers = resolveOpportunitySwapRouters(opp);
  if (!routers) return null;
  const { buy, sell } = routers;
  try {
    if (asAddress(sell.router) === ZeroAddress || asAddress(buy.router) === ZeroAddress) return null;
  } catch {
    return null;
  }

  const engine = toEngineConfig(config);
  const loan = BigInt(opp.amountInWei || "0");
  /** Arbitrum sequencer sering menolak transfer ke `block.coinbase` — tip on-chain dilewati. */
  const minerTip = chainId === "arbitrum" ? 0n : bpsOf(BigInt(opp.estimatedProfitWei || "0"), engine.minerTipBps);
  const quoteDecimals = opp.quoteDecimals ?? pair.quoteDecimals ?? 18;
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

  const data = BALANCER_ARB_IFACE.encodeFunctionData("executeFlashLoan", [
    [asAddress(quote)],
    [loan > 0n ? loan : 1n],
    callback,
  ]);

  return { to: contractAddress, data, pair: balancerVaultForChainId(getChain(chainId).chainId ?? 42161), callback };
}
