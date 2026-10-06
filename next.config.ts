import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Wrapper desktop/mobile (src-tauri, capacitor.config.json) menjalankan server
  // Node ini, lalu membuka http://127.0.0.1:4100. `output: "export"` tidak dipakai:
  // Route Handler membaca request, cookie sesi, redirects, dan proxy membutuhkan server.
  output: "standalone",
  serverExternalPackages: ["pino", "pino-pretty", "lokijs", "encoding"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/trustwallet/assets/**",
      },
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
        pathname: "/coins/images/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/community", destination: "/roadmap", permanent: false },
      { source: "/community/:path*", destination: "/roadmap", permanent: false },
      { source: "/developer", destination: "/airdrop", permanent: false },
      { source: "/developer/:path*", destination: "/airdrop", permanent: false },
      { source: "/exchanges", destination: "/swap", permanent: false },
      { source: "/exchanges/:path*", destination: "/swap/:path*", permanent: false },
      { source: "/dexscan", destination: "/staking", permanent: false },
      { source: "/dexscan/:path*", destination: "/staking", permanent: false },
    ];
  },
};

export default nextConfig;
