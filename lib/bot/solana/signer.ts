/**
 * Signer Solana (server-only) — private key dari .env.local.
 * Jangan expose ke client / NEXT_PUBLIC_*.
 *
 * Env canonical: PRIVATE_KEY_SOLANA
 * (alias legacy dibaca hanya jika canonical kosong: EXECUTOR_PRIVATE_KEY_SOLANA)
 *
 * Format yang didukung:
 *   - base58 secret key (Phantom / Solflare export, 64 byte)
 *   - JSON array angka `[1,2,...]` (solana-keygen / id.json)
 *   - hex 64 atau 128 nibble (32-byte seed atau 64-byte secret)
 */
import { createPrivateKey, createPublicKey } from "node:crypto";

const ENV_KEYS = [
  "PRIVATE_KEY_SOLANA",
  "EXECUTOR_PRIVATE_KEY_SOLANA",
] as const;

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function firstEnvNamed(keys: readonly string[]): { value: string; source: string } {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return { value, source: key };
  }
  return { value: "", source: "" };
}

function decodeBase58(input: string): Uint8Array {
  const bytes: number[] = [0];
  for (const char of input) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value < 0) throw new Error("karakter base58 tidak valid");
    let carry = value;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of input) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

function encodeBase58(bytes: Uint8Array): string {
  if (!bytes.length) return "";
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let leading = 0;
  while (leading < bytes.length && bytes[leading] === 0) leading += 1;
  return "1".repeat(leading) + digits.reverse().map((d) => BASE58_ALPHABET[d]).join("");
}

function parseSecretKeyBytes(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("private key kosong");

  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(arr) || !arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      throw new Error("JSON secret key tidak valid");
    }
    return Uint8Array.from(arr);
  }

  if (/^(0x)?[0-9a-fA-F]+$/.test(trimmed)) {
    const hex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
    if (hex.length !== 64 && hex.length !== 128) {
      throw new Error("hex secret key harus 32 atau 64 byte");
    }
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }

  return decodeBase58(trimmed);
}

/** 32-byte ed25519 seed dari secret key Solana (32 seed atau 64 seed+pubkey). */
function seedFromSecretKey(secret: Uint8Array): Buffer {
  if (secret.length === 64) return Buffer.from(secret.subarray(0, 32));
  if (secret.length === 32) return Buffer.from(secret);
  throw new Error(`panjang secret key ${secret.length} tidak didukung (harus 32 atau 64 byte)`);
}

function publicKeyFromSeed(seed: Buffer): Uint8Array {
  // PKCS#8 DER wrapper untuk raw Ed25519 seed (RFC 8410).
  const pkcs8 = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    seed,
  ]);
  const privateKey = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
  const spki = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  // SPKI Ed25519: 12-byte header + 32-byte raw public key.
  return new Uint8Array(spki.subarray(spki.length - 32));
}

export function solanaPrivateKeyEnvOrder(): string[] {
  return [...ENV_KEYS];
}

export function readSolanaPrivateKeyRaw(): { value: string; source: string } {
  return firstEnvNamed(ENV_KEYS);
}

export type SolanaSignerStatus = {
  ready: boolean;
  address?: string;
  source?: string;
};

/**
 * Status signer Solana dari env. Siap bila kunci valid dan pubkey bisa diturunkan.
 */
export function solanaAutonomousSignerStatus(): SolanaSignerStatus {
  const { value, source } = readSolanaPrivateKeyRaw();
  if (!value) return { ready: false, source };
  try {
    const secret = parseSecretKeyBytes(value);
    const seed = seedFromSecretKey(secret);
    const pubkey = publicKeyFromSeed(seed);
    const address = encodeBase58(pubkey);
    return { ready: true, address, source };
  } catch (error) {
    console.warn(
      `[SOLANA-SIGNER] gagal parse ${source || "PRIVATE_KEY_SOLANA"}: ${
        error instanceof Error ? error.message : "unknown"
      }`
    );
    return { ready: false, source };
  }
}

export function formatSolanaSignerLine(): string {
  const status = solanaAutonomousSignerStatus();
  if (!status.ready || !status.address) {
    return `[SIGNER] chain=solana · belum siap · isi ${ENV_KEYS.join(" / ")} di .env.local`;
  }
  return `[SIGNER] chain=solana · env=${status.source} · wallet=${status.address}`;
}

export function logSolanaSigner(): void {
  console.log(formatSolanaSignerLine());
}

/** Secret key 64-byte (seed||pubkey) untuk signing — null bila belum diisi/invalid. */
export function loadSolanaSecretKey(): Uint8Array | null {
  const { value } = readSolanaPrivateKeyRaw();
  if (!value) return null;
  try {
    const secret = parseSecretKeyBytes(value);
    if (secret.length === 64) return secret;
    if (secret.length === 32) {
      const seed = Buffer.from(secret);
      const pubkey = publicKeyFromSeed(seed);
      const out = new Uint8Array(64);
      out.set(seed, 0);
      out.set(pubkey, 32);
      return out;
    }
    return null;
  } catch {
    return null;
  }
}
