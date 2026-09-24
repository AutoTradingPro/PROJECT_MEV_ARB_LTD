import {
  BrowserProvider,
  Contract,
  Interface,
  JsonRpcProvider,
  MaxUint256,
  ZeroAddress,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  type Eip1193Provider,
  type Signer,
  type TransactionResponse,
} from "ethers";
import { ARBITRUM_TOKENS, ETHEREUM_TOKENS, POLYGON_TOKENS } from "@/config/networks";
import { USDT as USDT_BSC } from "@/lib/bot/constants";
import { createJsonRpcProvider } from "@/lib/bot/rpc";
import { getChain, resolveChainRpc, type ChainId } from "@/lib/chain/networks";
import { formatWalletError } from "@/lib/wallet/rpcError";
import { getWalletChainIdHex, parseChainIdHex, switchWalletChain } from "@/lib/wallet/provider";
import { ERC20_ABI, ERC20_LEGACY_ABI, VAULT_ABI } from "@/lib/vault/abi";
import {
  ARBITRUM_EVM_CHAIN_ID,
  BSC_EVM_CHAIN_ID,
  BSC_EXECUTOR_ADDRESS,
  ETHEREUM_EVM_CHAIN_ID,
  executorAddressForChainId,
} from "@/lib/vault/executors";

export {
  ARBITRUM_EVM_CHAIN_ID,
  BSC_EVM_CHAIN_ID,
  ETHEREUM_EVM_CHAIN_ID,
  BSC_EXECUTOR_ADDRESS as DEFAULT_EXECUTOR_ADDRESS,
};
export {
  ARBITRUM_EXECUTOR_ADDRESS,
  ETHEREUM_EXECUTOR_ADDRESS,
  EXECUTOR_BY_CHAIN_ID,
  executorConfigForChainId,
  executorAddressForChainId,
} from "@/lib/vault/executors";
/** Deployer / owner yang di-set di konstruktor kontrak executor. */
export const CONTRACT_DEPLOYER_ADDRESS = "0x05F41c27821793D28788b91161Bd7026027bc387";
export const VAULT_USDT_ADDRESS = USDT_BSC;

export type VaultAsset = "native" | "usdt" | "usdc" | "bnb";

export interface VaultBalances {
  nativeWei: bigint;
  nativeSymbol: string;
  nativeLabel: string;
  usdtRaw: bigint;
  usdtDecimals: number;
  usdtLabel: string;
  usdcRaw: bigint;
  usdcDecimals: number;
  usdcLabel: string;
  /** @deprecated alias native */
  bnbWei: bigint;
  bnbLabel: string;
}

const EXECUTOR_IFACE = new Interface([...VAULT_ABI]);
const WITHDRAW_GAS_LIMIT = 400_000n;

function injectedProvider(): Eip1193Provider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask atau Rabby tidak terdeteksi.");
  }
  return window.ethereum as Eip1193Provider;
}

export function tradingChainId(chainId?: string): "bsc" | "arbitrum" | "polygon" | "ethereum" {
  if (chainId === "polygon") return "polygon";
  if (chainId === "ethereum") return "ethereum";
  if (chainId === "arbitrum") return "arbitrum";
  return "bsc";
}

export function vaultContractAddress(chainId?: string): string {
  const id = tradingChainId(chainId);
  if (id === "polygon") {
    return (process.env.NEXT_PUBLIC_POLYGON_ARBITRAGE_EXECUTOR || "").trim();
  }
  if (id === "ethereum") {
    return (
      executorAddressForChainId(ETHEREUM_EVM_CHAIN_ID) ||
      (process.env.NEXT_PUBLIC_ETHEREUM_ARBITRAGE_EXECUTOR || "").trim()
    );
  }
  const evm = id === "arbitrum" ? ARBITRUM_EVM_CHAIN_ID : BSC_EVM_CHAIN_ID;
  return executorAddressForChainId(evm) || (evm === BSC_EVM_CHAIN_ID ? BSC_EXECUTOR_ADDRESS : "");
}

export function tokenAddressForAsset(chainId: string | undefined, asset: VaultAsset): string {
  const chain = tradingChainId(chainId);
  if (isNativeAsset(asset)) return ZeroAddress;
  if (chain === "arbitrum") {
    return asset === "usdc" ? ARBITRUM_TOKENS.usdc : ARBITRUM_TOKENS.usdt;
  }
  if (chain === "ethereum") {
    return asset === "usdc" ? ETHEREUM_TOKENS.usdc : ETHEREUM_TOKENS.usdt;
  }
  if (chain === "polygon") {
    return asset === "usdc" ? POLYGON_TOKENS.usdc : POLYGON_TOKENS.usdt;
  }
  return USDT_BSC;
}

export function isNativeAsset(asset: VaultAsset): boolean {
  return asset === "native" || asset === "bnb";
}

export function assetSymbol(chainId: string | undefined, asset: VaultAsset): string {
  if (isNativeAsset(asset)) {
    const chain = tradingChainId(chainId);
    if (chain === "polygon") return "POL";
    if (chain === "arbitrum" || chain === "ethereum") return "ETH";
    return "BNB";
  }
  return asset === "usdc" ? "USDC" : "USDT";
}

export function isUserRejected(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: number | string; message?: string; shortMessage?: string };
  if (err.code === 4001 || err.code === "ACTION_REJECTED") return true;
  const text = `${err.message ?? ""} ${err.shortMessage ?? ""}`;
  return /user rejected|denied|ditolak|rejected the request/i.test(text);
}

export function rawVaultError(error: unknown): string {
  if (error instanceof Error) {
    const extra = error as { shortMessage?: string; reason?: string; code?: string | number };
    return [error.message, extra.shortMessage, extra.reason, extra.code != null ? `code=${extra.code}` : ""]
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function extractRevertHex(error: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (value: unknown): string | null => {
    if (value == null || seen.has(value)) return null;
    if (typeof value === "string") {
      const match = value.match(/0x[0-9a-fA-F]{8,}/);
      return match ? match[0] : null;
    }
    if (typeof value !== "object") return null;
    seen.add(value);
    const record = value as Record<string, unknown>;
    for (const key of ["data", "error", "info", "payload", "body", "result", "revert"]) {
      const hit = walk(record[key]);
      if (hit) return hit;
    }
    return null;
  };
  return walk(error);
}

function mapCustomError(name: string, signature: string): string {
  switch (name) {
    case "NotOwner":
      return `On-chain revert: ${signature} — dompet yang terhubung bukan owner kontrak. Hubungkan wallet yang mendeploy/memiliki executor.`;
    case "NativeTransferFailed":
      return `On-chain revert: ${signature} — transfer native gagal (saldo 0 atau penerima menolak ETH/BNB).`;
    case "InvalidCallback":
      return `On-chain revert: ${signature} — parameter tidak valid (alamat tujuan atau token).`;
    case "IsKilled":
      return `On-chain revert: ${signature} — kontrak dalam mode kill.`;
    case "Unauthorized":
      return `On-chain revert: ${signature} — pemanggil bukan owner BalancerFlashArb. Hubungkan wallet deployer.`;
    default:
      return `On-chain revert: ${signature}`;
  }
}

export function decodeOnchainRevert(error: unknown): string | null {
  const hex = extractRevertHex(error);
  if (hex && hex !== "0x") {
    try {
      const parsed = EXECUTOR_IFACE.parseError(hex);
      if (parsed) return mapCustomError(parsed.name, parsed.signature);
    } catch {
      /* selector tidak ada di ABI aktif */
    }
  }
  const revertName =
    error && typeof error === "object"
      ? (error as { revert?: { name?: string; signature?: string } }).revert
      : undefined;
  if (revertName?.name) {
    return mapCustomError(revertName.name, revertName.signature || `${revertName.name}()`);
  }
  return null;
}

export function formatVaultError(error: unknown): string {
  if (isUserRejected(error)) {
    return "Transaksi ditolak di MetaMask. Tidak ada transaksi yang dikirim ke jaringan.";
  }
  const decoded = decodeOnchainRevert(error);
  if (decoded) return decoded;
  if (error instanceof Error && /on-chain revert|saldo riil kontrak|bukan owner|Simulasi on-chain/i.test(error.message)) {
    return error.message;
  }
  const text = formatWalletError(error);
  if (/InvalidFEOpcode|missing revert data/i.test(text)) {
    return (
      "Simulasi gas gagal pada USDT/token (RPC: InvalidFEOpcode / missing revert data). " +
      "Quirk umum USDT Ethereum — app akan retry dengan gasLimit tetap. Detail: " +
      text.slice(0, 240)
    );
  }
  return text;
}

export async function getBrowserSigner(expectedEvmChainId?: number) {
  const provider = new BrowserProvider(injectedProvider(), "any");
  await provider.send("eth_requestAccounts", []);
  if (expectedEvmChainId && expectedEvmChainId > 0) {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== expectedEvmChainId) {
      throw new Error(
        `Dompet tidak di jaringan yang diminta (chainId ${expectedEvmChainId}). Buka MetaMask, pilih jaringan yang benar, lalu coba lagi.`
      );
    }
  }
  return provider.getSigner();
}

function readProvider(chainId: string | undefined): JsonRpcProvider {
  const id = tradingChainId(chainId);
  const rpc = resolveChainRpc(id);
  const chain = getChain(id);
  return createJsonRpcProvider(rpc, chain.chainId ?? 1);
}

export function formatTokenAmount(raw: bigint, decimals: number, symbol: string, digits = 6): string {
  const text = formatUnits(raw, decimals);
  const num = Number.parseFloat(text);
  if (!Number.isFinite(num)) return `0 ${symbol}`;
  if (num === 0) return `0 ${symbol}`;
  if (num < 0.000001) return `<0.000001 ${symbol}`;
  return `${num.toFixed(digits)} ${symbol}`;
}

async function tokenMeta(
  provider: JsonRpcProvider,
  token: string,
  fallbackDecimals: number,
  symbol: string,
  holder: string
): Promise<{ raw: bigint; decimals: number; label: string }> {
  const contract = new Contract(token, ERC20_ABI, provider);
  const [raw, decimals] = await Promise.all([
    contract.balanceOf(holder) as Promise<bigint>,
    contract
      .decimals()
      .then((d: bigint) => Number(d))
      .catch(() => fallbackDecimals),
  ]);
  return { raw, decimals, label: formatTokenAmount(raw, decimals, symbol) };
}

export async function fetchVaultBalances(
  vaultAddress: string,
  chainId?: string
): Promise<VaultBalances> {
  const id = tradingChainId(chainId);
  const provider = readProvider(id);
  const nativeWei = await provider.getBalance(vaultAddress);
  const nativeSymbol = getChain(id).nativeSymbol;
  const nativeLabel = `${formatEther(nativeWei)} ${nativeSymbol}`;

  const usdtAddr = tokenAddressForAsset(id, "usdt");
  const usdt = await tokenMeta(provider, usdtAddr, id === "bsc" ? 18 : 6, "USDT", vaultAddress);

  let usdc = { raw: 0n, decimals: 6, label: "0 USDC" };
  if (id === "arbitrum") {
    usdc = await tokenMeta(provider, ARBITRUM_TOKENS.usdc, 6, "USDC", vaultAddress);
  } else if (id === "ethereum") {
    usdc = await tokenMeta(provider, ETHEREUM_TOKENS.usdc, 6, "USDC", vaultAddress);
  }

  return {
    nativeWei,
    nativeSymbol,
    nativeLabel,
    usdtRaw: usdt.raw,
    usdtDecimals: usdt.decimals,
    usdtLabel: usdt.label,
    usdcRaw: usdc.raw,
    usdcDecimals: usdc.decimals,
    usdcLabel: usdc.label,
    bnbWei: nativeWei,
    bnbLabel: nativeLabel,
  };
}

async function waitTx(tx: TransactionResponse): Promise<string> {
  const receipt = await tx.wait();
  if (receipt && receipt.status === 0) {
    throw new Error(
      "Transaksi mined tetapi revert on-chain (status 0). Tidak ada dana yang berpindah. Cek explorer untuk detail."
    );
  }
  return receipt?.hash ?? tx.hash;
}

const ETHEREUM_USDT = ETHEREUM_TOKENS.usdt.toLowerCase();

function isEthereumMainnetUsdt(tokenAddr: string, evmChainId: number): boolean {
  return evmChainId === ETHEREUM_EVM_CHAIN_ID && tokenAddr.trim().toLowerCase() === ETHEREUM_USDT;
}

function erc20AbiFor(tokenAddr: string, evmChainId: number) {
  return isEthereumMainnetUsdt(tokenAddr, evmChainId) ? ERC20_LEGACY_ABI : ERC20_ABI;
}

function isEstimateGasFailure(error: unknown): boolean {
  const text = `${formatWalletError(error)} ${rawVaultError(error)}`;
  return /estimateGas|missing revert data|InvalidFEOpcode|cannot estimate|UNPREDICTABLE_GAS_LIMIT/i.test(
    text
  );
}

type TxOverrides = { gasLimit?: bigint };

async function sendMaybeWithGas(
  send: (overrides?: TxOverrides) => Promise<TransactionResponse>,
  fallbackGasLimit: bigint
): Promise<TransactionResponse> {
  try {
    return await send();
  } catch (error) {
    if (isUserRejected(error)) throw error;
    if (!isEstimateGasFailure(error)) throw error;
    console.warn(
      `[vault] estimateGas gagal — retry gasLimit=${fallbackGasLimit}`,
      formatWalletError(error)
    );
    return send({ gasLimit: fallbackGasLimit });
  }
}

async function ensureTokenAllowance(
  tokenAddr: string,
  owner: string,
  spender: string,
  amount: bigint,
  expectedEvmChainId: number
): Promise<void> {
  const signer = await getBrowserSigner(expectedEvmChainId);
  const token = new Contract(tokenAddr, erc20AbiFor(tokenAddr, expectedEvmChainId), signer);
  const current = (await token.allowance(owner, spender)) as bigint;
  if (current >= amount) return;

  // USDT mainnet: harus approve(0) dulu jika allowance > 0.
  if (isEthereumMainnetUsdt(tokenAddr, expectedEvmChainId) && current > 0n) {
    const reset = await sendMaybeWithGas(
      (overrides) => token.approve(spender, 0n, overrides ?? {}) as Promise<TransactionResponse>,
      60_000n
    );
    await waitTx(reset);
  }

  const approveGas = isEthereumMainnetUsdt(tokenAddr, expectedEvmChainId) ? 80_000n : 120_000n;
  const tx = await sendMaybeWithGas(
    (overrides) =>
      token.approve(spender, MaxUint256, overrides ?? {}) as Promise<TransactionResponse>,
    approveGas
  );
  await waitTx(tx);
}

export function parseAssetAmount(amount: string, asset: VaultAsset, tokenDecimals = 18): bigint {
  const trimmed = amount.trim();
  if (!trimmed) throw new Error("Masukkan nominal yang valid.");
  const parsed = isNativeAsset(asset) ? parseEther(trimmed) : parseUnits(trimmed, tokenDecimals);
  if (parsed <= 0n) throw new Error("Nominal harus lebih dari 0.");
  return parsed;
}

function isContractDeployer(address: string): boolean {
  return address.toLowerCase() === CONTRACT_DEPLOYER_ADDRESS.toLowerCase();
}

function encodeRescueFunds(
  tokenArg: string,
  amountWei: bigint,
  chain: "bsc" | "arbitrum"
): { method: string; data: string } {
  if (chain === "arbitrum") {
    if (tokenArg === ZeroAddress) {
      return {
        method: "rescueETH()",
        data: EXECUTOR_IFACE.encodeFunctionData("rescueETH", []),
      };
    }
    return {
      method: "rescueFunds(address,uint256)",
      data: EXECUTOR_IFACE.encodeFunctionData("rescueFunds(address,uint256)", [tokenArg, amountWei]),
    };
  }
  return {
    method: "rescueFunds(address)",
    data: EXECUTOR_IFACE.encodeFunctionData("rescueFunds(address)", [tokenArg]),
  };
}

function decimalsForAsset(asset: VaultAsset, balances?: VaultBalances | null, chainId?: string): number {
  if (isNativeAsset(asset)) return 18;
  if (asset === "usdc") return balances?.usdcDecimals ?? 6;
  return balances?.usdtDecimals ?? (tradingChainId(chainId) === "bsc" ? 18 : 6);
}

/** String exact dari wei — round-trip aman dengan parseUnits/parseEther. */
export function formatExactAssetAmount(raw: bigint, decimals: number): string {
  if (raw <= 0n) return "0";
  return formatUnits(raw, decimals);
}

export function maxWithdrawInputFromBalances(
  balances: VaultBalances | null | undefined,
  asset: VaultAsset,
  chainId?: string
): string {
  if (!balances) return "";
  if (isNativeAsset(asset)) return formatExactAssetAmount(balances.nativeWei, 18);
  if (asset === "usdc") {
    return formatExactAssetAmount(balances.usdcRaw, decimalsForAsset("usdc", balances, chainId));
  }
  return formatExactAssetAmount(balances.usdtRaw, decimalsForAsset("usdt", balances, chainId));
}

async function sendExecutorCall(input: {
  signer: Signer;
  to: string;
  data: string;
  method: string;
}): Promise<string> {
  console.log(`[vault] ${input.method}`, { to: input.to, data: input.data });
  try {
    const tx = await input.signer.sendTransaction({
      to: input.to,
      data: input.data,
      gasLimit: WITHDRAW_GAS_LIMIT,
    });
    console.log(`[vault] ${input.method} terkirim`, tx.hash);
    return await waitTx(tx);
  } catch (error) {
    console.error(`[vault] ${input.method} gagal`, error);
    const decoded = decodeOnchainRevert(error);
    if (decoded) throw new Error(decoded);
    throw error;
  }
}

async function preflightCall(input: {
  provider: { call: (tx: { from: string; to: string; data: string }) => Promise<string> };
  from: string;
  to: string;
  data: string;
  amount?: string;
  method?: string;
}): Promise<void> {
  console.log("[vault] preflightCall params", {
    to: input.to,
    data: input.data,
    amount: input.amount,
    from: input.from,
    method: input.method,
  });
  try {
    await input.provider.call({ from: input.from, to: input.to, data: input.data });
  } catch (error) {
    const decoded = decodeOnchainRevert(error);
    const text = rawVaultError(error);
    const emptyRevert = /no data present|missing revert data|data="0x"|data: '0x'/i.test(text);
    if (decoded || /execution reverted|revert|CALL_EXCEPTION/i.test(text)) {
      const missingFn =
        emptyRevert && input.method
          ? ` Selector ${input.method} tidak ada di bytecode (deploy ulang executor yang mewarisi FlashArbTreasury: deposit/withdraw/emergencyWithdraw/rescue).`
          : "";
      throw new Error(decoded || `Simulasi on-chain revert: ${text}.${missingFn}`);
    }
    console.warn("[vault] eth_call preflight tidak konklusif, lanjut kirim ke MetaMask", error);
  }
}

export async function readExecutorAssetBalance(input: {
  vaultAddress: string;
  asset: VaultAsset;
  chainId?: string;
  provider?: { getBalance: (addr: string) => Promise<bigint> };
}): Promise<bigint> {
  const chain = tradingChainId(input.chainId);
  const native = isNativeAsset(input.asset);
  const tokenAddr = tokenAddressForAsset(chain, input.asset);
  const provider = input.provider ?? readProvider(chain);
  if (native) return provider.getBalance(input.vaultAddress);
  const token = new Contract(tokenAddr, ERC20_ABI, provider as JsonRpcProvider);
  return (await token.balanceOf(input.vaultAddress)) as bigint;
}

export async function ensureWalletOnChain(chainId: ChainId): Promise<number> {
  const expected = getChain(chainId).chainId;
  if (!expected) throw new Error("Jaringan ini tidak mendukung transaksi EVM.");
  try {
    await Promise.race([
      switchWalletChain(chainId),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(
            new Error(
              `Switch jaringan ke ${getChain(chainId).shortLabel} (chainId ${expected}) timeout. Pilih jaringan itu di MetaMask.`
            )
          );
        }, 25_000);
      }),
    ]);
  } catch (error) {
    console.error("[vault] switch chain gagal", error);
    throw error;
  }
  const hex = await getWalletChainIdHex();
  const actual = parseChainIdHex(hex);
  console.log("[vault] chain wallet", { expected, actual, portal: chainId });
  if (actual !== expected) {
    throw new Error(
      `Chain ID tidak sinkron. Portal: ${getChain(chainId).shortLabel} (${expected}), dompet: ${actual ?? "?"}. Pilih jaringan yang sama di MetaMask.`
    );
  }
  return expected;
}

export async function depositToVault(input: {
  vaultAddress: string;
  asset: VaultAsset;
  amount: string;
  ownerAddress: string;
  chainId?: string;
  usdtDecimals?: number;
  tokenDecimals?: number;
}): Promise<string> {
  const chain = tradingChainId(input.chainId);
  const expected = await ensureWalletOnChain(chain);
  const signer = await getBrowserSigner(expected);
  const decimals = input.tokenDecimals ?? input.usdtDecimals ?? decimalsForAsset(input.asset, null, chain);
  const amountWei = parseAssetAmount(input.amount, input.asset, decimals);
  const vault = new Contract(input.vaultAddress, VAULT_ABI, signer);

  if (isNativeAsset(input.asset)) {
    try {
      const tx = await sendMaybeWithGas(
        (overrides) =>
          vault.deposit({ value: amountWei, ...(overrides ?? {}) }) as Promise<TransactionResponse>,
        80_000n
      );
      return await waitTx(tx);
    } catch (error) {
      if (isUserRejected(error)) throw error;
      const tx = await sendMaybeWithGas(
        (overrides) =>
          signer.sendTransaction({
            to: input.vaultAddress,
            value: amountWei,
            ...(overrides ?? {}),
          }) as Promise<TransactionResponse>,
        50_000n
      );
      return await waitTx(tx);
    }
  }

  const tokenAddr = tokenAddressForAsset(chain, input.asset);
  await ensureTokenAllowance(tokenAddr, input.ownerAddress, input.vaultAddress, amountWei, expected);

  // Path utama: depositToken (transferFrom setelah approve) — tahan estimateGas USDT mainnet.
  try {
    const tx = await sendMaybeWithGas(
      (overrides) =>
        vault.depositToken(tokenAddr, amountWei, overrides ?? {}) as Promise<TransactionResponse>,
      220_000n
    );
    return await waitTx(tx);
  } catch (depositError) {
    if (isUserRejected(depositError)) throw depositError;
    console.warn(
      "[vault] depositToken gagal — coba transfer langsung ke executor",
      formatWalletError(depositError)
    );

    // Fallback: transfer ERC-20 ke executor (valid untuk mendanai vault).
    try {
      const token = new Contract(tokenAddr, erc20AbiFor(tokenAddr, expected), signer);
      const transferGas = isEthereumMainnetUsdt(tokenAddr, expected) ? 120_000n : 100_000n;
      const tx = await sendMaybeWithGas(
        (overrides) =>
          token.transfer(input.vaultAddress, amountWei, overrides ?? {}) as Promise<TransactionResponse>,
        transferGas
      );
      return await waitTx(tx);
    } catch (transferError) {
      if (isUserRejected(transferError)) throw transferError;
      const depositMsg = formatVaultError(depositError);
      const transferMsg = formatVaultError(transferError);
      throw new Error(
        `Deposit USDT/token gagal.\n` +
          `1) depositToken: ${depositMsg}\n` +
          `2) transfer: ${transferMsg}\n` +
          (isEthereumMainnetUsdt(tokenAddr, expected)
            ? "Catatan: USDT Ethereum sering gagal di estimateGas — pastikan allowance OK dan gas ETH cukup."
            : "")
      );
    }
  }
}

export async function withdrawFromVault(input: {
  vaultAddress: string;
  asset: VaultAsset;
  amount: string;
  ownerAddress: string;
  chainId?: string;
  usdtDecimals?: number;
  tokenDecimals?: number;
  vaultBnbWei?: bigint;
  vaultUsdtRaw?: bigint;
  balances?: VaultBalances | null;
}): Promise<string> {
  const chain = tradingChainId(input.chainId);
  const symbol = assetSymbol(chain, input.asset);
  const native = isNativeAsset(input.asset);
  const tokenAddr = tokenAddressForAsset(chain, input.asset);

  try {
    const expected = await ensureWalletOnChain(chain);
    const signer = await getBrowserSigner(expected);
    const signerAddr = await signer.getAddress();
    const provider = signer.provider;
    if (!provider) {
      throw new Error("Provider wallet tidak tersedia. Refresh halaman lalu hubungkan MetaMask ulang.");
    }

    const decimals = input.tokenDecimals ?? input.usdtDecimals ?? decimalsForAsset(input.asset, input.balances, chain);
    let available: bigint;
    try {
      available = await readExecutorAssetBalance({
        vaultAddress: input.vaultAddress,
        asset: input.asset,
        chainId: chain,
        provider,
      });
    } catch (readError) {
      console.error("[vault] gagal membaca saldo riil kontrak", readError);
      throw new Error(
        `Gagal membaca saldo riil kontrak ${symbol} di ${input.vaultAddress}. Withdraw dibatalkan sebelum MetaMask dikirim.`
      );
    }

    const have = native ? formatEther(available) : formatUnits(available, decimals);
    if (available <= 0n) {
      throw new Error(
        `Saldo riil kontrak ${symbol} = 0 di ${input.vaultAddress}. Withdraw dibatalkan — transaksi tidak dikirim ke MetaMask.`
      );
    }

    try {
      const onchainOwner = (await new Contract(input.vaultAddress, VAULT_ABI, provider).owner()) as string;
      const authorized =
        !onchainOwner ||
        onchainOwner === ZeroAddress ||
        onchainOwner.toLowerCase() === signerAddr.toLowerCase() ||
        isContractDeployer(signerAddr);
      if (!authorized) {
        throw new Error(
          `On-chain owner() = ${onchainOwner}, signer = ${signerAddr}. Transaksi akan revert NotOwner. Hubungkan ${CONTRACT_DEPLOYER_ADDRESS}.`
        );
      }
      if (onchainOwner && onchainOwner !== ZeroAddress && onchainOwner.toLowerCase() !== signerAddr.toLowerCase()) {
        console.warn("[vault] owner() beda dari signer; lanjut karena signer = deployer", {
          onchainOwner,
          signer: signerAddr,
        });
      }
    } catch (ownerError) {
      if (ownerError instanceof Error && /akan revert NotOwner/i.test(ownerError.message)) {
        throw ownerError;
      }
      console.warn("[vault] owner() tidak terbaca (ABI mungkin berbeda)", ownerError);
    }

    const trimmed = input.amount.trim();
    let amountWei = 0n;
    if (trimmed) {
      amountWei = parseAssetAmount(trimmed, input.asset, decimals);
      if (amountWei > available) {
        throw new Error(
          `Nominal ${trimmed} ${symbol} melebihi saldo riil kontrak (${have} ${symbol}). Kosongkan input untuk menarik seluruh sisa, atau kurangi nominal.`
        );
      }
    }

    const dest = input.ownerAddress || signerAddr;
    const tokenArg = native ? ZeroAddress : tokenAddr;
    const pullAll = !trimmed || amountWei >= available;
    const rescueAmount = pullAll ? available : amountWei;

    const encodeWithdraw = (): { method: string; data: string } => {
      if (chain === "arbitrum") {
        return encodeRescueFunds(tokenArg, rescueAmount, chain);
      }
      if (pullAll) {
        EXECUTOR_IFACE.getFunction("emergencyWithdraw");
        return {
          method: "emergencyWithdraw(address,address)",
          data: EXECUTOR_IFACE.encodeFunctionData("emergencyWithdraw", [tokenArg, dest]),
        };
      }
      if (native) {
        EXECUTOR_IFACE.getFunction("withdraw");
        return {
          method: "withdraw(uint256)",
          data: EXECUTOR_IFACE.encodeFunctionData("withdraw", [amountWei]),
        };
      }
      EXECUTOR_IFACE.getFunction("withdrawToken");
      return {
        method: "withdrawToken(address,uint256)",
        data: EXECUTOR_IFACE.encodeFunctionData("withdrawToken", [tokenAddr, amountWei]),
      };
    };

    let encoded = encodeWithdraw();
    console.log("[vault] withdraw siap", {
      chain,
      expected,
      signer: signerAddr,
      to: input.vaultAddress,
      dest,
      asset: input.asset,
      symbol,
      amount: trimmed || "(seluruh sisa)",
      amountWei: pullAll ? available.toString() : amountWei.toString(),
      available: available.toString(),
      method: encoded.method,
    });

    const withdrawAmountLog = pullAll ? `${have} ${symbol} (seluruh sisa)` : `${trimmed} ${symbol}`;

    try {
      await preflightCall({
        provider,
        from: signerAddr,
        to: input.vaultAddress,
        data: encoded.data,
        amount: withdrawAmountLog,
        method: encoded.method,
      });
    } catch (preflightError) {
      console.warn("[vault] penarikan utama gagal preflight, fallback rescue", preflightError);
      encoded = encodeRescueFunds(tokenArg, rescueAmount, chain);
      await preflightCall({
        provider,
        from: signerAddr,
        to: input.vaultAddress,
        data: encoded.data,
        amount: withdrawAmountLog,
        method: encoded.method,
      });
    }

    try {
      return await sendExecutorCall({
        signer,
        to: input.vaultAddress,
        data: encoded.data,
        method: encoded.method,
      });
    } catch (sendError) {
      if (isUserRejected(sendError)) throw sendError;
      if (encoded.method.startsWith("rescueFunds") || encoded.method === "rescueETH()") throw sendError;
      console.warn("[vault] sendTransaction utama gagal, fallback rescue", sendError);
      encoded = encodeRescueFunds(tokenArg, rescueAmount, chain);
      await preflightCall({
        provider,
        from: signerAddr,
        to: input.vaultAddress,
        data: encoded.data,
        amount: withdrawAmountLog,
        method: encoded.method,
      });
      return await sendExecutorCall({
        signer,
        to: input.vaultAddress,
        data: encoded.data,
        method: encoded.method,
      });
    }
  } catch (error) {
    console.error("[vault] withdrawFromVault", error);
    throw error;
  }
}
