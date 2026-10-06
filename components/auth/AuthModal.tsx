"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import AuthModalTabs from "@/components/auth/AuthModalTabs";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";
import { useAuth } from "@/context/AuthContext";

export default function AuthModal() {
  const { isModalOpen, closeModal, authTab, setAuthTab } = useAuth();

  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isModalOpen, closeModal]);

  if (!isModalOpen) return null;

  return (
    <div
      className="ui-modal-root z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <button
        type="button"
        aria-label="Tutup modal"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer transition-opacity"
        onClick={closeModal}
      />

      <div className="ui-modal-panel relative border border-slate-700/80 bg-slate-900/95 shadow-2xl shadow-black/50 rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-800/80 bg-slate-900/95 px-4 py-3 sm:px-6">
          <div className="min-w-0 pt-1">
            <h2 id="auth-modal-title" className="text-lg font-bold tracking-wide text-white sm:text-xl">
              Portal MEV ARB
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">Akses aman ke dasbor arbitrase institusional</p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Tutup"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-4 py-4 sm:px-6 sm:pb-6">
          <AuthModalTabs active={authTab} onChange={setAuthTab} />
          {authTab === "login" ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>
    </div>
  );
}
