"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import OwnerBrandLogo from "@/components/owner/OwnerBrandLogo";
import OwnerSidebar from "@/components/owner/OwnerSidebar";
import { BotConfigProvider } from "@/context/BotConfigContext";
import { NetworkProvider } from "@/context/NetworkContext";
import { RpcLiveFeedProvider } from "@/context/RpcLiveFeedContext";

export default function OwnerShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <NetworkProvider>
      <BotConfigProvider>
        <RpcLiveFeedProvider>
          <div className="theme-shell min-h-screen flex bg-slate-950 text-slate-100" data-theme="dark">
            <OwnerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur print:hidden md:hidden">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-800 text-slate-300"
                  aria-label="Buka menu"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <OwnerBrandLogo />
                <span className="min-w-0 truncate text-sm font-bold tracking-wide text-amber-400">
                  Owner Console
                </span>
              </header>
              <main className="flex-1 min-w-0 p-4 sm:p-6">{children}</main>
            </div>
          </div>
        </RpcLiveFeedProvider>
      </BotConfigProvider>
    </NetworkProvider>
  );
}
