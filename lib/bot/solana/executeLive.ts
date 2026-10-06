/**
 * Eksekusi live Solana arb: Jupiter dual-swap (beli venue A → jual venue B).
 *
 * Mode saat ini: wallet-funded (modal dari saldo quote mint di PRIVATE_KEY_SOLANA).
 * Sebelum broadcast, net harus menutup repay = borrow + fee Kamino 0.001% (ceil),
 * dan setiap swap melewati simulateTransaction.
 */
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import { formatNetProfitSkip, solanaMinProfitFloorUsd } from "@/lib/bot/adaptiveMinProfit";
import { tokenWeiToUsd } from "@/lib/bot/configUnits";
import {
  KAMINO_FLASH_FEE_PCT,
  quoteKaminoFlashCycle,
  resolveSolanaExecutorProgramId,
} from "@/lib/bot/solana/kaminoConstants";
import { SOLANA_DEX_VENUES } from "@/lib/bot/solana/quotes";
import {
  jupiterBuildSwapTransaction,
  jupiterQuoteRaw,
} from "@/lib/bot/solana/jupiterSwap";
import {
  requireSolanaSignerAddress,
  signAndSubmitSolanaSwap,
  solanaConnection,
  solanaKeypairFromEnv,
} from "@/lib/bot/solana/signSend";
import { SOLANA_TOKENS } from "@/config/networks";
import { getPair } from "@/lib/chain/tokenPairs";

function venueDexes(dexId: string | undefined): string | undefined {
  const id = (dexId || "").toLowerCase();
  const venue = SOLANA_DEX_VENUES.find(
    (v) => v.id === id || v.label.toLowerCase() === id || id.includes(v.id)
  );
  if (venue) return venue.dexes;
  if (id.includes("raydium")) return SOLANA_DEX_VENUES[0].dexes;
  if (id.includes("orca") || id.includes("whirl")) return SOLANA_DEX_VENUES[1].dexes;
  if (id.includes("meteora")) return SOLANA_DEX_VENUES[2].dexes;
  return undefined;
}

function isWsol(mint: string): boolean {
  return mint === SOLANA_TOKENS.sol;
}

async function walletTokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: string
): Promise<bigint> {
  if (isWsol(mint)) {
    const lamports = await connection.getBalance(owner, "confirmed");
    const buffer = BigInt(Math.floor(0.005 * LAMPORTS_PER_SOL));
    const available = BigInt(lamports) > buffer ? BigInt(lamports) - buffer : 0n;
    return available;
  }
  try {
    const resp = await connection.getParsedTokenAccountsByOwner(owner, {
      mint: new PublicKey(mint),
    });
    let total = 0n;
    for (const acc of resp.value) {
      const amount = (acc.account.data as { parsed?: { info?: { tokenAmount?: { amount?: string } } } })
        .parsed?.info?.tokenAmount?.amount;
      if (amount) total += BigInt(amount);
    }
    return total;
  } catch {
    return 0n;
  }
}

function resolveMints(opp: Opportunity, config: BotConfig): {
  quoteMint: string;
  baseMint: string;
  quoteDecimals: number;
  quoteUsd: number;
} {
  const pairId = opp.pairId || config.pairId || "";
  const pair = pairId ? getPair("solana", pairId) : undefined;
  const quoteMint = pair?.quoteAddress || "";
  const baseMint = pair?.baseAddress || "";
  if (!quoteMint || !baseMint) {
    throw new Error(`Mint pair Solana tidak ditemukan untuk ${pairId || opp.tokenPair}`);
  }
  return {
    quoteMint,
    baseMint,
    quoteDecimals: opp.quoteDecimals ?? pair?.quoteDecimals ?? 9,
    quoteUsd: opp.quoteUsd && opp.quoteUsd > 0 ? opp.quoteUsd : 1,
  };
}

export type SolanaLiveExecResult = {
  signature: string;
  signatures: string[];
  amountIn: string;
  amountOut: string;
  netProfitWei: string;
  mode: "jupiter-dual-wallet";
  kaminoFeePct: number;
  programId: string;
  borrowAmount: string;
  feeAmount: string;
  repayAmount: string;
};

/**
 * Live arb: swap quote→base di buyDex, lalu base→quote di sellDex.
 * Amount dibatasi saldo wallet. Re-quote saat eksekusi; tolak jika net < lantai proporsional.
 */
export async function executeSolanaLiveArb(input: {
  opp: Opportunity;
  config: BotConfig;
}): Promise<SolanaLiveExecResult> {
  const { opp, config } = input;
  const signerPk = requireSolanaSignerAddress();
  const keypair = solanaKeypairFromEnv();
  if (keypair.publicKey.toBase58() !== signerPk) {
    console.warn(
      `[SOLANA-EXEC] pubkey env ${keypair.publicKey.toBase58().slice(0, 4)}… ≠ status ${signerPk.slice(0, 4)}… — memakai keypair env`
    );
  }
  const owner = keypair.publicKey;
  const connection = solanaConnection();
  const programId = resolveSolanaExecutorProgramId();
  const mints = resolveMints(opp, config);

  let amountIn = BigInt(opp.amountInWei || "0");
  if (amountIn <= 0n) throw new Error("amountIn peluang tidak valid");

  const walletBal = await walletTokenBalance(connection, owner, mints.quoteMint);
  if (walletBal <= 0n) {
    throw new Error(
      `[SOLANA-EXEC] Saldo ${opp.tokenIn || "quote"} di wallet ${owner.toBase58().slice(0, 4)}… kosong. ` +
        `Deposit quote mint atau turunkan loan. (Flash Kamino CPI belum aktif — eksekusi memakai modal wallet.)`
    );
  }
  if (amountIn > walletBal) {
    console.log(`[SOLANA-EXEC] cap amountIn ${amountIn} → ${walletBal} (saldo wallet)`);
    amountIn = walletBal;
  }

  const buyDexes = venueDexes(String(opp.buyDex || opp.buyExchange || ""));
  const sellDexes = venueDexes(String(opp.sellDex || opp.sellExchange || ""));

  console.log(
    `[SOLANA-EXEC] target ${programId} · fee-model ${KAMINO_FLASH_FEE_PCT}% · mode=jupiter-dual-wallet` +
      ` · ${opp.tokenPair} · ${opp.buyExchange}→${opp.sellExchange}` +
      ` · borrow=${amountIn.toString()}`
  );

  const buyQuote = await jupiterQuoteRaw({
    inputMint: mints.quoteMint,
    outputMint: mints.baseMint,
    amount: amountIn.toString(),
    dexes: buyDexes,
    slippageBps: 80,
  });
  if (!buyQuote?.outAmount) {
    throw new Error("[SOLANA-EXEC] Quote beli (leg-1) Jupiter gagal / kosong.");
  }
  const baseOut = BigInt(String(buyQuote.outAmount));
  if (baseOut <= 0n) throw new Error("[SOLANA-EXEC] Leg-1 outAmount = 0");

  const sellQuote = await jupiterQuoteRaw({
    inputMint: mints.baseMint,
    outputMint: mints.quoteMint,
    amount: baseOut.toString(),
    dexes: sellDexes,
    slippageBps: 80,
  });
  if (!sellQuote?.outAmount) {
    throw new Error("[SOLANA-EXEC] Quote jual (leg-2) Jupiter gagal / kosong.");
  }
  const quoteOut = BigInt(String(sellQuote.outAmount));
  const cycle = quoteKaminoFlashCycle({ borrowAmount: amountIn, amountOut: quoteOut });
  const net = cycle.netProfit;
  const netUsd = tokenWeiToUsd(net.toString(), mints.quoteDecimals, mints.quoteUsd);
  const actualLoanUsd = tokenWeiToUsd(amountIn.toString(), mints.quoteDecimals, mints.quoteUsd);
  const floor = solanaMinProfitFloorUsd(actualLoanUsd);

  console.log(
    `[SOLANA-EXEC] borrow=${cycle.borrowAmount} · fee=${cycle.feeAmount} · repay=${cycle.repayAmount}` +
      ` · out=${cycle.amountOut} · net=${cycle.netProfit}` +
      ` · net≈$${netUsd.toFixed(4)} · lantai≈$${floor.toFixed(4)} · loan≈$${actualLoanUsd.toFixed(2)}`
  );

  if (quoteOut < cycle.repayAmount || net <= 0n || !(netUsd + 1e-9 >= floor)) {
    throw new Error(
      `${formatNetProfitSkip(netUsd, floor)} ` +
        `(out ${quoteOut} < repay ${cycle.repayAmount} = borrow ${cycle.borrowAmount} + fee ${cycle.feeAmount}).`
    );
  }

  const buyTx = await jupiterBuildSwapTransaction({
    quoteResponse: buyQuote,
    userPublicKey: owner.toBase58(),
  });
  const sig1 = await signAndSubmitSolanaSwap({
    swapTransactionBase64: buyTx.swapTransaction,
  });
  console.log(`[SOLANA-EXEC] leg-1 (beli) ok · ${sig1}`);

  try {
    await connection.confirmTransaction(sig1, "confirmed");
  } catch {
    /* RPC timeout — lanjut */
  }

  let sellAmount = baseOut;
  if (!isWsol(mints.baseMint)) {
    const baseBal = await walletTokenBalance(connection, owner, mints.baseMint);
    if (baseBal > 0n) sellAmount = baseBal < baseOut ? baseBal : baseOut;
  }

  const sellQuote2 = await jupiterQuoteRaw({
    inputMint: mints.baseMint,
    outputMint: mints.quoteMint,
    amount: sellAmount.toString(),
    dexes: sellDexes,
    slippageBps: 100,
  });
  if (!sellQuote2?.outAmount) {
    throw new Error(
      `[SOLANA-EXEC] Leg-2 quote gagal setelah leg-1 land. sig1=${sig1} — cek posisi base di wallet.`
    );
  }
  const cycle2 = quoteKaminoFlashCycle({
    borrowAmount: amountIn,
    amountOut: BigInt(String(sellQuote2.outAmount)),
  });
  if (cycle2.netProfit <= 0n || cycle2.amountOut < cycle2.repayAmount) {
    throw new Error(
      `[SOLANA-EXEC] Leg-2 tidak menutup repay ${cycle2.repayAmount} ` +
        `(out ${cycle2.amountOut}, fee ${cycle2.feeAmount}). sig1=${sig1} — tidak di-broadcast.`
    );
  }

  const sellTx = await jupiterBuildSwapTransaction({
    quoteResponse: sellQuote2,
    userPublicKey: owner.toBase58(),
  });
  const sig2 = await signAndSubmitSolanaSwap({
    swapTransactionBase64: sellTx.swapTransaction,
  });
  console.log(`[SOLANA-EXEC] leg-2 (jual) ok · ${sig2}`);

  return {
    signature: sig2,
    signatures: [sig1, sig2],
    amountIn: amountIn.toString(),
    amountOut: String(sellQuote2.outAmount),
    netProfitWei: cycle2.netProfit.toString(),
    mode: "jupiter-dual-wallet",
    kaminoFeePct: KAMINO_FLASH_FEE_PCT,
    programId,
    borrowAmount: cycle2.borrowAmount.toString(),
    feeAmount: cycle2.feeAmount.toString(),
    repayAmount: cycle2.repayAmount.toString(),
  };
}
