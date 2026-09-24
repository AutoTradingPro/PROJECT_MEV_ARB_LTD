/** Sembunyikan API key di path/query sebelum URL dikirim ke browser. */

export function redactSensitiveUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/\/[A-Za-z0-9_-]{16,}/g, "/***");
    return parsed.toString();
  } catch {
    return "****";
  }
}

export function isRedactedUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return trimmed.includes("***") || trimmed === "****";
}

export function keepIfRedacted(incoming: string | undefined, previous: string): string {
  if (incoming === undefined) return previous;
  const trimmed = incoming.trim();
  if (isRedactedUrl(trimmed)) return previous;
  return trimmed;
}
