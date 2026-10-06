/**
 * Sign + broadcast VersionedTransaction Solana via QuickNode executor.
 */
import {
  Connection,
  Keypair,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { loadSolanaSecretKey, solanaAutonomousSignerStatus } from "@/lib/bot/solana/signer";
import {
  requireSolanaExecutorRpcUrl,
  submitSolanaSignedTx,
} from "@/lib/bot/solana/executor";
import { resolveSolanaPriorityFeeMicroLamports } from "@/lib/bot/solana/priorityFee";

export function solanaKeypairFromEnv(): Keypair {
  const secret = loadSolanaSecretKey();
  if (!secret) {
    throw new Error("PRIVATE_KEY_SOLANA belum diisi / tidak valid di .env.local");
  }
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export function requireSolanaSignerAddress(): string {
  const status = solanaAutonomousSignerStatus();
  if (!status.ready || !status.address) {
    throw new Error("Signer Solana belum siap. Isi PRIVATE_KEY_SOLANA di .env.local.");
  }
  return status.address;
}

export function solanaConnection(): Connection {
  return new Connection(requireSolanaExecutorRpcUrl(), {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60_000,
  });
}

function simulationFailure(err: unknown, logs: string[]): string {
  const tail = logs.slice(-6).join(" | ");
  const blob = `${JSON.stringify(err)} ${tail}`.toLowerCase();
  if (blob.includes("slippage")) return `slippage · ${tail || JSON.stringify(err)}`;
  if (blob.includes("insufficient") || blob.includes("liquidity")) {
    return `likuiditas · ${tail || JSON.stringify(err)}`;
  }
  return tail || JSON.stringify(err);
}

/**
 * Dry-run sebelum broadcast. Mengganti blockhash agar tx Jupiter yang belum
 * ditandatangani tetap bisa diukur compute unit-nya.
 */
export async function simulateSolanaSwapTransaction(swapTransactionBase64: string): Promise<{
  unitsConsumed: number;
  logs: string[];
}> {
  const raw = Buffer.from(swapTransactionBase64, "base64");
  const tx = VersionedTransaction.deserialize(raw);
  const sim = await solanaConnection().simulateTransaction(tx, {
    replaceRecentBlockhash: true,
    sigVerify: false,
    commitment: "processed",
  });
  const logs = sim.value.logs ?? [];
  if (sim.value.err) {
    throw new Error(`[SOLANA-SIM] ${simulationFailure(sim.value.err, logs)}`);
  }
  const unitsConsumed = sim.value.unitsConsumed ?? 0;
  console.log(`[SOLANA-SIM] OK · compute ${unitsConsumed} CU · broadcast belum dikirim`);
  return { unitsConsumed, logs };
}

/** Deserialize base64 Jupiter swap tx, sign, return base64 signed. */
export async function signSolanaSwapTransactionBase64(
  swapTransactionBase64: string,
  keypair?: Keypair
): Promise<string> {
  const signer = keypair || solanaKeypairFromEnv();
  const raw = Buffer.from(swapTransactionBase64, "base64");
  const tx = VersionedTransaction.deserialize(raw);
  tx.sign([signer]);
  return Buffer.from(tx.serialize()).toString("base64");
}

export async function signAndSubmitSolanaSwap(input: {
  swapTransactionBase64: string;
  skipPreflight?: boolean;
}): Promise<string> {
  await simulateSolanaSwapTransaction(input.swapTransactionBase64);
  const signed = await signSolanaSwapTransactionBase64(input.swapTransactionBase64);
  const fee = await resolveSolanaPriorityFeeMicroLamports().catch(() => null);
  console.log(
    `[SOLANA-TX] broadcast signed swap` +
      (fee ? ` · priority ~${fee.microLamports} µLamports/CU (${fee.source})` : "")
  );
  return submitSolanaSignedTx(signed, {
    skipPreflight: input.skipPreflight === true,
    maxRetries: 3,
  });
}

export function encodeSecretKeyBase58(secret: Uint8Array): string {
  const encode = (bs58 as unknown as { encode: (b: Uint8Array) => string }).encode;
  return encode(secret);
}
