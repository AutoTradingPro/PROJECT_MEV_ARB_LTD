export type MegaMenuSection =
  | "markets"
  | "dashboards"
  | "staking"
  | "swap"
  | "roadmap"
  | "airdrop";

export type MainNavId = MegaMenuSection | "mev-arb" | "more";

export interface MainNavItem {
  id: MainNavId;
  label: string;
  href?: string;
  megaMenu?: "grid" | "list";
}

/** Urutan menu datar — tanpa mega menu */
export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { id: "markets", label: "Home", href: "/markets" },
  { id: "dashboards", label: "Product", href: "/dashboards" },
  { id: "mev-arb", label: "Mev Arb", href: "/mev-arb" },
  { id: "staking", label: "Staking", href: "/staking" },
  { id: "swap", label: "Swap", href: "/swap" },
  { id: "roadmap", label: "RoadMap", href: "/roadmap" },
  { id: "airdrop", label: "AirDrop", href: "/airdrop" },
  { id: "more", label: "Pricing", href: "/more" },
];

export const MEGA_MENU_SECTIONS: MegaMenuSection[] = [
  "markets",
  "dashboards",
  "staking",
  "swap",
  "roadmap",
  "airdrop",
];

export const MEGA_ITEM_COUNT = 13;
export const MORE_ITEM_COUNT = 7;

export function isMegaMenuSection(value: string): value is MegaMenuSection {
  return (MEGA_MENU_SECTIONS as string[]).includes(value);
}

export function sectionLabel(section: MegaMenuSection): string {
  const item = MAIN_NAV_ITEMS.find((nav) => nav.id === section);
  return item?.label ?? section;
}

/** Route halaman indeks menu (placeholder) */
export function sectionHref(id: MainNavId): string {
  if (id === "mev-arb") return "/mev-arb";
  if (id === "more") return "/more";
  return `/${id}`;
}

export function megaItemHref(section: MegaMenuSection, item: number): string {
  return `/${section}/${item}`;
}

export function moreItemHref(item: number): string {
  return `/more/${item}`;
}

export function megaMenuRows(): number[][] {
  return [
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10],
    [11, 12, 13],
  ];
}

export function developingMessage(menuLabel: string, subLabel?: string): string {
  if (subLabel) {
    return `Halaman ${menuLabel} · ${subLabel} sedang dalam pengembangan.`;
  }
  return `Halaman ${menuLabel} sedang dalam pengembangan.`;
}

export function resolveActiveNavId(pathname: string): MainNavId | null {
  if (pathname === "/" || pathname === "/markets" || pathname.startsWith("/markets/")) {
    return "markets";
  }
  if (pathname.startsWith("/mev-arb")) return "mev-arb";
  if (pathname === "/more" || pathname.startsWith("/more/")) return "more";
  const parts = pathname.split("/").filter(Boolean);
  const section = parts[0];
  if (section && isMegaMenuSection(section)) return section;
  return null;
}

export function isDashboardRoute(pathname: string): boolean {
  return pathname.startsWith("/mev-arb");
}
