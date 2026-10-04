"use client";

import { useState } from "react";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";
import MevCoreEngineDashboard from "@/components/mev-core/MevCoreEngineDashboard";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { BotModeProvider } from "@/context/BotModeContext";

function EngineApp() {
  const { user, logout, authTab, setAuthTab } = useAuth();
  const [tab, setTab] = useState<"login" | "register">(authTab);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
        <section className="w-full max-w-md rounded-2xl border border-cyan-400/25 bg-slate-950/80 p-5 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
          <h1 className="text-2xl font-black tracking-[0.12em] text-cyan-300">MEV CORE ENGINE</h1>
          <p className="mt-2 text-sm text-slate-400">
            Aplikasi mandiri. Login dan register memakai akun yang sama dengan webapp utama.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setTab("login");
                setAuthTab("login");
              }}
              className={`rounded-xl px-3 py-2 text-sm font-bold ${tab === "login" ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400"}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("register");
                setAuthTab("register");
              }}
              className={`rounded-xl px-3 py-2 text-sm font-bold ${tab === "register" ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400"}`}
            >
              Register
            </button>
          </div>
          <div className="mt-4">{tab === "login" ? <LoginForm /> : <RegisterForm />}</div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-3 text-slate-100 sm:px-5">
      <MevCoreEngineDashboard username={user.username} onLogout={logout} />
    </main>
  );
}

export default function EnginePage() {
  return (
    <AuthProvider>
      <BotModeProvider>
        <EngineApp />
      </BotModeProvider>
    </AuthProvider>
  );
}
