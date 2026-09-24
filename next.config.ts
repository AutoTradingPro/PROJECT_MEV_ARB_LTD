import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
