import { Interface, ZeroAddress, id } from "ethers";
import { VAULT_ABI } from "@/lib/vault/abi";

/**
 * Deployed executor surfaces, read from runtime bytecode:
 * Ethereum, Polygon and Arbitrum are FlashArbTreasury: withdraw(uint256),
 * withdrawToken(address,uint256), emergencyWithdraw, rescueFunds(address),
 * rescueFunds(address,uint256) and rescueETH.
 * The legacy BSC executor has only withdrawBNB() and withdrawToken(address).
 * Candidates are kept only when the deployed bytecode contains them. If the code
 * cannot be read, the chain profile below is the fallback so a BSC call is never
 * encoded as rescueFunds and a treasury call is never encoded as withdrawBNB.
 */

export type VaultChain = "ethereum" | "polygon" | "bsc" | "arbitrum";

const TREASURY_METHODS = new Set([
  "withdraw(uint256)",
  "withdrawToken(address,uint256)",
  "emergencyWithdraw(address,address)",
  "rescueFunds(address,uint256)",
  "rescueFunds(address)",
  "rescueETH()",
]);

const BSC_LEGACY_METHODS = new Set(["withdrawBNB()", "withdrawToken(address)"]);

export function vaultChainOf(chainId: string | undefined): VaultChain {
  if (chainId === "ethereum" || chainId === "polygon" || chainId === "arbitrum") return chainId;
  return "bsc";
}

function surfaceFor(chain: VaultChain | undefined): Set<string> | null {
  if (chain === "bsc") return BSC_LEGACY_METHODS;
  if (chain === "ethereum" || chain === "polygon" || chain === "arbitrum") return TREASURY_METHODS;
  return null;
}

const IFACE = new Interface([...VAULT_ABI]);

export interface WithdrawCall {
  method: string;
  data: string;
}

export interface WithdrawPlanInput {
  /** Selectors found in the executor bytecode; `null` when the code could not be read. */
  selectors: Set<string> | null;
  /** Used only when `selectors` is null, so the fallback matches that chain's deployed ABI. */
  chain?: VaultChain;
  native: boolean;
  /** True when the whole contract balance should leave. */
  pullAll: boolean;
  token: string;
  amount: bigint;
  available: bigint;
  dest: string;
}

function selectorOf(signature: string): string {
  return id(signature).slice(0, 10).toLowerCase();
}

/** PUSH4 operands of the runtime code — the function-dispatcher selectors of a Solidity contract. */
export function bytecodeSelectors(code: string): Set<string> {
  const hex = code.toLowerCase().replace(/^0x/, "");
  const selectors = new Set<string>();
  for (let i = 0; i < hex.length; i += 2) {
    const op = Number.parseInt(hex.slice(i, i + 2), 16);
    if (op === 0x63) selectors.add(`0x${hex.slice(i + 2, i + 10)}`);
    if (op >= 0x60 && op <= 0x7f) i += (op - 0x5f) * 2;
  }
  return selectors;
}

const selectorCache = new Map<string, Set<string>>();

export async function readExecutorSelectors(
  provider: { getCode: (address: string) => Promise<string> },
  address: string
): Promise<Set<string> | null> {
  const key = address.toLowerCase();
  const cached = selectorCache.get(key);
  if (cached) return cached;
  let code: string;
  try {
    code = await provider.getCode(address);
  } catch (error) {
    console.warn("[vault] getCode executor gagal — rencana penarikan tanpa deteksi ABI", error);
    return null;
  }
  if (!code || code === "0x") {
    throw new Error(`Tidak ada kontrak di ${address} pada jaringan ini. Periksa alamat executor.`);
  }
  const selectors = bytecodeSelectors(code);
  selectorCache.set(key, selectors);
  return selectors;
}

function call(signature: string, args: unknown[]): WithdrawCall {
  return { method: signature, data: IFACE.encodeFunctionData(signature, args) };
}

/** Candidates in preference order; only those present in the bytecode (when known) are kept. */
export function planWithdraw(input: WithdrawPlanInput): WithdrawCall[] {
  const { native, pullAll, token, amount, available, dest } = input;
  const candidates: WithdrawCall[] = [];
  if (pullAll && native) {
    candidates.push(
      call("emergencyWithdraw(address,address)", [ZeroAddress, dest]),
      call("rescueFunds(address)", [ZeroAddress]),
      call("rescueETH()", []),
      call("withdrawBNB()", []),
      call("withdraw(uint256)", [available])
    );
  } else if (pullAll) {
    candidates.push(
      call("emergencyWithdraw(address,address)", [token, dest]),
      call("rescueFunds(address,uint256)", [token, available]),
      call("rescueFunds(address)", [token]),
      call("withdrawToken(address,uint256)", [token, available]),
      call("withdrawToken(address)", [token])
    );
  } else if (native) {
    candidates.push(call("withdraw(uint256)", [amount]));
  } else {
    candidates.push(
      call("withdrawToken(address,uint256)", [token, amount]),
      call("rescueFunds(address,uint256)", [token, amount])
    );
  }
  const { selectors } = input;
  if (selectors) return candidates.filter((c) => selectors.has(selectorOf(c.method)));
  const surface = surfaceFor(input.chain);
  if (surface) return candidates.filter((c) => surface.has(c.method));
  return candidates;
}

/** Withdraw-related functions the executor actually has, for error messages. */
export function supportedWithdrawMethods(selectors: Set<string> | null): string[] {
  if (!selectors) return [];
  return [
    "withdraw(uint256)",
    "withdrawToken(address,uint256)",
    "withdrawToken(address)",
    "withdrawBNB()",
    "emergencyWithdraw(address,address)",
    "rescueFunds(address,uint256)",
    "rescueFunds(address)",
    "rescueETH()",
  ].filter((sig) => selectors.has(selectorOf(sig)));
}

export function emptyPlanMessage(input: {
  native: boolean;
  pullAll: boolean;
  selectors: Set<string> | null;
  chain?: VaultChain;
}): string {
  const surface = surfaceFor(input.chain);
  const supported = input.selectors
    ? supportedWithdrawMethods(input.selectors)
    : surface
      ? [...surface]
      : [];
  const kind = input.native ? "native" : "token";
  const scope = input.pullAll ? "seluruh saldo" : "sebagian";
  const partialHint =
    !input.pullAll && supported.length > 0
      ? " Kontrak ini hanya bisa menyapu seluruh saldo — kosongkan nominal untuk menarik semuanya."
      : "";
  return (
    `Executor tidak punya fungsi untuk menarik ${scope} ${kind}. ` +
    `Fungsi penarikan yang tersedia: ${supported.length ? supported.join(", ") : "tidak ada"}.${partialHint}`
  );
}
