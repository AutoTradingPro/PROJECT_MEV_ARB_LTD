"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CreditCard,
  Loader2,
  Wallet,
  X,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import BankTransferForm from "@/components/pricing/BankTransferForm";
import CardPaymentForm, { type CardFormValue } from "@/components/pricing/CardPaymentForm";
import CryptoAssetLogo from "@/components/pricing/CryptoAssetLogo";
import {
  CRYPTO_ASSETS,
  USD_TO_IDR,
  bankDetailsForPlan,
  checkoutCtaLabel,
  formatIdr,
  formatUsd,
  type CryptoAssetId,
  type PaymentMethodId,
  type TransferBankId,
} from "@/lib/pricing/checkout";
import type { PricingPlan } from "@/lib/pricing/plans";

const METHODS: { id: PaymentMethodId; label: string; hint: string; icon: typeof CreditCard }[] = [
  { id: "card", label: "Kartu", hint: "Visa · Mastercard · bluVirtual", icon: CreditCard },
  { id: "crypto", label: "Crypto", hint: "USDT · USDC · ETH · SOL", icon: Wallet },
  { id: "bank", label: "Transfer Bank", hint: "BCA · Mandiri · BNI · BRI", icon: Building2 },
];

export default function PricingCheckoutModal({
  plan,
  onClose,
}: {
  plan: PricingPlan;
  onClose: () => void;
}) {
  const router = useRouter();
  const wallet = useWallet();
  const { user } = useAuth();
  const [method, setMethod] = useState<PaymentMethodId>(plan.priceUsd === 0 ? "card" : "card");
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [cryptoAsset, setCryptoAsset] = useState<CryptoAssetId>("usdt");
  const [transferBank, setTransferBank] = useState<TransferBankId>("bca");
  const [card, setCard] = useState<CardFormValue>({
    email: "",
    name: "",
    number: "",
    expiry: "",
    cvc: "",
    country: "ID",
    save: false,
  });

  const bank = useMemo(() => bankDetailsForPlan(plan, transferBank), [plan, transferBank]);
  const free = plan.priceUsd === 0;

  useEffect(() => {
    const registered = user?.email?.trim();
    if (!registered) return;
    setCard((current) => (current.email ? current : { ...current, email: registered }));
  }, [user?.email]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !processing) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, processing]);

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value.replace(/\s/g, ""));
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Gagal menyalin. Salin manual dari layar.");
    }
  };

  const validate = (): string | null => {
    if (free) return null;
    if (method === "card") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(card.email.trim())) {
        return "Masukkan email kontak yang valid.";
      }
      if (card.name.trim().length < 3) return "Masukkan nama pada kartu.";
      if (card.number.replace(/\s/g, "").length < 16) return "Nomor kartu belum lengkap.";
      if (card.expiry.replace(/\D/g, "").length < 4) return "Masukkan masa berlaku BB/TT.";
      if (card.cvc.length < 3) return "Masukkan CVC.";
    }
    if (method === "crypto" && !wallet.isConnected) {
      return "Hubungkan wallet Web3 terlebih dahulu.";
    }
    return null;
  };

  const confirm = async () => {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setProcessing(true);
    setStatus("checking");
    await new Promise((resolve) => window.setTimeout(resolve, method === "bank" ? 2200 : 1400));
    setStatus("success");
    setProcessing(false);
    window.setTimeout(() => {
      onClose();
      router.push(plan.href);
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-checkout-title"
    >
      <button
        type="button"
        aria-label="Tutup modal pembayaran"
        className="absolute inset-0 cursor-pointer bg-slate-950/75 backdrop-blur-md"
        onClick={() => {
          if (!processing) onClose();
        }}
      />

      <div className="relative flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-cyan-400/20 bg-[#071019]/96 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_40px_rgba(34,211,238,0.08)] sm:rounded-3xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
              Checkout · {plan.name}
            </p>
            <h2 id="pricing-checkout-title" className="mt-1 text-lg font-black tracking-tight text-white">
              Metode Pembayaran
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 sm:px-6">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Ringkasan paket</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <div>
                <p className="text-base font-black text-white">{plan.name}</p>
                <p className="text-xs text-slate-400">Bot Flashloan Arbitrase</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-cyan-300">{formatUsd(plan.priceUsd)}</p>
                <p className="text-xs font-semibold text-slate-400">{formatIdr(plan.priceUsd)}</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Kurs referensi Rp {USD_TO_IDR.toLocaleString("id-ID")} / USD
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Metode pembayaran">
            {METHODS.map((item) => {
              const Icon = item.icon;
              const selected = method === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setMethod(item.id);
                    setError(null);
                    setStatus("idle");
                  }}
                  className={`cursor-pointer rounded-2xl border px-2 py-3 text-center transition-all ${
                    selected
                      ? "border-cyan-400/55 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
                      : "border-slate-800 bg-slate-950/70 hover:border-slate-600"
                  }`}
                >
                  <Icon className={`mx-auto h-4 w-4 ${selected ? "text-cyan-300" : "text-slate-500"}`} />
                  <p className={`mt-1.5 text-[11px] font-bold ${selected ? "text-cyan-200" : "text-slate-300"}`}>
                    {item.label}
                  </p>
                  <p className="mt-0.5 hidden text-[9px] leading-3 text-slate-500 sm:block">{item.hint}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {method === "card" ? <CardPaymentForm value={card} onChange={setCard} /> : null}

            {method === "crypto" ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Checkout Web3 via WalletConnect / AppKit. Pilih aset lalu hubungkan wallet.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {CRYPTO_ASSETS.map((asset) => {
                    const selected = cryptoAsset === asset.id;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setCryptoAsset(asset.id)}
                        className={`inline-flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-[11px] font-bold transition-all ${
                          selected
                            ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200"
                            : "border-slate-800 bg-slate-950/80 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        <CryptoAssetLogo id={asset.id} />
                        {asset.symbol}
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Crypto checkout</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-white">
                    <CryptoAssetLogo id={cryptoAsset} />
                    {formatUsd(plan.priceUsd)} · {CRYPTO_ASSETS.find((item) => item.id === cryptoAsset)?.symbol}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {CRYPTO_ASSETS.find((item) => item.id === cryptoAsset)?.network}
                  </p>
                  {wallet.isConnected ? (
                    <p className="mt-2 font-mono text-xs text-emerald-300">{wallet.shortAddress}</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void wallet.connect()}
                      className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-400/20"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      {wallet.isConnecting ? "Membuka WalletConnect…" : "Hubungkan Wallet"}
                    </button>
                  )}
                  {wallet.error ? <p className="mt-2 text-xs text-rose-400">{wallet.error}</p> : null}
                </div>
              </div>
            ) : null}

            {method === "bank" ? (
              <BankTransferForm
                selectedBank={transferBank}
                onSelectBank={(id) => {
                  setTransferBank(id);
                  setError(null);
                  setStatus("idle");
                }}
                rows={[
                  { label: "Bank", value: bank.bank },
                  { label: "Nama rekening", value: bank.accountName },
                  { label: "Virtual account", value: bank.virtualAccount, copy: true },
                  { label: "Berita transfer", value: bank.note, copy: true },
                  { label: "Jumlah", value: formatIdr(plan.priceUsd), copy: true },
                ]}
                copied={copied}
                onCopy={(label, value) => void copyValue(label, value)}
                status={status}
              />
            ) : null}
          </div>

          {error ? (
            <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void confirm()}
            disabled={processing}
            className="mt-5 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-sm font-black text-slate-950 shadow-[0_10px_28px_rgba(34,211,238,0.22)] transition-all hover:from-cyan-300 hover:to-emerald-300 disabled:cursor-wait disabled:opacity-80"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {status === "success" ? "Berhasil · Mengalihkan…" : checkoutCtaLabel(plan.id, processing)}
          </button>
        </div>
      </div>
    </div>
  );
}
