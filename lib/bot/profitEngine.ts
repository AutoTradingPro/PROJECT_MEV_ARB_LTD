import type { Opportunity } from "./types";
import { aaveFlashRepayAmount, bpsOf, estimateSpotRoundTripQuote, getAmountOut } from "./dexMath";
import type { EngineConfig } from "./configUnits";

export interface ReserveQuote {
  reserveIn: bigint;
  reserveOut: bigint;
  feeBps: bigint;
}

export interface ProfitInput {
  amountIn: bigint;
  buy: ReserveQuote;
  sell: ReserveQuote;
  gasPriceWei: bigint;
  gasLimit: bigint;
  config: EngineConfig;
  /** Spread harga spot ((P_jual - P_beli) / P_beli) dalam bps — kolom tabel. */
  spotSpreadBps: number;
  /** Biaya gas dalam satuan token quote (USDT wei), bukan wei BNB. */
  gasCostQuoteWei?: bigint;
  /** Uniswap V3 / Algebra: rumus x*y V2 pada saldo token terlalu pesimis — pakai fill dari spread spot. */
  useSpotFill?: boolean;
}

export interface ProfitResult {
  amountOut: bigint;
  repay: bigint;
  grossProfit: bigint;
  gasCost: bigint;
  minerTip: bigint;
  netProfit: bigint;
  spreadBps: number;
  profitable: boolean;
  rejectReason?: string;
}

export function estimateTwoDexFlashArb(input: ProfitInput): ProfitResult {
  const bought = getAmountOut(
    input.amountIn,
    input.buy.reserveIn,
    input.buy.reserveOut,
    input.buy.feeBps
  );
  const ammSold = getAmountOut(
    bought,
    input.sell.reserveIn,
    input.sell.reserveOut,
    input.sell.feeBps
  );
  const spotSold = estimateSpotRoundTripQuote(
    input.amountIn,
    input.spotSpreadBps,
    input.buy.feeBps,
    input.sell.feeBps
  );
  const sold =
    (input.useSpotFill || input.spotSpreadBps > 0) && spotSold > ammSold ? spotSold : ammSold;
  const repay = aaveFlashRepayAmount(input.amountIn, BigInt(input.config.aaveFeeBps));
  /** minAmountOut dinamis dipasang saat encode calldata, bukan haircut laba scan. */
  const grossProfit = sold > repay ? sold - repay : 0n;
  const gasCost =
    input.gasCostQuoteWei !== undefined
      ? input.gasCostQuoteWei
      : input.gasPriceWei * input.gasLimit;
  const minerTip = bpsOf(grossProfit, input.config.minerTipBps);
  const netProfit = grossProfit > gasCost + minerTip ? grossProfit - gasCost - minerTip : 0n;
  const spreadBps = input.spotSpreadBps;
  const minProfit = BigInt(input.config.minProfitWei);
  const minSpreadBps = Math.max(0, input.config.minSpreadBps);
  const spreadOk = Number.isFinite(spreadBps) && spreadBps + 1e-9 >= minSpreadBps;
  const profitable = spreadOk && netProfit > 0n && netProfit >= minProfit;

  let rejectReason: string | undefined;
  if (spreadBps <= 0) {
    rejectReason = "Harga jual ≤ harga beli (rute terbalik)";
  } else if (!spreadOk) {
    rejectReason = `Spread ${(spreadBps / 100).toFixed(3)}% < minimum ${(minSpreadBps / 100).toFixed(2)}%`;
  } else if (netProfit <= 0n) {
    rejectReason = "Fee DEX + flash loan + gas melebihi spread harga";
  } else if (netProfit < minProfit) {
    rejectReason = "Net profit di bawah lantai max(loan × 0.60%, costFloor)";
  }

  return {
    amountOut: sold,
    repay,
    grossProfit,
    gasCost,
    minerTip,
    netProfit,
    spreadBps,
    profitable,
    rejectReason,
  };
}

export function toOpportunityStatus(result: ProfitResult): Opportunity["status"] {
  return result.profitable ? "simulated" : "rejected";
}
