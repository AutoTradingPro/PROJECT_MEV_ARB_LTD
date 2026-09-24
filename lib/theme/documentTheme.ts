export type DocumentTheme = "light" | "dark";

export const THEME_COOKIE_NAME = "mev-arb-theme";
export const THEME_STORAGE_KEY = "mev-arb-theme";

export function parseDocumentTheme(value: string | undefined | null): DocumentTheme {
  return value === "light" || value === "dark" ? value : "dark";
}

export function persistDocumentTheme(theme: DocumentTheme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  document.cookie = `${THEME_COOKIE_NAME}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
