/**
 * Shared bind FlashLoan Provider → Overview RPC/WSS.
 * `armed: true` = provider FlashLoan sedang ON → Overview ikut jaringan ini.
 * Tanpa key / armed false = semua provider OFF → Overview harus OFF total.
 */

import {
  isOwnerNodeChainId,
  type OwnerNodeChainId,
} from "@/lib/owner/ownerNodeChains";
import type { FlashLoanProviderId } from "@/lib/bot/types";

export const FLASHLOAN_RPC_BIND_KEY = "mev-arb-flashloan-rpc-bind";
export const FLASHLOAN_RPC_BIND_EVENT = "mev-arb-flashloan-rpc-bind-change";

export type FlashLoanRpcBind = {
  armed: boolean;
  chainId: OwnerNodeChainId;
  providerId: FlashLoanProviderId | string;
  updatedAt: number;
};

export function readFlashLoanRpcBind(): FlashLoanRpcBind | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FLASHLOAN_RPC_BIND_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FlashLoanRpcBind>;
    // Harus armed eksplisit — bind lama tanpa armed dianggap mati.
    if (parsed.armed !== true) return null;
    if (!isOwnerNodeChainId(parsed.chainId)) return null;
    return {
      armed: true,
      chainId: parsed.chainId,
      providerId: typeof parsed.providerId === "string" ? parsed.providerId : "",
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

/** Hanya panggil saat FlashLoan Provider benar-benar ON. */
export function writeFlashLoanRpcBind(next: {
  chainId: OwnerNodeChainId;
  providerId?: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    const payload: FlashLoanRpcBind = {
      armed: true,
      chainId: next.chainId,
      providerId: next.providerId ?? "",
      updatedAt: Date.now(),
    };
    localStorage.setItem(FLASHLOAN_RPC_BIND_KEY, JSON.stringify(payload));
    window.dispatchEvent(
      new CustomEvent(FLASHLOAN_RPC_BIND_EVENT, { detail: payload })
    );
  } catch {
    /* ignore */
  }
}

/** Panggil saat semua FlashLoan Provider OFF — Overview wajib ikut OFF. */
export function clearFlashLoanRpcBind(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(FLASHLOAN_RPC_BIND_KEY);
    window.dispatchEvent(new CustomEvent(FLASHLOAN_RPC_BIND_EVENT, { detail: null }));
  } catch {
    /* ignore */
  }
}
