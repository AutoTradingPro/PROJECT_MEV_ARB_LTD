import { BrowserProvider, Contract, parseEther, type Eip1193Provider, type TransactionResponse } from "ethers";
import type { ChainId } from "@/lib/chain/networks";
import { getChain } from "@/lib/chain/networks";
import { isTxHash } from "@/lib/chain/explorer";
import { VAULT_ABI } from "@/lib/vault/abi";
import { formatVaultError, isUserRejected } from "@/lib/vault/client";
import { requestAccounts, switchWalletChain } from "@/lib/wallet/provider";

function injected(): Eip1193Provider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask atau Rabby tidak terdeteksi.");
  }
  return window.ethereum as Eip1193Provider;
}

async function waitTx(tx: TransactionResponse): Promise<string> {
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

export async function withdrawVaultNative(input: {
  chainId: ChainId;
  vaultAddress: string;
  amount: string;
}): Promise<string> {
  const chain = getChain(input.chainId);
  if (!chain.evm) {
    throw new Error("Penarikan kontrak Solana belum terhubung ke wallet adapter.");
  }
  const amountWei = parseEther(input.amount.trim());
  if (amountWei <= 0n) throw new Error("Nominal harus lebih dari 0.");

  await switchWalletChain(input.chainId);
  const provider = new BrowserProvider(injected(), "any");
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const vault = new Contract(input.vaultAddress, VAULT_ABI, signer);

  try {
    const tx = (await vault.withdraw(amountWei)) as TransactionResponse;
    return await waitTx(tx);
  } catch (error) {
    if (isUserRejected(error)) throw error;
    throw new Error(formatVaultError(error));
  }
}

export async function withdrawOperationalNative(input: {
  chainId: ChainId;
  fromAddress: string;
  toAddress: string;
  amount: string;
}): Promise<string> {
  const chain = getChain(input.chainId);
  if (!chain.evm) {
    throw new Error("Penarikan dompet Solana belum terhubung ke wallet adapter.");
  }
  if (!input.toAddress.trim()) throw new Error("Isi alamat tujuan penarikan.");
  const amountWei = parseEther(input.amount.trim());
  if (amountWei <= 0n) throw new Error("Nominal harus lebih dari 0.");

  await switchWalletChain(input.chainId);
  const accounts = await requestAccounts();
  const from = accounts[0];
  if (!from) throw new Error("Tidak ada akun MetaMask yang terhubung.");
  if (from.toLowerCase() !== input.fromAddress.toLowerCase()) {
    throw new Error(
      `Hubungkan MetaMask ke dompet operasional ${input.fromAddress.slice(0, 6)}…${input.fromAddress.slice(-4)}.`
    );
  }

  const result = await injected().request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: input.toAddress.trim(),
        value: `0x${amountWei.toString(16)}`,
      },
    ],
  });
  if (!isTxHash(result)) {
    throw new Error("Wallet tidak mengembalikan transaction hash yang valid.");
  }
  return result;
}
