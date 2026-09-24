"use client";

import { usePathname } from "next/navigation";
import { NetworkProvider } from "@/context/NetworkContext";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { SandboxProvider } from "@/context/SandboxContext";
import { BotConfigProvider } from "@/context/BotConfigContext";
import { BotModeProvider } from "@/context/BotModeContext";
import { RpcLiveFeedProvider } from "@/context/RpcLiveFeedContext";
import { LiveHeadProvider } from "@/context/LiveHeadContext";
import { TierProvider } from "@/context/TierContext";
import AppKitProvider from "@/context/AppKitProvider";
import { WalletProvider } from "@/context/WalletContext";
import AuthModal from "@/components/auth/AuthModal";
import LocaleModal from "@/components/settings/LocaleModal";
import UserDashboardModal from "@/components/user-dashboard/UserDashboardModal";
import Header from "@/components/header";
import Footer from "@/components/Footer";
import AppStoreBadges from "@/components/markets/AppStoreBadges";

function hideAppStoreBadges(pathname: string) {
  return pathname === "/mev-arb" || pathname.startsWith("/mev-arb/") || pathname === "/owner" || pathname.startsWith("/owner/");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showStoreBadges = !hideAppStoreBadges(pathname);

  return (
    <NetworkProvider>
      <SettingsProvider>
        <SandboxProvider>
          <AuthProvider>
            <TierProvider>
              <BotModeProvider>
                <BotConfigProvider standbyOnBoot>
                <RpcLiveFeedProvider>
                  <LiveHeadProvider>
                    <AppKitProvider>
                      <WalletProvider>
                        <div className="theme-shell min-h-screen flex flex-col">
                          <Header />
                          <main className="flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-4 py-4">
                            {children}
                            {showStoreBadges ? (
                              <div className="mx-auto w-full max-w-6xl px-4 pb-2 pt-4">
                                <AppStoreBadges />
                              </div>
                            ) : null}
                          </main>
                          <Footer />
                          <AuthModal />
                          <UserDashboardModal />
                          <LocaleModal />
                        </div>
                      </WalletProvider>
                    </AppKitProvider>
                  </LiveHeadProvider>
                </RpcLiveFeedProvider>
                </BotConfigProvider>
              </BotModeProvider>
            </TierProvider>
          </AuthProvider>
        </SandboxProvider>
      </SettingsProvider>
    </NetworkProvider>
  );
}
