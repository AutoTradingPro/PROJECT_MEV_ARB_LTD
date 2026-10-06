"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import CurrencyPanel from "@/components/settings/CurrencyPanel";
import LanguagePanel from "@/components/settings/LanguagePanel";
import { useSettings, type LocaleModalTab } from "@/context/SettingsContext";

export default function LocaleModal() {
  const {
    localeModalOpen,
    localeModalTab,
    setLocaleModalTab,
    closeLocaleModal,
  } = useSettings();

  useEffect(() => {
    if (!localeModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLocaleModal();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [localeModalOpen, closeLocaleModal]);

  if (!localeModalOpen) return null;

  const tabs: { id: LocaleModalTab; label: string }[] = [
    { id: "language", label: "Language" },
    { id: "currency", label: "Currency" },
  ];

  return (
    <div className="ui-modal-root z-[110] items-start overflow-y-auto sm:items-center">
      <button
        type="button"
        aria-label="Tutup"
        className="fixed inset-0 bg-black/40 backdrop-blur-sm cursor-pointer"
        onClick={closeLocaleModal}
      />

      <div className="relative my-2 flex max-h-[min(92dvh,52rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-center gap-8 pt-6 px-6 border-b border-slate-100 relative">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLocaleModalTab(tab.id)}
              className={`pb-3 text-sm font-semibold transition-colors cursor-pointer relative ${
                localeModalTab === tab.id
                  ? "text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab.label}
              {localeModalTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={closeLocaleModal}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {localeModalTab === "language" ? <LanguagePanel /> : <CurrencyPanel />}
        </div>
      </div>
    </div>
  );
}
