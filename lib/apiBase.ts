/** Backend MEV Core Engine (Tauri + proxy). */
export const CORE_API_ORIGIN = "http://127.0.0.1:4100";

/**
 * URL fetch klien.
 * Port 3000 (dashboard owner) tetap same-origin.
 * Selain itu selalu ke Core Engine :4100 supaya Tauri tidak kena CORS / 404 HTML.
 */
export function apiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    const { protocol, hostname, port, origin } = window.location;
    if (protocol === "http:" || protocol === "https:") {
      const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
      if (local && (port === "3000" || port === "4100")) {
        return `${origin}${suffix}`;
      }
      if (!local) {
        return `${origin}${suffix}`;
      }
    }
  }
  return `${CORE_API_ORIGIN}${suffix}`;
}
