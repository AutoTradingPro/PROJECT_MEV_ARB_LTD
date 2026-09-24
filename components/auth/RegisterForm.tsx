"use client";

import { useMemo, useState, type FormEvent } from "react";
import { LoaderCircle, UserPlus } from "lucide-react";
import GoogleIcon from "@/components/auth/GoogleIcon";
import { useAuth } from "@/context/AuthContext";

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export default function RegisterForm() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const allStrong = Object.values(checks).every(Boolean);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({ username, email, password, confirmPassword });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pendaftaran gagal.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    window.alert("OAuth Google akan diintegrasikan pada rilis berikutnya.");
  };

  return (
    <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      <label className="block space-y-1.5">
        <span className="text-xs text-slate-400 font-medium">Username</span>
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="trader_pro"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400/50 transition-colors"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs text-slate-400 font-medium">Email</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@domain.com"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400/50 transition-colors"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs text-slate-400 font-medium">Password</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400/50 transition-colors"
        />
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol (min. 8 karakter).
        </p>
        {password.length > 0 && (
          <ul className="grid grid-cols-2 gap-1 text-[10px] font-mono">
            {(
              [
                ["length", "≥ 8 karakter"],
                ["lower", "Huruf kecil"],
                ["upper", "Huruf besar"],
                ["digit", "Angka"],
                ["symbol", "Simbol"],
              ] as const
            ).map(([key, label]) => (
              <li key={key} className={checks[key] ? "text-emerald-400" : "text-slate-600"}>
                {checks[key] ? "✓" : "○"} {label}
              </li>
            ))}
          </ul>
        )}
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs text-slate-400 font-medium">Password Confirmation</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400/50 transition-colors"
        />
        {confirmPassword.length > 0 && confirmPassword !== password && (
          <p className="text-[10px] text-red-400">Password tidak cocok.</p>
        )}
      </label>

      {error ? (
        <p className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || !allStrong}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-300 transition-all cursor-pointer disabled:opacity-50"
      >
        {loading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        {loading ? "Membuat akun…" : "Create Account"}
      </button>

      <div className="relative flex items-center gap-3 py-1">
        <span className="flex-1 h-px bg-slate-800" />
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">atau</span>
        <span className="flex-1 h-px bg-slate-800" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        className="w-full py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2.5 hover:bg-slate-900 hover:border-slate-600 transition-all cursor-pointer"
      >
        <GoogleIcon />
        Create Account with Google
      </button>
    </form>
  );
}
