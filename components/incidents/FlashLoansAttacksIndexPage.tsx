import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

const SOURCE_URL = "https://smartcontractshacking.com/hacks/type/flash-loans-attacks";

const RECORDS = [
  {
    protocol: "Euler Finance",
    date: "Mar 2023",
    loss: "$197.0M",
    chain: "ethereum",
    href: "/incidents/euler-finance-hack-2023",
    note: "Self-liquidation & donateToReserves",
  },
  {
    protocol: "Beanstalk",
    date: "Apr 2022",
    loss: "$181M",
    chain: "ethereum",
    href: "/incidents/beanstalk-hack-2022",
    note: "Hak suara DAO dari flash liquidity",
  },
  {
    protocol: "Cream Finance",
    date: "Oct 2021",
    loss: "$130M",
    chain: "ethereum",
    href: "/incidents/cream-finance-hack-2021",
    note: "Oracle pricePerShare yUSD",
  },
  {
    protocol: "Cream Landing",
    date: "Oct 2021",
    loss: "$130.0M",
    chain: "ethereum",
    href: "/incidents/cream-lending-hack-2021",
    note: "Supply rekursif + oracle vault",
  },
  {
    protocol: "Rari Capital",
    date: "Apr 2022",
    loss: "$80.0M",
    chain: "ethereum",
    href: "/incidents/rari-capital-hack-2022",
    note: "Reentrancy Fuse / exitMarket",
  },
];

export default function FlashLoansAttacksIndexPage() {
  return (
    <article className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
      <Link
        href="/markets"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-emerald-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Incident Database
      </Link>

      <div className="theme-panel relative overflow-hidden rounded-2xl border border-slate-800/80">
        <div
          className="pointer-events-none absolute inset-x-4 top-4 h-40 rounded-2xl opacity-50"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 8% 0%, rgba(56,189,248,0.10), transparent 60%), radial-gradient(ellipse 50% 70% at 96% 20%, rgba(251,191,36,0.08), transparent 55%)",
          }}
        />

        <div className="relative px-5 py-8 sm:px-8 sm:py-10 md:px-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-400/90">
            Kelas serangan
          </p>
          <h1 className="mt-3 max-w-3xl text-2xl font-black tracking-tight text-[var(--app-fg)] sm:text-3xl">
            Flash Loan Hacks: contoh eksploitasi Web3 nyata
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Insiden yang dipetakan ke kelas flash loan · diurutkan menurut kerugian terlapor, lalu waktu kejadian terbaru
          </p>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Apa yang tercatat di sini
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Halaman ini merangkum{" "}
                <strong className="font-semibold text-[var(--app-fg)]">insiden flash loan nyata</strong>{" "}
                sebagai bahan pembelajaran. Mulai dari catatan, buka sumber, lalu pelajari pola serangan
                hanya jika insiden itu relevan dengan kode yang sedang di-review.
              </p>
              <p>
                Total kerugian memakai nilai USD yang sudah terurai saja; kerugian yang tidak diketahui
                atau tidak bisa diurai{" "}
                <strong className="font-semibold text-[var(--app-fg)]">tidak ditebak</strong>. Tautan
                kelas serangan ditambahkan hanya jika akar penyebabnya cukup jelas untuk dipetakan.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Catatan insiden
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-[var(--muted)] sm:text-base">
              Diurutkan menurut kerugian terlapor yang diketahui, kemudian waktu kejadian terbaru. Buka sumber sebelum
              memperlakukan ringkasan apa pun sebagai final.
            </p>
            <ul className="mt-5 divide-y divide-slate-800/80 overflow-hidden rounded-xl border border-slate-800/70">
              {RECORDS.map((item) => (
                <li key={item.href} className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] px-4 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-[var(--app-fg)]">{item.protocol}</p>
                    <p className="text-[12px] text-slate-500">
                      {item.date} · {item.chain} · {item.note}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-rose-400">{item.loss}</span>
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400 hover:text-emerald-300"
                    >
                      STUDY INCIDENT
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Pola di balik kelas ini
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Flash loan adalah pinjaman tanpa agunan yang harus dilunasi dalam transaksi yang sama.
                Yang berbahaya bukan primitif itu sendiri, melainkan ketika protokol mengandalkan
                harga, hak suara, atau kolateral yang bisa diubah dalam jendela atomik itu.
              </p>
              <p>
                Contoh publik di atas meliputi manipulasi oracle, self-liquidation, pembelian mayoritas
                DAO, dan reentrancy yang didanai likuiditas kilat. Gunakan catatan ini sebagai peta
                review keamanan — bukan sebagai prosedur serangan.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Pembelajaran
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              Database kelas flash loan membantu memindah fokus dari satu kasus ke pola: modal tak
              terbatas dalam satu blok, oracle spot, tata kelola tanpa vesting, dan accounting yang
              terlambat. Setelah membuka catatan, bandingkan dengan kode yang Anda jaga — lalu uji
              skenario “pelaku punya likuiditas tak terbatas sampai transaksi selesai”.
            </p>
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
            >
              Sumber: smartcontractshacking.com
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </section>
        </div>
      </div>
    </article>
  );
}
