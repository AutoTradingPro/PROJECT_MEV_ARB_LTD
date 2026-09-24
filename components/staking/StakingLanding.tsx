"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  Lock,
  Search,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { stakingItemHref } from "@/lib/navigation/stakingMenu";
import {
  NATIVE_STAKING_ID,
  STAKING_PRODUCTS,
  STAKING_VISIBLE_COUNT,
  type StakingProduct,
} from "@/lib/staking/products";

type StakingTab = "langganan" | "lock" | "staking";

const TABS: { id: StakingTab; label: string; icon: typeof Coins }[] = [
  { id: "langganan", label: "Langganan", icon: Bell },
  { id: "lock", label: "Lock", icon: Lock },
  { id: "staking", label: "Staking", icon: Coins },
];

function formatApr(value: number): string {
  return `${value.toFixed(2)}%`;
}

function StakingHeroArt() {
  return (
    <div className="relative mx-auto h-40 w-full max-w-sm sm:h-48 lg:mx-0 lg:h-52 lg:max-w-none">
      <div className="absolute right-6 top-4 h-24 w-24 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute bottom-2 left-10 h-20 w-20 rounded-full bg-amber-400/15 blur-3xl" />
      <svg viewBox="0 0 360 200" className="relative h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="stake-cube" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(52,211,153,0.35)" />
            <stop offset="55%" stopColor="rgba(16,185,129,0.12)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.05)" />
          </linearGradient>
        </defs>
        <path
          d="M210 38 L292 78 L292 148 L210 188 L128 148 L128 78 Z"
          fill="url(#stake-cube)"
          stroke="rgba(52,211,153,0.45)"
          strokeWidth="1.4"
        />
        <path d="M210 38 L292 78 L210 118 L128 78 Z" fill="rgba(52,211,153,0.16)" />
        <path d="M210 118 L292 78 L292 148 L210 188 Z" fill="rgba(16,185,129,0.10)" />
        <rect x="198" y="92" width="24" height="24" rx="6" fill="rgba(16,185,129,0.85)" />
        <circle cx="92" cy="64" r="16" fill="rgba(52,211,153,0.18)" stroke="rgba(52,211,153,0.5)" />
        <circle cx="318" cy="86" r="14" fill="rgba(251,191,36,0.16)" stroke="rgba(251,191,36,0.4)" />
        <circle cx="304" cy="148" r="12" fill="rgba(52,211,153,0.16)" stroke="rgba(52,211,153,0.45)" />
        <path d="M108 64 H128" stroke="rgba(52,211,153,0.35)" strokeDasharray="3 4" />
        <path d="M292 86 H304" stroke="rgba(52,211,153,0.35)" strokeDasharray="3 4" />
        <text x="86" y="69" fill="rgba(167,243,208,0.95)" fontSize="14" fontWeight="700">
          +
        </text>
        <text x="298" y="92" fill="rgba(167,243,208,0.95)" fontSize="13" fontWeight="700">
          +
        </text>
        <text x="204" y="109" fill="#022c22" fontSize="16" fontWeight="800">
          +
        </text>
      </svg>
    </div>
  );
}

function ProductRow({
  product,
  duration,
  onDuration,
  onSubscribe,
}: {
  product: StakingProduct;
  duration: number;
  onDuration: (days: number) => void;
  onSubscribe: () => void;
}) {
  const native = product.id === NATIVE_STAKING_ID;

  return (
    <article
      className={`group grid grid-cols-1 items-center gap-4 rounded-2xl px-4 py-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 sm:px-5 lg:grid-cols-[minmax(0,1.2fr)_0.7fr_minmax(0,1.35fr)_9.5rem] ${
        native
          ? "border border-amber-400/45 bg-[linear-gradient(90deg,rgba(245,196,0,0.12),color-mix(in_srgb,var(--surface-elevated)_78%,transparent)_42%)] shadow-[0_0_0_1px_rgba(245,196,0,0.12),0_12px_36px_rgba(245,196,0,0.08)] hover:border-amber-300/70 hover:shadow-[0_14px_40px_rgba(245,196,0,0.16)]"
          : "border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-elevated)_82%,transparent)] shadow-[0_0_0_1px_rgba(255,255,255,0.02)] hover:border-emerald-400/35 hover:shadow-[0_12px_40px_rgba(16,185,129,0.12)]"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ${
            native ? "border border-amber-400/70 bg-black shadow-[0_0_16px_rgba(245,196,0,0.35)]" : "border border-[var(--border)] bg-[var(--surface)]"
          }`}
        >
          <img
            src={product.icon}
            alt={`${product.symbol} logo`}
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover"
          />
        </span>
        <div className="min-w-0">
          <p className={`text-sm font-bold tracking-tight ${native ? "text-[#F5C400]" : "text-[var(--app-fg)]"}`}>
            {product.symbol}
            {native ? (
              <span className="ml-2 align-middle rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-200">
                Native
              </span>
            ) : null}
          </p>
          <p className="truncate text-[11px] text-[var(--muted)]">{product.name}</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Est. APR</p>
        <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-emerald-400">{formatApr(product.aprPct)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {product.durations.map((days) => {
          const active = duration === days;
          return (
            <button
              key={days}
              type="button"
              onClick={() => onDuration(days)}
              className={`relative min-w-12 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold tabular-nums transition-all ${
                active
                  ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-300"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-emerald-400/30 hover:text-[var(--app-fg)]"
              }`}
            >
              {days}
              {active ? (
                <span className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-emerald-400 text-emerald-950">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
        <span className="text-[10px] text-[var(--muted)]">hari</span>
      </div>

      <button
        type="button"
        onClick={onSubscribe}
        className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 text-sm font-bold text-emerald-950 shadow-[0_8px_24px_rgba(16,185,129,0.28)] transition-all hover:from-emerald-400 hover:to-teal-300 hover:shadow-[0_10px_28px_rgba(16,185,129,0.4)] lg:w-[9.5rem]"
      >
        Langganan
      </button>
    </article>
  );
}

export default function StakingLanding() {
  const { user, openModal } = useAuth();
  const [tab, setTab] = useState<StakingTab>("staking");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>(() =>
    Object.fromEntries(STAKING_PRODUCTS.map((item) => [item.id, item.defaultDuration]))
  );
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = STAKING_PRODUCTS.filter((item) => {
      if (!q) return true;
      return item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
    });
    const native = list.filter((item) => item.id === NATIVE_STAKING_ID);
    const rest = list.filter((item) => item.id !== NATIVE_STAKING_ID);
    const sortedRest =
      tab === "lock"
        ? [...rest].sort((a, b) => Math.max(...b.durations) - Math.max(...a.durations))
        : tab === "langganan"
          ? [...rest].sort((a, b) => b.aprPct - a.aprPct)
          : rest;
    return [...native, ...sortedRest];
  }, [query, tab]);

  const visible = expanded ? filtered : filtered.slice(0, STAKING_VISIBLE_COUNT);

  const subscribe = (product: StakingProduct) => {
    const days = durations[product.id] ?? product.defaultDuration;
    if (!user) {
      openModal("register");
      setNotice(`Masuk untuk berlangganan ${product.symbol} · lock ${days} hari · APR ${formatApr(product.aprPct)}.`);
      return;
    }
    setNotice(`Paket ${product.symbol} · ${days} hari · ${formatApr(product.aprPct)} APR siap dikunci ke plan Anda.`);
  };

  return (
    <div className="relative w-full">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 8% 0%, rgba(16,185,129,0.14), transparent 55%), radial-gradient(ellipse 50% 35% at 92% 8%, rgba(251,191,36,0.10), transparent 50%)",
        }}
      />

      <section className="relative mx-auto grid w-full max-w-6xl gap-6 px-4 pb-4 pt-4 sm:pt-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-[var(--app-fg)] sm:text-5xl">Staking</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            Banyak Pilihan, Lebih Nyaman. Dapatkan keuntungan stabil dengan menyetorkan aset.
          </p>
          <div className="mt-5 inline-flex flex-wrap gap-1 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] p-1 backdrop-blur-xl">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all sm:text-sm ${
                    active
                      ? "bg-emerald-500/15 text-emerald-300 shadow-[inset_0_-2px_0_rgba(52,211,153,0.85)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--app-fg)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        <StakingHeroArt />
      </section>

      <section className="relative mx-auto w-full max-w-6xl px-4 pb-14">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[var(--app-fg)] sm:text-2xl">
              Produk yang Dilindungi
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Dapatkan keuntungan stabil dengan menyetorkan aset
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="relative min-w-0 flex-1 sm:min-w-[200px] sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari Koin..."
                className="theme-input w-full rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-400/50"
              />
            </label>
            <Link
              href={stakingItemHref("history")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
            >
              Riwayat
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={stakingItemHref("stake")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
            >
              Plan Saya
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {notice ? (
          <p className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">
            {notice}
          </p>
        ) : null}

        <div className="mt-5 hidden grid-cols-[minmax(0,1.2fr)_0.7fr_minmax(0,1.35fr)_9.5rem] px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] lg:grid">
          <span>Koin</span>
          <span>APR</span>
          <span>Durasi Berlangganan (Hari)</span>
          <span className="text-right">Aksi</span>
        </div>

        <div className="mt-2 space-y-2.5">
          {visible.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              duration={durations[product.id] ?? product.defaultDuration}
              onDuration={(days) => setDurations((prev) => ({ ...prev, [product.id]: days }))}
              onSubscribe={() => subscribe(product)}
            />
          ))}
          {visible.length === 0 ? (
            <p className="rounded-2xl border border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              Tidak ada koin yang cocok dengan pencarian.
            </p>
          ) : null}
        </div>

        {filtered.length > STAKING_VISIBLE_COUNT ? (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
            >
              {expanded
                ? "Sembunyikan daftar tambahan"
                : `Perluas semua produk Staking (${STAKING_PRODUCTS.length}+)`}
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
