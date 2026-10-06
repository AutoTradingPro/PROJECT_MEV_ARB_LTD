"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { useState, type ReactNode } from "react";
import { WagmiProvider, type Config } from "wagmi";
import {
  appKitDefaultNetwork,
  appKitMetadata,
  appKitNetworks,
  appKitProjectId,
  featuredWalletIds,
  wagmiAdapter,
} from "@/config/appkit";

createAppKit({
  adapters: [wagmiAdapter],
  projectId: appKitProjectId,
  networks: appKitNetworks,
  defaultNetwork: appKitDefaultNetwork,
  metadata: appKitMetadata,
  featuredWalletIds,
  customWallets: [
    {
      id: "fd20dc426fb37544d339da47a23dc75c176b2fe9b30a28d1a2d2c6e9ef998267",
      name: "Coinbase Wallet",
      homepage: "https://www.coinbase.com/wallet",
      mobile_link: "cbwallet://",
      desktop_link: "https://wallet.coinbase.com/",
    },
  ],
  allWallets: "SHOW",
  enableWalletGuide: true,
  enableWallets: true,
  enableEIP6963: true,
  enableInjected: true,
  enableCoinbase: false,
  enableBaseAccount: false,
  enableWalletConnect: true,
  enableAuthLogger: false,
  debug: false,
  themeMode: "dark",
  themeVariables: {
    "--apkt-accent": "#fbbf24",
  },
  features: {
    analytics: false,
    email: true,
    emailShowWallets: true,
    socials: ["google", "x", "discord", "github"],
    onramp: false,
    swaps: false,
    history: false,
    connectMethodsOrder: ["wallet", "email", "social"],
  },
});

export default function AppKitProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
