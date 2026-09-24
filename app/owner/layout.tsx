import type { Metadata } from "next";
import OwnerShell from "@/components/owner/OwnerShell";

export const metadata: Metadata = {
  title: "Dashboard Owner · MEV ARB",
  description: "Konsol owner untuk manajemen user, tier, dan saldo registrasi",
};

/**
 * Shell terisolasi dari portal dApp (tanpa AppShell header).
 * Nantinya dapat di-mapping ke subdomain owner melalui middleware / rewrite.
 */
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <OwnerShell>{children}</OwnerShell>;
}
