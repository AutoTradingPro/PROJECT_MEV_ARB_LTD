"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";

type Incident = {
  id: string;
  caseNo: string;
  protocol: string;
  date: string;
  loss: string;
  chain: string;
  vector: string;
  lesson: string;
  href?: string;
};

const INCIDENTS: Incident[] = [
  {
    id: "euler",
    caseNo: "FLX-01",
    protocol: "Euler Finance",
    date: "Mar 2023",
    loss: "$197.0M",
    chain: "ethereum",
    href: "/incidents/euler-finance-hack-2023",
    vector:
      "donateToReserves() mengurangi kolateral tanpa cek solvabilitas, lalu self-liquidation dengan flash liquidity.",
    lesson:
      "Setiap operasi yang mengurangi kolateral harus diuji solvabilitas setelah selesai, termasuk jalur likuidasi multi-akun.",
  },
  {
    id: "beanstalk",
    caseNo: "FLX-02",
    protocol: "Beanstalk",
    date: "Apr 2022",
    loss: "$181M",
    chain: "ethereum",
    href: "/incidents/beanstalk-hack-2022",
    vector:
      "Deposit Silo langsung memberi Stalk voting power; emergencyCommit mengeksekusi proposal dengan mayoritas flash-loan.",
    lesson:
      "Hak suara DAO tidak boleh dibeli dan dipakai dalam satu transaksi. Perlu vesting, snapshot, atau jeda eksekusi proposal.",
  },
  {
    id: "cream",
    caseNo: "FLX-03",
    protocol: "Cream Finance",
    date: "Oct 2021",
    loss: "$130M",
    chain: "ethereum",
    href: "/incidents/cream-finance-hack-2021",
    vector:
      "Manipulasi pricePerShare vault Yearn yUSD lewat flash liquidity, lalu pinjam berlebih di pasar Cream.",
    lesson:
      "Jangan menilai kolateral dari harga share vault spot. Pakai oracle yang tidak bisa diubah dalam transaksi yang sama.",
  },
  {
    id: "cream-landing",
    caseNo: "FLX-04",
    protocol: "Cream Landing",
    date: "Oct 2021",
    loss: "$130.0M",
    chain: "ethereum",
    href: "/incidents/cream-lending-hack-2021",
    vector:
      "Oracle kolateral CREAM mempercayai pricePerShare yUSD; supply rekursif memperkuat valuasi palsu lalu menguras pasar v1.",
    lesson:
      "Batasi kolateral dari share vault, pakai harga tahan manipulasi, dan kekang supply rekursif yang memperbesar kesalahan valuasi.",
  },
  {
    id: "rari",
    caseNo: "FLX-05",
    protocol: "Rari Capital",
    date: "Apr 2022",
    loss: "$80.0M",
    chain: "ethereum",
    href: "/incidents/rari-capital-hack-2022",
    vector:
      "Reentrancy pada fork Compound Fuse: pinjam ETH sebelum utang tercatat, lalu exitMarket dan tarik kolateral flash-loan.",
    lesson:
      "Guard reentrancy harus mencakup Comptroller/exitMarket. Catat utang dulu, baru transfer; flash loan hanya memperbesar celah itu.",
  },
];

export default function FlashLoanAttacksSection() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = INCIDENTS.find((item) => item.id === activeId) ?? null;

  return (
    <section
      className="relative mt-2 w-full border-y border-sky-500/15 bg-[#07111f]"
      aria-labelledby="incident-database-title"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(14,116,144,0.18), transparent 55%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:py-12">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Incident Database
          </p>
          <h2
            id="incident-database-title"
            className="mt-2 text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl"
          >
            Kejadian Nyata flashloan attact Sebagai Pembelajaran
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Seleksi insiden ber-sinyal tinggi yang terkait kelas serangan ini, diurutkan menurut
            kerugian terlapor dan waktu kejadian terbaru.
          </p>
        </header>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {INCIDENTS.map((incident) => (
            <article
              key={incident.id}
              className={[
                "flex h-full min-h-[168px] flex-col rounded-xl border bg-[#0c1829] px-3.5 py-3.5",
                activeId === incident.id
                  ? "border-emerald-400/45"
                  : "border-slate-700/70",
              ].join(" ")}
            >
              <h3 className="text-[13px] font-semibold leading-5 text-white">{incident.protocol}</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">{incident.date}</p>
              <p className="mt-4 text-[22px] font-bold leading-none tracking-tight text-rose-400">
                {incident.loss}
              </p>
              <p className="mt-1.5 font-mono text-[11px] lowercase text-slate-500">{incident.chain}</p>
              <StudyIncidentAction
                href={incident.href}
                selected={activeId === incident.id}
                onStudy={() => setActiveId(incident.id)}
                className="mt-auto inline-flex items-center gap-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-400 hover:text-emerald-300"
              />
            </article>
          ))}
        </div>

        {active ? (
          <div
            className="mt-5 rounded-xl border border-emerald-400/25 bg-[#0a1524] p-4 sm:p-5"
            role="region"
            aria-label={`Studi ${active.protocol}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] tracking-widest text-emerald-400">{active.caseNo}</p>
                <h3 className="mt-1 text-base font-bold text-white">{active.protocol}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="rounded-lg border border-slate-700/80 p-1.5 text-slate-400 hover:border-emerald-400/40 hover:text-emerald-300"
                aria-label="Tutup studi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              <span className="font-semibold text-slate-200">Vektor: </span>
              {active.vector}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              <span className="font-semibold text-slate-200">Pelajaran: </span>
              {active.lesson}
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex justify-center">
          <Link
            href="/incidents/flash-loans-attacks"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-transparent px-6 py-2 text-sm font-medium text-white transition hover:border-white/45 hover:bg-white/5"
          >
            View all Flash Loan hacks
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function StudyIncidentAction({
  href,
  selected,
  onStudy,
  className,
}: {
  href?: string;
  selected: boolean;
  onStudy: () => void;
  className: string;
}) {
  const label = (
    <>
      STUDY INCIDENT
      <ArrowUpRight className="h-3 w-3" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onStudy} aria-pressed={selected} className={className}>
      {label}
    </button>
  );
}
