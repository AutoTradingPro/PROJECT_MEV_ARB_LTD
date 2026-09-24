export type PricingPlanId = "free" | "pro-1" | "pro-2" | "pro-3";

export interface PricingPlan {
  id: PricingPlanId;
  name: string;
  priceUsd: number;
  blurb: string;
  features: string[];
  cta: string;
  href: string;
  popular?: boolean;
}

export const PRICING_PRODUCT = {
  title: "Bot Flashloan Arbitrase",
  description:
    "Mesin pemindaian dan eksekusi spread lintas DEX dengan flashloan atomik. Pilih tier sesuai skala modal, kedalaman filter, dan prioritas latensi desk Anda.",
} as const;

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "FREE",
    priceUsd: 0,
    blurb: "Cocok untuk eksplorasi awal dan pemindaian pasar dasar.",
    features: [
      "Mode SCAN_ONLY",
      "Pemindaian dasar",
      "Tanpa akses eksekusi otomatis",
      "Limit pair standar",
    ],
    cta: "Mulai Sekarang",
    href: "/mev-arb",
  },
  {
    id: "pro-1",
    name: "PRO 1",
    priceUsd: 100,
    blurb: "Solusi optimal untuk trader aktif yang mulai serius dengan analisis data riil.",
    features: [
      "Akses penuh filter operasional (Minimum Spread, Max Price Impact, Dynamic Bribe %)",
      "Analitik 10 pair real-time",
      "Prioritas kecepatan pemindaian",
    ],
    cta: "Pilih Paket",
    href: "/mev-arb",
  },
  {
    id: "pro-2",
    name: "PRO 2",
    priceUsd: 300,
    blurb: "Paket unggulan untuk trader profesional dengan strategi multi-rute.",
    features: [
      "Semua fitur PRO 1",
      "Dukungan multi-network (Arbitrum & EVM)",
      "Optimasi rotasi round-robin",
      "Simulasi Max Safe Loan tingkat lanjut",
      "Prioritas dukungan teknis",
    ],
    cta: "Pilih Paket",
    href: "/mev-arb",
    popular: true,
  },
  {
    id: "pro-3",
    name: "PRO 3",
    priceUsd: 500,
    blurb: "Tier tertinggi untuk skala institusional & modal besar ($100k–$1M+).",
    features: [
      "Semua fitur PRO 2",
      "Infrastruktur khusus berkecepatan tinggi",
      "Kesiapan integrasi Solana/Jito bundles",
      "Kustomisasi filter tanpa batas",
      "Performa latensi terendah",
    ],
    cta: "Pilih Paket",
    href: "/mev-arb",
  },
];
