"use client";

import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
}

export default function PasswordField({
  name,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  placeholder = "••••••••",
}: PasswordFieldProps) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        name={name}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="ui-field w-full bg-slate-950 border border-slate-800 rounded-xl px-4 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-amber-400/50 transition-colors"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 cursor-pointer"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
