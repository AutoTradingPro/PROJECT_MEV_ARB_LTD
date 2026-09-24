"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Headphones,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const TW = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";
const CG = "https://assets.coingecko.com/coins/images";

interface SwapAsset {
  id: string;
  symbol: string;
  name: string;
  usd: number;
  icon: string;
}

const ASSETS: SwapAsset[] = [
  { id: "btc", symbol: "BTC", name: "Bitcoin", usd: 110_000, icon: `${TW}/bitcoin/info/logo.png` },
  { id: "eth", symbol: "ETH", name: "Ethereum", usd: 3_520, icon: `${TW}/ethereum/info/logo.png` },
  { id: "bnb", symbol: "BNB", name: "BNB", usd: 640, icon: `${TW}/smartchain/info/logo.png` },
  { id: "sol", symbol: "SOL", name: "Solana", usd: 178, icon: `${TW}/solana/info/logo.png` },
  { id: "usdt", symbol: "USDT", name: "Tether", usd: 1, icon: `${TW}/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png` },
  { id: "usdc", symbol: "USDC", name: "USD Coin", usd: 1, icon: `${CG}/6319/small/usdc.png` },
];

const TOP_PAIRS = [
  ["sol", "eth"],
  ["eth", "btc"],
  ["btc", "usdt"],
  ["eth", "sol"],
  ["bnb", "usdt"],
  ["btc", "eth"],
] as const;

function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return value.toPrecision(6);
}

function AssetChip({ asset }: { asset: SwapAsset }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image src={asset.icon} alt="" width={28} height={28} className="rounded-full" unoptimized />
      <span className="text-left">
        <span className="block text-sm font-bold text-slate-900">{asset.symbol}</span>
        <span className="block text-[10px] font-medium text-slate-400">{asset.name}</span>
      </span>
    </span>
  );
}

function AssetPicker({
  open,
  currentId,
  onSelect,
  onClose,
}: {
  open: boolean;
  currentId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = ASSETS.filter(
    (asset) =>
      asset.symbol.toLowerCase().includes(query.toLowerCase()) ||
      asset.name.toLowerCase().includes(query.toLowerCase())
  );

  if (!open) return null;

  return (
    <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search coin"
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {filtered.map((asset) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => {
              onSelect(asset.id);
              setQuery("");
              onClose();
            }}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"
          >
            <AssetChip asset={asset} />
            {asset.id === currentId ? <Check className="h-4 w-4 text-emerald-500" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function SwapWidget() {
  const [fromId, setFromId] = useState("btc");
  const [toId, setToId] = useState("eth");
  const [amount, setAmount] = useState("0.1");
  const [address, setAddress] = useState("");
  const [picker, setPicker] = useState<"from" | "to" | null>(null);
  const [tab, setTab] = useState<"crypto" | "fiat">("crypto");
  const [rateMode, setRateMode] = useState<"float" | "fixed">("float");
  const [notice, setNotice] = useState("");

  const from = ASSETS.find((asset) => asset.id === fromId) ?? ASSETS[0];
  const to = ASSETS.find((asset) => asset.id === toId) ?? ASSETS[1];
  const parsed = Number.parseFloat(amount.replace(",", ".")) || 0;
  const receive = useMemo(() => (parsed * from.usd) / to.usd, [parsed, from.usd, to.usd]);

  function swapSides() {
    setFromId(toId);
    setToId(fromId);
    if (receive > 0) setAmount(formatAmount(receive));
  }

  function onExchange() {
    if (tab === "fiat") {
      setNotice("Fiat on-ramp belum tersedia di portal ini.");
      return;
    }
    if (parsed <= 0) {
      setNotice("Masukkan jumlah yang ingin ditukar.");
      return;
    }
    if (fromId === toId) {
      setNotice("Pilih dua aset yang berbeda.");
      return;
    }
    if (!address.trim()) {
      setNotice("Masukkan alamat wallet penerima.");
      return;
    }
    setNotice(
      `Kuota ${formatAmount(parsed)} ${from.symbol} → ${formatAmount(receive)} ${to.symbol} siap. Eksekusi on-chain menyusul di modul Swap.`
    );
  }

  return (
    <div className="w-full rounded-[28px] bg-white p-4 text-slate-900 shadow-2xl shadow-black/25 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        {(["crypto", "fiat"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setTab(item);
              setNotice("");
            }}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide ${
              tab === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {item === "crypto" ? "Crypto" : "Fiat"}
          </button>
        ))}
        <div className="ml-auto flex rounded-full bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => setRateMode("float")}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
              rateMode === "float" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Floating
          </button>
          <button
            type="button"
            onClick={() => setRateMode("fixed")}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
              rateMode === "fixed" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Fixed
          </button>
        </div>
      </div>

      <div className="relative space-y-3">
        <div className="relative rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">You send</p>
          <div className="mt-2 flex items-center gap-3">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-slate-900 outline-none sm:text-3xl"
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => setPicker(picker === "from" ? null : "from")}
                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200 hover:ring-slate-300"
              >
                <AssetChip asset={from} />
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              <AssetPicker
                open={picker === "from"}
                currentId={fromId}
                onSelect={setFromId}
                onClose={() => setPicker(null)}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Tukar sisi aset"
          onClick={swapSides}
          className="absolute left-1/2 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-slate-900 text-white shadow-lg hover:bg-slate-800"
        >
          <ArrowLeftRight className="h-4 w-4 rotate-90" />
        </button>

        <div className="relative rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">You get</p>
          <div className="mt-2 flex items-center gap-3">
            <p className="min-w-0 flex-1 text-2xl font-bold text-slate-900 sm:text-3xl">{formatAmount(receive)}</p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPicker(picker === "to" ? null : "to")}
                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200 hover:ring-slate-300"
              >
                <AssetChip asset={to} />
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              <AssetPicker
                open={picker === "to"}
                currentId={toId}
                onSelect={setToId}
                onClose={() => setPicker(null)}
              />
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Estimated rate: 1 {from.symbol} ≈ {formatAmount(from.usd / to.usd)} {to.symbol} · {rateMode === "float" ? "floating" : "fixed"}
      </p>

      <label className="mt-4 block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Recipient address
        </span>
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder={`Your ${to.symbol} address`}
          className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400"
        />
      </label>

      <button
        type="button"
        onClick={onExchange}
        className="mt-4 w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400"
      >
        Exchange
      </button>
      {notice ? <p className="mt-3 text-center text-xs font-medium text-slate-600">{notice}</p> : null}
    </div>
  );
}

export default function SwapLanding() {
  return (
    <div className="relative w-full overflow-hidden">
      <section className="relative overflow-hidden px-4 pb-16 pt-8 sm:pt-10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 70% at 12% 20%, rgba(37,99,235,0.55), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 10%, rgba(14,165,233,0.28), transparent 50%), linear-gradient(180deg, #0b1f4d 0%, #0a1738 58%, #07101f 100%)",
          }}
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-10">
          <div className="relative mx-auto w-full max-w-xl">
            <SwapWidget />
          </div>
          <div className="max-w-2xl text-center text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/80">Swap</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">Crypto Swap</h1>
            <p className="mt-3 text-base text-sky-100/80 sm:text-lg">
              Tukar aset digital tanpa alur onboarding yang berbelit — pilih pair, masukkan jumlah, kirim ke wallet
              tujuan.
            </p>
          </div>
        </div>
      </section>

      <section className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Lock,
            title: "Tanpa daftar wajib",
            body: "Mulai dari widget. Wallet tujuan diisi saat Anda siap menukar.",
          },
          {
            icon: Sparkles,
            title: "Pair populer",
            body: "BTC, ETH, BNB, SOL, dan stablecoin untuk desk yang butuh pergerakan cepat.",
          },
          {
            icon: Headphones,
            title: "Dukungan desk",
            body: "Status kuota dan alamat tujuan tetap terlihat di portal operator.",
          },
          {
            icon: ShieldCheck,
            title: "Non-custodial",
            body: "Aset ditujukan ke alamat yang Anda masukkan, bukan disimpan di katalog portal.",
          },
        ].map((item) => (
          <article
            key={item.title}
            className="theme-panel rounded-2xl border border-slate-800/80 p-4"
          >
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300">
              <item.icon className="h-5 w-5" />
            </span>
            <h2 className="text-sm font-bold text-slate-100">{item.title}</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="relative mx-auto w-full max-w-6xl px-4 pb-8">
        <h2 className="text-lg font-black text-white">Top pairs</h2>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TOP_PAIRS.map(([fromId, toId], index) => {
            const from = ASSETS.find((asset) => asset.id === fromId)!;
            const to = ASSETS.find((asset) => asset.id === toId)!;
            return (
              <div
                key={`${fromId}-${toId}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/50 px-4 py-3"
              >
                <span className="w-6 text-sm font-bold text-slate-500">{index + 1}</span>
                <Image src={from.icon} alt="" width={22} height={22} className="rounded-full" unoptimized />
                <span className="text-sm font-bold text-slate-200">{from.symbol}</span>
                <ArrowLeftRight className="h-3.5 w-3.5 text-slate-500" />
                <Image src={to.icon} alt="" width={22} height={22} className="rounded-full" unoptimized />
                <span className="text-sm font-bold text-slate-200">{to.symbol}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-6xl px-4 pb-14">
        <h2 className="text-lg font-black text-white">How it works</h2>
        <ol className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            ["Pilih pair", "Tentukan aset kirim dan aset terima, lalu isi jumlah."],
            ["Isi alamat", "Masukkan wallet yang akan menerima hasil swap."],
            ["Kirim aset", "Lanjutkan dengan jumlah yang tertera pada kuota."],
            ["Selesai", "Status Finished berarti swap pada alur ini sudah ditutup."],
          ].map(([title, body], index) => (
            <li
              key={title}
              className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4"
            >
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Step {index + 1}</span>
              <h3 className="mt-2 text-sm font-bold text-white">{title}</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
