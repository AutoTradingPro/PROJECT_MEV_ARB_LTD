export interface OwnerNavItem {
  id: string;
  label: string;
  href: string;
}

/** Route dasar Dashboard Owner — siap di-mapping ke subdomain (owner.*) */
export const OWNER_BASE_PATH = "/owner";

export const OWNER_NAV_ITEMS: OwnerNavItem[] = [
  { id: "users", label: "User List", href: "/owner/users" },
  { id: "overview", label: "Overview", href: "/owner/overview" },
  { id: "finance", label: "Laporan Keuangan", href: "/owner/finance" },
  { id: "vault", label: "Brankas", href: "/owner/vault" },
  { id: "settings", label: "Pengaturan", href: "/owner/settings" },
];

export const OWNER_DEFAULT_HREF = "/owner/users";
