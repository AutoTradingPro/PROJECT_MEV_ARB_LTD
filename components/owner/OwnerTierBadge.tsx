import { OWNER_TIER_LABEL, type OwnerUserTier } from "@/lib/owner/types";

const TIER_CLASS: Record<OwnerUserTier, string> = {
  free: "border-slate-600 bg-slate-800/80 text-slate-300",
  "pro-1": "border-amber-500/40 bg-amber-500/10 text-amber-300",
  "pro-2": "border-sky-500/40 bg-sky-500/10 text-sky-300",
  "pro-3": "border-violet-500/40 bg-violet-500/10 text-violet-300",
  affiliate: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

export default function OwnerTierBadge({ tier }: { tier: OwnerUserTier }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TIER_CLASS[tier]}`}
    >
      {OWNER_TIER_LABEL[tier]}
    </span>
  );
}
