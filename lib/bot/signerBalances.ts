import { Interface, formatUnits } from "ethers";
import {
  ARBITRUM_TOKENS,
  BALANCER_V2_VAULT,
  BSC_TOKENS,
  ETHEREUM_TOKENS,
  POLYGON_TOKENS,
  normalizeTradingChainId,
  type NativeSymbol,
} from "@/config/networks";
import {
  AUTO_EXECUTE,
  contractAddressFromEnv,
  flashLoanPoolFromEnv,
  isProtocolBalancerVault,
} from "@/lib/bot/constants";
import { tokenWeiToUsd } from "@/lib/bot/configUnits";
import {
  estimatedTxGasWei,
  formatGasCostNative,
  resolvePreExecGasLimit,
} from "@/lib/bot/gasCostEstimate";
import {
  isKaminoFlashProvider,
  KAMINO_FLASH_FEE_PCT,
  KAMINO_FLASH_LOAN_SOURCE,
  KAMINO_KLEND_PROGRAM_ID,
} from "@/lib/bot/solana/kaminoConstants";
import { fetchSolanaVaultBalances, solanaSignerAddress, solanaVaultAddress } from "@/lib/bot/solana/balances";
import { autonomousSignerStatus } from "@/lib/bot/privateSigner";
import { ethCall, jsonRpc, withRpcFailover } from "@/lib/bot/rpc";
import type { BotConfig, Opportunity } from "@/lib/bot/types";
import { getPair } from "@/lib/chain/tokenPairs";
import { getChain, type ChainId } from "@/lib/chain/networks";
import { onScanRuntimeReset } from "@/lib/bot/scanRuntime";

const ERC20_IFACE = new Interface(["function balanceOf(address account) view returns (uint256)"]);
const STABLES = new Set(["USDT", "USDC", "DAI"]);
const CACHE_MS = 4_000;

export const MIN_NATIVE_GAS_ETH = AUTO_EXECUTE.minNativeGasEth;
export const LOW_GAS_WARNING =
  "[WARNING] Saldo ETH gas menipis! Eksekusi otomatis ditangguhkan.";

export interface SignerLiveBalances {
  address?: string;
  vaultAddress?: string;
  chainId?: ChainId;
  nativeWei: string;
  nativeSymbol: NativeSymbol;
  nativeFormatted: string;
  nativeLow: boolean;
  tokenSymbol?: string;
  tokenFormatted?: string;
  vaultFormatted?: string;
  vaultAmount?: number;
  vaultLow?: boolean;
  vaultEthFormatted?: string;
  vaultUsdcFormatted?: string;
  vaultUsdtFormatted?: string;
}

type CacheEntry = { at: number; data: SignerLiveBalances };
const cache = new Map<string, CacheEntry>();

/** Snapshot saldo terakhir dari scan — dipakai API / log UI. */
let lastScanSignerBalances: SignerLiveBalances | null = null;

export function resetSignerBalanceCache(): void {
  cache.clear();
  lastScanSignerBalances = null;
}

onScanRuntimeReset(resetSignerBalanceCache);

export function pickStableSymbol(quote?: string, base?: string): string | undefined {
  const q = quote?.trim().toUpperCase();
  const b = base?.trim().toUpperCase();
  if (q && STABLES.has(q)) return q;
  if (b && STABLES.has(b)) return b;
  return undefined;
}

export function stableToken(chainId: ChainId, symbol: string): { address: string; decimals: number } | null {
  const key = symbol.toUpperCase();
  if (chainId === "arbitrum") {
    if (key === "USDT") return { address: ARBITRUM_TOKENS.usdt, decimals: 6 };
    if (key === "USDC") return { address: ARBITRUM_TOKENS.usdc, decimals: 6 };
    if (key === "DAI") return { address: ARBITRUM_TOKENS.dai, decimals: 18 };
    return null;
  }
  if (chainId === "polygon") {
    if (key === "USDT") return { address: POLYGON_TOKENS.usdt, decimals: 6 };
    if (key === "USDC") return { address: POLYGON_TOKENS.usdc, decimals: 6 };
    if (key === "DAI") return { address: POLYGON_TOKENS.dai, decimals: 18 };
    return null;
  }
  if (chainId === "ethereum") {
    if (key === "USDT") return { address: ETHEREUM_TOKENS.usdt, decimals: 6 };
    if (key === "USDC") return { address: ETHEREUM_TOKENS.usdc, decimals: 6 };
    if (key === "DAI") return { address: ETHEREUM_TOKENS.dai, decimals: 18 };
    return null;
  }
  if (key === "USDT") return { address: BSC_TOKENS.usdt, decimals: 18 };
  if (key === "USDC") return { address: BSC_TOKENS.usdc, decimals: 18 };
  if (key === "BUSD") return { address: BSC_TOKENS.busd, decimals: 18 };
  return null;
}

export function formatNativeBalance(wei: bigint): string {
  const n = Number(wei) / 1e18;
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (n >= 0.0001) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

export function formatTokenBalance(wei: bigint, decimals: number): string {
  try {
    const text = formatUnits(wei, decimals);
    const n = Number(text);
    if (!Number.isFinite(n)) return text;
    return n.toFixed(2);
  } catch {
    return "0.00";
  }
}

export function nativeGasWarning(chainId: ChainId): string {
  if (chainId === "bsc") return "[WARNING] Saldo BNB gas menipis! Eksekusi otomatis ditangguhkan.";
  if (chainId === "polygon") return "[WARNING] Saldo POL gas menipis! Eksekusi otomatis ditangguhkan.";
  return LOW_GAS_WARNING;
}

export function nativeSymbolForChain(chainId: ChainId): NativeSymbol {
  const symbol = getChain(chainId).nativeSymbol;
  if (symbol === "BNB" || symbol === "POL" || symbol === "AVAX" || symbol === "ATOM" || symbol === "FTM" || symbol === "SOL") {
    return symbol;
  }
  return "ETH";
}

export function peekScanSignerBalances(): SignerLiveBalances | null {
  const live = lastScanSignerBalances;
  if (!live) return null;
  const chain = live.chainId;
  if (chain && live.nativeSymbol !== nativeSymbolForChain(chain)) return null;
  return live;
}

export function rememberScanSignerBalances(balances: SignerLiveBalances | null | undefined): void {
  lastScanSignerBalances = balances ?? null;
}

export function logLowNativeGasIfNeeded(_low: boolean, _chainId: ChainId): void {
  /* Saldo POL/ETH/BNB (Gas) hanya informatif di baris scan. */
}

async function getNativeBalance(chainId: ChainId, address: string): Promise<bigint> {
  return withRpcFailover(chainId, async (url) => {
    const hex = await jsonRpc<string>(url, {
      method: "eth_getBalance",
      params: [address, "latest"],
    });
    return BigInt(hex);
  });
}

async function getErc20Balance(
  chainId: ChainId,
  token: string,
  owner: string
): Promise<bigint> {
  const data = ERC20_IFACE.encodeFunctionData("balanceOf", [owner]);
  const raw = await ethCall({ to: token, data }, undefined, chainId);
  const [value] = ERC20_IFACE.decodeFunctionResult("balanceOf", raw) as unknown as [bigint];
  return BigInt(value);
}

/** Alamat executor BalancerFlashArb (bukan Balancer Vault 0xBA12…) untuk balanceOf token. */
export function executorContractAddress(chainId: ChainId): string {
  const raw = contractAddressFromEnv(chainId).trim();
  if (!raw || isProtocolBalancerVault(raw)) return "";
  return raw;
}

export async function fetchSignerLiveBalances(input: {
  chainId: ChainId;
  quoteSymbol?: string;
  baseSymbol?: string;
}): Promise<SignerLiveBalances | null> {
  const chainId = normalizeTradingChainId(input.chainId);

  // Solana: Ankr getBalance + SPL token accounts (bukan eth_getBalance).
  if (chainId === "solana") {
    const address = solanaVaultAddress() || solanaSignerAddress();
    const cacheKey = `solana:${address || "-"}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      rememberScanSignerBalances(hit.data);
      return hit.data;
    }

    const bal = await fetchSolanaVaultBalances(address || undefined);
    if (!bal) {
      const empty: SignerLiveBalances = {
        address: address || undefined,
        vaultAddress: address || undefined,
        chainId: "solana",
        nativeWei: "0",
        nativeSymbol: "SOL",
        nativeFormatted: "0",
        nativeLow: false,
        tokenSymbol: "USDC",
        tokenFormatted: "0.00",
        vaultFormatted: "0.00",
        vaultAmount: 0,
        vaultLow: false,
        vaultEthFormatted: "0",
        vaultUsdcFormatted: "0.00",
        vaultUsdtFormatted: "0.00",
      };
      cache.set(cacheKey, { at: Date.now(), data: empty });
      rememberScanSignerBalances(empty);
      return empty;
    }
    const data: SignerLiveBalances = {
      address: bal.address,
      vaultAddress: bal.address,
      chainId: "solana",
      nativeWei: bal.solLamports.toString(),
      nativeSymbol: "SOL",
      nativeFormatted: bal.solFormatted,
      nativeLow: false,
      tokenSymbol: "USDC",
      tokenFormatted: bal.usdcFormatted,
      vaultFormatted: bal.usdcFormatted,
      vaultAmount: Number(bal.usdcFormatted) || 0,
      vaultLow: false,
      vaultEthFormatted: bal.solFormatted,
      vaultUsdcFormatted: bal.usdcFormatted,
      vaultUsdtFormatted: bal.usdtFormatted,
    };
    cache.set(cacheKey, { at: Date.now(), data });
    rememberScanSignerBalances(data);
    return data;
  }

  const signer = autonomousSignerStatus(chainId);
  const vaultAddress = executorContractAddress(chainId);
  if (!signer.address && !vaultAddress) return null;

  const stable = pickStableSymbol(input.quoteSymbol, input.baseSymbol) ?? (chainId === "bsc" ? "USDT" : "USDC");
  const cacheKey = `${chainId}:${signer.address || "-"}:${vaultAddress}:${stable || "-"}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const nativeSymbol = nativeSymbolForChain(chainId);
  let nativeWei = 0n;
  if (signer.address) {
    try {
      nativeWei = await getNativeBalance(chainId, signer.address);
    } catch {
      nativeWei = 0n;
    }
  }

  let vaultEthWei = 0n;
  let usdcWei = 0n;
  let usdtWei = 0n;
  if (vaultAddress) {
    try {
      vaultEthWei = await getNativeBalance(chainId, vaultAddress);
    } catch {
      vaultEthWei = 0n;
    }
    const wrapped =
      chainId === "polygon"
        ? POLYGON_TOKENS.wmatic
        : chainId === "bsc"
          ? BSC_TOKENS.wbnb
          : chainId === "ethereum"
            ? ETHEREUM_TOKENS.weth
            : ARBITRUM_TOKENS.weth;
    try {
      vaultEthWei += await getErc20Balance(chainId, wrapped, vaultAddress);
    } catch {
      /* native saja */
    }
    const usdc = stableToken(chainId, "USDC");
    const usdt = stableToken(chainId, "USDT");
    if (usdc) {
      try {
        usdcWei = await getErc20Balance(chainId, usdc.address, vaultAddress);
      } catch {
        usdcWei = 0n;
      }
    }
    if (usdt) {
      try {
        usdtWei = await getErc20Balance(chainId, usdt.address, vaultAddress);
      } catch {
        usdtWei = 0n;
      }
    }
  }

  const vaultEthFormatted = formatNativeBalance(vaultEthWei);
  const vaultUsdcFormatted = formatTokenBalance(usdcWei, stableToken(chainId, "USDC")?.decimals ?? 6);
  const vaultUsdtFormatted = formatTokenBalance(usdtWei, stableToken(chainId, "USDT")?.decimals ?? (chainId === "bsc" ? 18 : 6));

  let tokenSymbol: string | undefined;
  let tokenFormatted: string | undefined;
  let vaultFormatted: string | undefined;
  let vaultAmount = 0;
  if (stable) {
    const meta = stableToken(chainId, stable);
    tokenSymbol = stable;
    if (stable === "USDC") {
      vaultAmount = Number(vaultUsdcFormatted);
      if (!Number.isFinite(vaultAmount)) vaultAmount = 0;
      vaultFormatted = vaultUsdcFormatted;
      tokenFormatted = vaultUsdcFormatted;
    } else if (stable === "USDT") {
      vaultAmount = Number(vaultUsdtFormatted);
      if (!Number.isFinite(vaultAmount)) vaultAmount = 0;
      vaultFormatted = vaultUsdtFormatted;
      tokenFormatted = vaultUsdtFormatted;
    } else if (meta && vaultAddress) {
      try {
        const tokenWei = await getErc20Balance(chainId, meta.address, vaultAddress);
        vaultAmount = Number(formatUnits(tokenWei, meta.decimals));
        if (!Number.isFinite(vaultAmount)) vaultAmount = 0;
        vaultFormatted = formatTokenBalance(tokenWei, meta.decimals);
        tokenFormatted = vaultFormatted;
      } catch {
        vaultFormatted = "0.00";
        tokenFormatted = "0.00";
      }
    } else {
      vaultFormatted = "0.00";
      tokenFormatted = "0.00";
    }
  }

  const nativeFormatted = formatNativeBalance(nativeWei);
  /** Soft warning saja — gerbang ketat ada di assertSufficientExecFunds (wallet vs gasLimit×price). */
  const minWei = BigInt(Math.floor(MIN_NATIVE_GAS_ETH * 1e18));
  const nativeLow = nativeWei > 0n && nativeWei < minWei;
  const data: SignerLiveBalances = {
    address: signer.address,
    vaultAddress: vaultAddress || undefined,
    chainId,
    nativeWei: nativeWei.toString(),
    nativeSymbol,
    nativeFormatted,
    nativeLow,
    tokenSymbol,
    tokenFormatted,
    vaultFormatted,
    vaultAmount,
    vaultLow: false,
    vaultEthFormatted,
    vaultUsdcFormatted,
    vaultUsdtFormatted,
  };
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}

export function assertSignerHasGas(balances: SignerLiveBalances | null, chainId: ChainId): void {
  if (!balances || chainId === "solana" || chainId === "cosmos") return;
  const have = (() => {
    try {
      return BigInt(balances.nativeWei || "0");
    } catch {
      return 0n;
    }
  })();
  if (have <= 0n) {
    throw new Error(
      `${INSUFFICIENT_FUNDS_PREFIX}: saldo ${balances.nativeSymbol} dompet signer = 0. Isi gas native di dompet eksekusi.`
    );
  }
}

export const INSUFFICIENT_FUNDS_PREFIX = "[SKIP] Dana tidak cukup";

export function usesProtocolFlashLiquidity(provider?: string): boolean {
  const id = (provider || "").toLowerCase();
  return (
    id === "balancer" ||
    id === "aave" ||
    id === "uniswap" ||
    id === "sushiswap" ||
    id === "kamino" ||
    id === "dydx"
  );
}

export {
  estimatedTxGasWei,
  estimateTxGasCostWei,
  formatGasCostNative,
  formatEstimatedTxGasFromPrice,
  resolvePreExecGasLimit,
  ARBITRUM_PREEXEC_GAS_LIMIT,
} from "@/lib/bot/gasCostEstimate";

export function flashLoanSourceAddress(
  chainId: ChainId,
  provider: string,
  flashPair?: string
): string {
  if (provider === "kamino" || provider === "dydx" || isKaminoFlashProvider(provider)) {
    return KAMINO_FLASH_LOAN_SOURCE;
  }
  if (chainId === "arbitrum" || provider === "balancer") return BALANCER_V2_VAULT;
  return (flashPair || flashLoanPoolFromEnv(chainId) || "").trim();
}

/** Cek gas signer (dompet) vs biaya tx riil + likuiditas sumber pinjaman sebelum broadcast [EXEC]. */
export async function assertSufficientExecFunds(input: {
  chainId: ChainId;
  balances: SignerLiveBalances | null;
  config: Pick<BotConfig, "flashLoanProvider" | "loanAmountUsd" | "gasLimit">;
  opportunity: Pick<
    Opportunity,
    "amountInWei" | "tokenIn" | "tokenOut" | "pairId" | "quoteDecimals" | "quoteUsd" | "flashPair"
  >;
  gasPriceWei: bigint;
  checkSignerGas?: boolean;
}): Promise<void> {
  const chainId = input.chainId;
  // EVM: gas + tip/bribe dibayar Wallet (EOA signer) lewat eth_sendRawTransaction.
  // Kontrak executor (Vault) TIDAK perlu native untuk fee — Vault=0 normal untuk flashloan.
  // Jangan pernah menolak hanya karena vaultEthFormatted === "0".
  if (chainId !== "solana" && chainId !== "cosmos") {
    const haveWei = (() => {
      try {
        return BigInt(input.balances?.nativeWei || "0");
      } catch {
        return 0n;
      }
    })();
    const preExecLimit = resolvePreExecGasLimit(chainId, input.config.gasLimit || 650_000);
    const needWei = estimatedTxGasWei(preExecLimit, input.gasPriceWei);
    const symbol = input.balances?.nativeSymbol || nativeSymbolForChain(chainId);
    const vaultNative = (input.balances?.vaultEthFormatted || "0").trim();
    if (haveWei < needWei) {
      const message =
        `${INSUFFICIENT_FUNDS_PREFIX}: saldo ${symbol} Wallet (gas) ${formatNativeBalance(haveWei)} ` +
        `< biaya gas estimasi ${formatGasCostNative(needWei)} ` +
        `(gasLimit ${preExecLimit} × price + buffer 30%). ` +
        `Vault ${symbol}=${vaultNative || "0"} tidak dipakai untuk gas. Eksekusi ditahan.`;
      console.warn(`[EXEC] ${message}`);
      throw new Error(message);
    }
    if (haveWei <= 0n) {
      const message =
        `${INSUFFICIENT_FUNDS_PREFIX}: Wallet ${symbol} (gas) kosong. ` +
        `Isi native di dompet signer — bukan Vault. Vault ${symbol}=${vaultNative || "0"} diabaikan untuk fee.`;
      console.warn(`[EXEC] ${message}`);
      throw new Error(message);
    }
    console.log(
      `[EXEC] Gas check OK · Wallet ${symbol} (gas)=${formatNativeBalance(haveWei)}` +
        ` ≥ estimasi ${formatGasCostNative(needWei)}` +
        ` · limit ${preExecLimit}` +
        ` · Vault ${symbol}=${vaultNative || "0"} (bukan sumber gas)`
    );
  }

  const checkGas = input.checkSignerGas === true;
  if (checkGas) {
    assertSignerHasGas(input.balances, input.chainId);
  }

  const pair = getPair(input.chainId, input.opportunity.pairId);
  const meta =
    stableToken(
      input.chainId,
      pickStableSymbol(input.opportunity.tokenIn, input.opportunity.tokenOut) ||
        pair?.quoteSymbol ||
        "USDC"
    ) ||
    (pair?.quoteAddress
      ? { address: pair.quoteAddress, decimals: pair.quoteDecimals ?? 6 }
      : null);
  const tokenAddress = meta?.address || pair?.quoteAddress || "";
  const decimals = meta?.decimals ?? pair?.quoteDecimals ?? input.opportunity.quoteDecimals ?? 6;
  const symbol =
    input.balances?.tokenSymbol ||
    pickStableSymbol(input.opportunity.tokenIn, input.opportunity.tokenOut) ||
    pair?.quoteSymbol ||
    "USDC";

  let loanWei = 0n;
  try {
    loanWei = BigInt(input.opportunity.amountInWei || "0");
  } catch {
    loanWei = 0n;
  }
  const loanUsd =
    tokenWeiToUsd(loanWei, decimals, input.opportunity.quoteUsd ?? 1) ||
    Number(input.config.loanAmountUsd) ||
    0;

  if (loanWei <= 0n) {
    const message = `${INSUFFICIENT_FUNDS_PREFIX}: jumlah pinjaman 0. Eksekusi ditahan.`;
    console.warn(`[EXEC] ${message}`);
    throw new Error(message);
  }

  const flash = usesProtocolFlashLiquidity(input.config.flashLoanProvider);
  const kamino = isKaminoFlashProvider(input.config.flashLoanProvider);
  const source = flashLoanSourceAddress(
    input.chainId,
    input.config.flashLoanProvider,
    input.opportunity.flashPair
  );

  // Kamino K-Lend di Solana — jangan eth_call balanceOf ke program ID Solana.
  if (kamino) {
    console.log(
      `[EXEC] Flashloan ${symbol} ~$${loanUsd.toFixed(2)} via Kamino K-Lend ` +
        `(Solana mainnet-beta · program ${KAMINO_KLEND_PROGRAM_ID.slice(0, 8)}… · fee ${KAMINO_FLASH_FEE_PCT}%). ` +
        `Gas ${input.balances?.nativeSymbol || "ETH"}: ${input.balances?.nativeFormatted ?? "—"}`
    );
    return;
  }

  if (flash && tokenAddress && source) {
    let sourceWei: bigint | null = null;
    try {
      sourceWei = await getErc20Balance(input.chainId, tokenAddress, source);
    } catch {
      sourceWei = null;
    }
    if (sourceWei == null) {
      console.warn(
        `[EXEC] gagal baca likuiditas ${symbol} di sumber flashloan — lanjut ke preflight BlockPi`
      );
    } else if (sourceWei < loanWei) {
      const have = formatTokenBalance(sourceWei, decimals);
      const need = formatTokenBalance(loanWei, decimals);
      const message =
        `${INSUFFICIENT_FUNDS_PREFIX}: likuiditas ${symbol} di sumber flashloan ` +
        `${source.slice(0, 10)}… = ${have} < loan ${need} (~$${loanUsd.toFixed(2)}). Eksekusi ditahan.`;
      console.warn(`[EXEC] ${message}`);
      throw new Error(message);
    }
  }

  const inventoryAddr = executorContractAddress(input.chainId) || input.balances?.address || "";
  if (!flash && tokenAddress && inventoryAddr) {
    let haveWei = 0n;
    try {
      haveWei = await getErc20Balance(input.chainId, tokenAddress, inventoryAddr);
    } catch {
      haveWei = 0n;
    }
    if (haveWei < loanWei) {
      const have = formatTokenBalance(haveWei, decimals);
      const need = formatTokenBalance(loanWei, decimals);
      const message =
        `${INSUFFICIENT_FUNDS_PREFIX}: saldo ${symbol} di vault/dompet ${have} ` +
        `< loan ${need} (~$${loanUsd.toFixed(2)}). Eksekusi ditahan.`;
      console.warn(`[EXEC] ${message}`);
      throw new Error(message);
    }
  } else {
    const leftover = input.balances?.vaultFormatted || "0.00";
    console.log(
      `[EXEC] Flashloan ${symbol} ~$${loanUsd.toFixed(2)} dari protokol (sisa vault executor ${leftover} bukan modal pinjaman). ` +
        `Gas ${input.balances?.nativeSymbol || "ETH"}: ${input.balances?.nativeFormatted ?? "—"}`
    );
  }
}
