const SESSION_SECRET = process.env.AUTH_SESSION_SECRET || "mev-core-user-register-session";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = "mev_core_session";

type SessionPayload = { id: string; username: string; exp: number };

function encodeB64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeB64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return encodeB64Url(new Uint8Array(sig));
}

export async function signSessionToken(input: { id: string; username: string }): Promise<string> {
  const payload: SessionPayload = {
    id: input.id,
    username: input.username,
    exp: Date.now() + TTL_MS,
  };
  const body = encodeB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

export async function readSessionToken(
  token: string | undefined | null
): Promise<{ id: string; username: string } | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(body);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeB64Url(body))) as SessionPayload;
    if (!payload.id || !payload.username || typeof payload.exp !== "number" || payload.exp < Date.now()) {
      return null;
    }
    return { id: payload.id, username: payload.username };
  } catch {
    return null;
  }
}
