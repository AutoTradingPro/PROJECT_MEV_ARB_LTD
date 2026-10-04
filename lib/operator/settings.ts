import { timingSafeEqual } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  OPERATOR_CHAINS,
  type OperatorChain,
  type OperatorPublicSettings,
} from "@/lib/operator/types";

export type { OperatorChain, OperatorPublicSettings };

const ENV_PATH = path.join(process.cwd(), ".env.local");

const CHAIN_ENV: Record<OperatorChain, { rpc: string; key: string }> = {
  ethereum: { rpc: "ETHEREUM_RPC_URL", key: "PRIVATE_KEY_ETHEREUM" },
  arbitrum: { rpc: "ARBITRUM_RPC_URL", key: "PRIVATE_KEY_ARBITRUM" },
  polygon: { rpc: "POLYGON_RPC_URL", key: "PRIVATE_KEY_POLYGON" },
  bsc: { rpc: "BSC_RPC_URL", key: "PRIVATE_KEY_BSC" },
  solana: { rpc: "SOLANA_RPC_URL", key: "PRIVATE_KEY_SOLANA" },
};

const ALLOWED = new Set<string>([
  "MIN_PROFIT_THRESHOLD",
  ...OPERATOR_CHAINS.flatMap((chain) => [CHAIN_ENV[chain].rpc, CHAIN_ENV[chain].key]),
]);

const LABELS: Record<OperatorChain, string> = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
  bsc: "BNB Chain",
  solana: "Solana",
};

function envValue(name: string): string {
  return (process.env[name] || "").trim();
}

function rpcHost(url: string): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return "tersimpan";
  }
}

export function readOperatorPublicSettings(): OperatorPublicSettings {
  return {
    minProfitThreshold: envValue("MIN_PROFIT_THRESHOLD") || "0.0005",
    panelPasswordRequired: Boolean(envValue("PANEL_PASSWORD")),
    chains: OPERATOR_CHAINS.map((id) => {
      const rpc = envValue(CHAIN_ENV[id].rpc);
      return {
        id,
        label: LABELS[id],
        rpcSet: Boolean(rpc),
        rpcHost: rpcHost(rpc),
        keySet: Boolean(envValue(CHAIN_ENV[id].key)),
      };
    }),
  };
}

export function assertPanelPassword(password: string | undefined): void {
  const expected = envValue("PANEL_PASSWORD");
  if (!expected) return;
  const given = password || "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Kata sandi panel salah.");
  }
}

function encodeEnvValue(value: string): string {
  if (/[\s#"']/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

export async function saveOperatorSettings(input: {
  minProfitThreshold?: string;
  chain?: OperatorChain;
  rpcUrl?: string;
  privateKey?: string;
}): Promise<void> {
  const updates: Record<string, string> = {};
  if (input.minProfitThreshold != null && input.minProfitThreshold.trim()) {
    const raw = input.minProfitThreshold.trim();
    if (!/^\d+(\.\d+)?$/.test(raw) || Number(raw) <= 0) {
      throw new Error("MIN_PROFIT_THRESHOLD harus angka ETH lebih dari 0. Contoh: 0.0005");
    }
    updates.MIN_PROFIT_THRESHOLD = raw;
  }
  if (input.chain && (input.rpcUrl?.trim() || input.privateKey?.trim())) {
    const spec = CHAIN_ENV[input.chain];
    if (!spec) throw new Error("Jaringan tidak dikenali.");
    if (input.rpcUrl?.trim()) {
      const rpc = input.rpcUrl.trim();
      if (!/^https?:\/\//i.test(rpc)) throw new Error("RPC endpoint harus diawali http:// atau https://");
      updates[spec.rpc] = rpc;
    }
    if (input.privateKey?.trim()) {
      const key = input.privateKey.trim();
      if (key.includes("\n") || key.length < 32 || key.length > 200) {
        throw new Error("Private key tidak valid. Kosongkan kolom jika tidak ingin mengubahnya.");
      }
      updates[spec.key] = key;
    }
  }
  const keys = Object.keys(updates);
  if (keys.length === 0) throw new Error("Tidak ada pengaturan yang diubah.");
  if (keys.some((key) => !ALLOWED.has(key))) throw new Error("Kolom pengaturan tidak diizinkan.");

  let raw = "";
  try {
    raw = await readFile(ENV_PATH, "utf8");
  } catch {
    raw = "";
  }
  const lines = raw.length ? raw.split(/\r?\n/) : [];
  const seen = new Set<string>();
  const next = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || !Object.prototype.hasOwnProperty.call(updates, match[1])) return line;
    seen.add(match[1]);
    return `${match[1]}=${encodeEnvValue(updates[match[1]])}`;
  });
  for (const key of keys) {
    if (!seen.has(key)) next.push(`${key}=${encodeEnvValue(updates[key])}`);
    process.env[key] = updates[key];
  }
  const body = next.filter((line, index) => line !== "" || index < next.length - 1).join("\n");
  await writeFile(ENV_PATH, body.endsWith("\n") ? body : `${body}\n`, "utf8");
}
