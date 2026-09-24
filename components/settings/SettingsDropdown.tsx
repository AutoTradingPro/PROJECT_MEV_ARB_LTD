"use client";

import { ChevronRight, LayoutDashboard } from "lucide-react";
import NetworkDropdown from "@/components/NetworkDropdown";
import NetworkModeToggle from "@/components/settings/NetworkModeToggle";
import ThemeSegment from "@/components/settings/ThemeSegment";
import { CurrencyIcon } from "@/components/settings/CurrencyIcon";
import { useAuth } from "@/context/AuthContext";
import { useNetwork } from "@/context/NetworkContext";
import { useSandbox } from "@/context/SandboxContext";
import { useSettings } from "@/context/SettingsContext";
import { getCurrency } from "@/lib/settings/currencies";

interface SettingsDropdownProps {
  onClose: () => void;
}

export default function SettingsDropdown({ onClose }: SettingsDropdownProps) {
  const { languageLabel, currency, currencyLabel, openLocaleModal } = useSettings();
  const { isSandbox, resetSandbox } = useSandbox();
  const { user, openDashboard } = useAuth();
  const { chainId, setChainId } = useNetwork();
  const currencyData = getCurrency(currency);

  return (
    <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-black/10 py-2 z-[70] text-slate-900">
      <NetworkModeToggle />
      <div className="px-4 pb-3">
        <p className="mb-1.5 text-[11px] font-semibold text-slate-400">Jaringan trading</p>
        <NetworkDropdown chainId={chainId} onChange={setChainId} variant="settings" />
      </div>
      {user ? (
        <button
          type="button"
          onClick={() => {
            openDashboard();
            onClose();
          }}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer border-t border-slate-100"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <LayoutDashboard className="w-4 h-4 text-amber-500" />
            User Dashboard
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      ) : null}
      {isSandbox && (
        <button
          type="button"
          onClick={() => {
            resetSandbox();
            onClose();
          }}
          className="w-full text-left px-4 pb-3 text-[11px] font-semibold text-cyan-700 hover:text-cyan-900 cursor-pointer"
        >
          Reset Sandbox State
        </button>
      )}
      <div className="border-t border-slate-100" />
      <button
        type="button"
        onClick={() => {
          openLocaleModal("language");
          onClose();
        }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <span className="text-sm font-medium text-slate-700">Language</span>
        <span className="flex items-center gap-1 text-sm text-slate-500">
          {languageLabel}
          <ChevronRight className="w-4 h-4" />
        </span>
      </button>

      <button
        type="button"
        onClick={() => {
          openLocaleModal("currency");
          onClose();
        }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer border-t border-slate-100"
      >
        <span className="text-sm font-medium text-slate-700">Currency</span>
        <span className="flex items-center gap-2 text-sm text-slate-500">
          {currencyData ? <CurrencyIcon currency={currencyData} /> : null}
          {currencyLabel}
          <ChevronRight className="w-4 h-4" />
        </span>
      </button>

      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
        <span className="text-sm font-medium text-slate-700">Theme</span>
        <ThemeSegment />
      </div>
    </div>
  );
}
