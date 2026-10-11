import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MEV Core Engine",
  applicationName: "MEV Core Engine",
  description: "Aplikasi mandiri MEV Core Engine.",
  robots: { index: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MEV Core",
    statusBarStyle: "black-translucent",
  },
};

export default function EngineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
