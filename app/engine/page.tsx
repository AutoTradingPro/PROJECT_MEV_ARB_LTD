"use client";

import { useState } from "react";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";
import MevCoreEngineDashboard from "@/components/mev-core/MevCoreEngineDashboard";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { BotModeProvider } from "@/context/BotModeContext";

function EngineApp() {
  const { user, logout, authTab, setAuthTab, sessionReady, accessError } = useAuth();
  const [tab, setTab] = useState<"login" | "register">(authTab);

  if (!sessionReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Memeriksa sesi User List Register…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-dvh items-start justify-center overflow-y-auto bg-slate-950 px-3 py-4 text-slate-100 sm:items-center sm:px-4 sm:py-8">
        <section className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-cyan-400/25 bg-slate-950/80 p-4 shadow-[0_0_40px_rgba(16,185,129,0.08)] sm:p-5">
          <h1 className="text-2xl font-black tracking-[0.12em] text-cyan-300">MEV CORE ENGINE</h1>
          <p className="mt-2 text-sm text-slate-400">
            Login hanya untuk akun yang ada di User List Register. Register menulis ke daftar yang sama.
          </p>
          {accessError ? (
            <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {accessError}
            </p>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setTab("login");
                setAuthTab("login");
              }}
              className={`min-h-11 rounded-xl px-3 text-sm font-bold ${tab === "login" ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400"}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("register");
                setAuthTab("register");
              }}
              className={`min-h-11 rounded-xl px-3 text-sm font-bold ${tab === "register" ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400"}`}
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
    <main className="min-h-dvh overflow-x-clip bg-slate-950 px-3 py-3 text-slate-100 sm:px-4 lg:px-5">
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
