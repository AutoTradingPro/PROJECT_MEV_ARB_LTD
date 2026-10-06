"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, LogIn } from "lucide-react";
import PasswordField from "@/components/auth/PasswordField";
import { useAuth } from "@/context/AuthContext";

export default function LoginForm() {
  const { login, setAuthTab } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ identifier, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      <label className="block space-y-1.5">
        <span className="text-xs text-slate-400 font-medium">Username / Email</span>
        <input
          type="text"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="username, email, atau wallet"
          className="ui-field w-full bg-slate-950 border border-slate-800 rounded-xl px-4 text-white placeholder-slate-600 focus:outline-none focus:border-amber-400/50 transition-colors"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs text-slate-400 font-medium">Password</span>
        <PasswordField
          name="password"
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggle={() => setShowPassword((current) => !current)}
          autoComplete="current-password"
        />
      </label>

      {error ? (
        <p className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 text-sm font-bold text-slate-950 hover:from-amber-300 hover:to-yellow-200 transition-all cursor-pointer disabled:opacity-60"
      >
        {loading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        {loading ? "Memproses…" : "Login"}
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setAuthTab("register")}
          className="inline-flex min-h-11 items-center text-sm text-amber-400/90 hover:text-amber-300 transition-colors cursor-pointer"
        >
          Belum punya akun? <span className="font-bold underline underline-offset-2">Daftar</span>
        </button>
      </div>

      <button
        type="button"
        className="block mx-auto text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        onClick={() => window.alert("Fitur reset password akan segera tersedia.")}
      >
        Lupa Sandi?
      </button>
    </form>
  );
}
