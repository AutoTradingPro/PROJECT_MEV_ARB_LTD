import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

const engineMetadata: Metadata = {
  title: "MEV Core Engine",
  applicationName: "MEV Core Engine",
  description: "Aplikasi mandiri MEV Core Engine. Pasang dari http://127.0.0.1:4100/.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MEV Core",
    statusBarStyle: "black-translucent",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-mev-core-app") !== "4100") {
    return { title: "404", robots: { index: false } };
  }
  return engineMetadata;
}

export default async function EngineLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-mev-core-app") !== "4100") notFound();
  return children;
}
