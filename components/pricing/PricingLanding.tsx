"use client";

import { useState } from "react";
import { Check, Sparkles, Zap } from "lucide-react";
import PricingCheckoutModal from "@/components/pricing/PricingCheckoutModal";
import { formatUsd } from "@/lib/pricing/checkout";
import { PRICING_PLANS, PRICING_PRODUCT, type PricingPlan } from "@/lib/pricing/plans";

function PlanCard({ plan, onSelect }: { plan: PricingPlan; onSelect: (plan: PricingPlan) => void }) {
  const popular = Boolean(plan.popular);

  return (
    <article
      className={`relative flex h-full min-w-0 flex-col rounded-2xl border p-5 ${
        popular
          ? "border-amber-400/50 bg-gradient-to-b from-amber-500/12 via-slate-950/80 to-slate-950/90 pt-8 shadow-[0_0_36px_rgba(251,191,36,0.14)]"
          : "border-slate-800/80 bg-slate-950/70"
      }`}
    >
      {popular ? (
        <span className="absolute -top-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-500/20">
          <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
          Most Popular · Paling Populer
        </span>
      ) : null}

      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{plan.name}</p>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-black tracking-tight text-white sm:text-4xl">{formatUsd(plan.priceUsd)}</span>
        <span className="text-xs font-semibold text-slate-500">USD</span>
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">{plan.blurb}</p>

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-[13px] leading-5 text-slate-300">
            <Check
              className={`mt-0.5 h-4 w-4 shrink-0 ${popular ? "text-amber-300" : "text-emerald-400"}`}
              aria-hidden
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onSelect(plan)}
        className={`mt-6 inline-flex w-full cursor-pointer items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
          popular
            ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 hover:from-amber-300 hover:to-yellow-200"
            : plan.id === "free"
              ? "border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500 hover:bg-slate-800"
              : "border border-amber-500/30 bg-amber-500/10 text-amber-200 hover:border-amber-400/50 hover:bg-amber-500/20"
        }`}
      >
        {plan.cta}
      </button>
    </article>
  );
}

export default function PricingLanding() {
  const [selected, setSelected] = useState<PricingPlan | null>(null);

  return (
    <div className="relative w-full">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 18% -8%, rgba(251,191,36,0.16), transparent 55%), radial-gradient(ellipse 50% 38% at 92% 6%, rgba(16,185,129,0.10), transparent 50%)",
        }}
      />

      <section className="relative mx-auto flex w-full flex-col items-center px-2 pb-8 pt-6 text-center sm:px-4 sm:pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/90">Pricing</p>
        <div className="mt-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-yellow-300/5 text-amber-300">
          <Zap className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
          {PRICING_PRODUCT.title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
          {PRICING_PRODUCT.description}
        </p>
      </section>

      <section className="relative mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 px-2 pb-14 pt-4 sm:grid-cols-2 sm:px-4">
        {PRICING_PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onSelect={setSelected} />
        ))}
      </section>

      {selected ? <PricingCheckoutModal plan={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
