import { NET_PROFIT_SKIP_REASON } from "@/lib/bot/adaptiveMinProfit";
import type { Opportunity } from "./types";
import { bpsOf, estimateSpotRoundTripQuote, flashRepayFromPpm, getAmountOut } from "./dexMath";
import type { EngineConfig } from "./configUnits";
import { resolveDynamicAmountIn, type DynamicLoanSize } from "@/src/engine/dynamicSizing";
import { quoteLocalV3ExactIn } from "@/scanner/localQuote";
import type { V3QuotePool } from "@/scanner/v3/swap";

export interface ReserveQuote {
  reserveIn: bigint;
  reserveOut: bigint;
  feeBps: bigint;
  /** Jika terisi, kaki ini memakai SwapMath V3, bukan rumus x*y. */
  v3?: V3QuotePool | null;
  zeroForOne?: boolean;
}

export interface ProfitInput {
  /** Fallback bila `dynamicSize` kosong. Jalur scan mengisi keduanya dari likuiditas pool. */
  amountIn: bigint;
  /** Ukuran pinjaman dari `optimalFlashloanSize`. Dipakai sebagai amount in. */
  dynamicSize?: Pick<DynamicLoanSize, "amountInWei">;
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
  const amountIn = resolveDynamicAmountIn(input.dynamicSize, input.amountIn);
  const bought = quoteLeg(amountIn, input.buy);
  const ammSold = quoteLeg(bought, input.sell);
  const spotSold = estimateSpotRoundTripQuote(
    amountIn,
    input.spotSpreadBps,
    input.buy.feeBps,
    input.sell.feeBps
  );
  const v3Fill = Boolean(input.buy.v3 || input.sell.v3);
  const sold = !v3Fill && (input.useSpotFill || input.spotSpreadBps > 0) && spotSold > ammSold ? spotSold : ammSold;
  const feePpm = input.config.flashFeePpm ?? input.config.aaveFeeBps * 100;
  const repay = flashRepayFromPpm(amountIn, BigInt(Math.max(0, Math.round(feePpm))));
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
    rejectReason = NET_PROFIT_SKIP_REASON;
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

function quoteLeg(amountIn: bigint, leg: ReserveQuote): bigint {
  if (amountIn <= 0n) return 0n;
  if (leg.v3 && leg.v3.sqrtPriceX96 > 0n && typeof leg.zeroForOne === "boolean") {
    return quoteLocalV3ExactIn({
      pool: leg.v3,
      amountIn,
      zeroForOne: leg.zeroForOne,
    }).amountOut;
  }
  return getAmountOut(amountIn, leg.reserveIn, leg.reserveOut, leg.feeBps);
}

export function toOpportunityStatus(result: ProfitResult): Opportunity["status"] {
  return result.profitable ? "simulated" : "rejected";
}
