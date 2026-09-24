import Link from "next/link";
import { Coins } from "lucide-react";

const PLAN = [
  {
    label: "Nama proyek",
    value: "MVA (MVA Coin)",
  },
  {
    label: "Status jaringan",
    value: "Menyusul / fleksibel (multi-chain compatible)",
  },
  {
    label: "Fokus pengembangan",
    value:
      "Mempersiapkan infrastruktur dasar token, utilitas token di dalam ekosistem bot arbitrase, serta integrasi branding MVA ke dalam platform.",
  },
] as const;

export default function RoadmapMvaCoin() {
  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 12% -8%, rgba(34,211,238,0.14), transparent 55%), radial-gradient(ellipse 50% 35% at 90% 12%, rgba(56,189,248,0.10), transparent 50%)",
        }}
      />

      <section className="relative mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
        <Link
          href="/roadmap"
          className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80 hover:text-cyan-200"
        >
          RoadMap · Horizon
        </Link>
        <div className="mt-5 flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
            <Coins className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              MVA Coin
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Rencana strategis jangka panjang untuk koin ekosistem MEV ARB. Jaringan
              belum dikunci agar rilis bisa mengikuti rute multi-chain yang paling
              relevan.
            </p>
          </div>
        </div>

        <dl className="mt-8 space-y-3">
          {PLAN.map((row) => (
            <div
              key={row.label}
              className="theme-panel rounded-2xl border border-slate-800/80 p-4"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {row.label}
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-slate-200">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
