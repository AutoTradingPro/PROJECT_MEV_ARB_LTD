"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import VaultGate from "@/components/owner/vault/VaultGate";
import VaultInterior from "@/components/owner/vault/VaultInterior";
import type { AddressBalance } from "@/lib/owner/vaultBalanceTypes";
import type { VaultRegistry } from "@/lib/owner/vaultRegistry";
import type { ChainId } from "@/lib/chain/networks";
import { CHAINS } from "@/lib/chain/networks";

const TOKEN_KEY = "mev.owner.vault.token";
const VAULT_HEADER = "x-vault-session";

function emptyRegistry(): VaultRegistry {
  const blank = Object.fromEntries(CHAINS.map((chain) => [chain.id, ""])) as Record<ChainId, string>;
  return { vaultContracts: { ...blank }, operationalWallets: { ...blank } };
}

export default function VaultPageClient() {
  const [unlocked, setUnlocked] = useState(false);
  const [token, setToken] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [registry, setRegistry] = useState<VaultRegistry>(emptyRegistry);
  const [vaultBalances, setVaultBalances] = useState<AddressBalance[]>([]);
  const [walletBalances, setWalletBalances] = useState<AddressBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headers = useCallback(
    (extra?: HeadersInit): HeadersInit => ({
      ...(extra ?? {}),
      [VAULT_HEADER]: token,
    }),
    [token]
  );

  const lockVault = useCallback(async () => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) || "" : "";
    try {
      await fetch("/api/owner/vault/lock", {
        method: "POST",
        headers: { [VAULT_HEADER]: stored },
      });
    } catch {
      /* lock locally even if the request fails */
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUnlocked(false);
    setExpiresAt(0);
    setRemainingMs(0);
    setVaultBalances([]);
    setWalletBalances([]);
  }, []);

  const refreshBalances = useCallback(async (sessionToken: string) => {
    setLoadingBalances(true);
    try {
      const response = await fetch("/api/owner/vault/balances", {
        headers: { [VAULT_HEADER]: sessionToken },
        cache: "no-store",
      });
      const data = (await response.json()) as {
        balances?: { vaults: AddressBalance[]; wallets: AddressBalance[] };
        expiresAt?: number;
        error?: string;
      };
      if (response.status === 401) {
        await lockVault();
        return;
      }
      if (!response.ok) throw new Error(data.error || "Gagal memuat saldo.");
      if (data.expiresAt) setExpiresAt(data.expiresAt);
      setVaultBalances(data.balances?.vaults ?? []);
      setWalletBalances(data.balances?.wallets ?? []);
    } catch {
      /* keep last known balances */
    } finally {
      setLoadingBalances(false);
    }
  }, [lockVault]);

  const hydrate = useCallback(
    async (sessionToken: string) => {
      const response = await fetch("/api/owner/vault", {
        headers: { [VAULT_HEADER]: sessionToken },
        cache: "no-store",
      });
      const data = (await response.json()) as {
        unlocked?: boolean;
        expiresAt?: number;
        registry?: VaultRegistry;
      };
      if (!data.unlocked || !data.expiresAt) {
        await lockVault();
        return;
      }
      setUnlocked(true);
      setToken(sessionToken);
      setExpiresAt(data.expiresAt);
      if (data.registry) setRegistry(data.registry);
      await refreshBalances(sessionToken);
    },
    [lockVault, refreshBalances]
  );

  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (stored) void hydrate(stored);
  }, [hydrate]);

  useEffect(() => {
    if (!unlocked || !expiresAt) return;
    const tick = () => {
      const left = expiresAt - Date.now();
      setRemainingMs(left);
      if (left <= 0) void lockVault();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [unlocked, expiresAt, lockVault]);

  useEffect(() => {
    if (!unlocked) return;
    const bump = () => {
      if (idleRef.current) clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => {
        void lockVault();
      }, 10 * 60 * 1000);
    };
    bump();
    window.addEventListener("mousemove", bump);
    window.addEventListener("keydown", bump);
    window.addEventListener("click", bump);
    return () => {
      if (idleRef.current) clearTimeout(idleRef.current);
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("click", bump);
    };
  }, [unlocked, lockVault]);

  async function onUnlock(password: string) {
    setUnlocking(true);
    setError(null);
    try {
      const response = await fetch("/api/owner/vault/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as {
        token?: string;
        expiresAt?: number;
        error?: string;
      };
      if (!response.ok || !data.token || !data.expiresAt) {
        throw new Error(data.error || "Gagal membuka brankas.");
      }
      sessionStorage.setItem(TOKEN_KEY, data.token);
      await hydrate(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuka brankas.");
    } finally {
      setUnlocking(false);
    }
  }

  async function onSave(patch: {
    vaultContracts?: Partial<Record<ChainId, string>>;
    operationalWallets?: Partial<Record<ChainId, string>>;
  }) {
    setSaving(true);
    try {
      const response = await fetch("/api/owner/vault", {
        method: "PATCH",
        headers: headers({ "content-type": "application/json" }),
        body: JSON.stringify(patch),
      });
      const data = (await response.json()) as { registry?: VaultRegistry; error?: string; expiresAt?: number };
      if (response.status === 401) {
        await lockVault();
        throw new Error("Sesi brankas kedaluwarsa.");
      }
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan.");
      if (data.expiresAt) setExpiresAt(data.expiresAt);
      if (data.registry) setRegistry(data.registry);
      await refreshBalances(token);
    } finally {
      setSaving(false);
    }
  }

  if (!unlocked) {
    return <VaultGate busy={unlocking} error={error} onUnlock={onUnlock} />;
  }

  return (
    <VaultInterior
      remainingMs={remainingMs}
      registry={registry}
      vaultBalances={vaultBalances}
      walletBalances={walletBalances}
      loadingBalances={loadingBalances}
      saving={saving}
      onLock={() => void lockVault()}
      onRefresh={() => void refreshBalances(token)}
      onSave={onSave}
    />
  );
}
