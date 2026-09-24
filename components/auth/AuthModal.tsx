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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
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

      <div className="relative w-full max-w-md bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden transform transition-all">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-2">
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold tracking-wide text-white">
              Portal MEV ARB
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Akses aman ke dasbor arbitrase institusional</p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-3 pb-6 space-y-5">
          <AuthModalTabs active={authTab} onChange={setAuthTab} />
          {authTab === "login" ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>
    </div>
  );
}
