import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

const SOURCE_URL = "https://smartcontractshacking.com/hacks/euler-finance-hack-2023";

export default function EulerFinanceHackPage() {
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
            Studi insiden
          </p>
          <h1 className="mt-3 max-w-3xl text-2xl font-black tracking-tight text-[var(--app-fg)] sm:text-3xl">
            Euler Finance Hack (2023) — $197.0M
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Ethereum · 13 Maret 2023 · Lending protocol / logika self-liquidation
          </p>

          <section className="mt-10" id="hkd-description-heading">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Apa yang terjadi
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Protokol lending Euler Finance di Ethereum dieksploitasi pada{" "}
                <strong className="font-semibold text-[var(--app-fg)]">13 Maret 2023</strong> senilai
                sekitar{" "}
                <strong className="font-semibold text-[var(--app-fg)]">$197 juta</strong>. Pelaku
                memakai likuiditas kilat (flash liquidity) dan akun yang dikendalikan sendiri untuk
                membentuk posisi yang sengaja tidak sehat, lalu melakukan likuidasi terhadap posisi
                itu sendiri dengan syarat diskon likuidasi Euler, kemudian menarik aset dari pool.
              </p>
              <p>
                Euler kemudian menyatakan bahwa seluruh dana yang dapat dipulihkan dikembalikan.
                Laporan lanjutan menilai aset yang dikembalikan sekitar{" "}
                <strong className="font-semibold text-[var(--app-fg)]">$240 juta</strong> setelah
                harga pasar berubah.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Akar penyebab teknis
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Fungsi{" "}
                <strong className="font-semibold text-[var(--app-fg)]">donateToReserves()</strong>{" "}
                dapat mengurangi kolateral suatu akun tanpa memeriksa apakah akun itu masih solven
                setelah operasi. Digabung dengan self-borrowing dan insentif likuidasi, celah itu
                memungkinkan pelaku merancang likuidasi yang menguntungkan terhadap posisinya sendiri.
              </p>
              <p>
                Pelajaran untuk protokol lending: setiap transisi state yang mengurangi kolateral
                harus diuji solvabilitas{" "}
                <strong className="font-semibold text-[var(--app-fg)]">setelah operasi selesai</strong>
                , termasuk jalur likuidasi multi-akun yang didanai likuiditas sementara.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Detail kasus &amp; protokol
            </h2>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Klasifikasi", "Lending protocol / logika self-liquidation"],
                ["Jenis protokol", "Lending"],
                ["Aset / kontrak terdampak", "EUL dan pool underlying Euler"],
                ["Bahasa implementasi", "Solidity"],
                ["Jaringan", "Ethereum"],
                ["Tanggal insiden", "13 Maret 2023"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-800/70 bg-[var(--surface)] p-4"
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Bagaimana kejadiannya
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Secara ringkas, pelaku meminjam likuiditas kilat, menyetorkannya ke Euler, lalu
                memakai <strong className="font-semibold text-[var(--app-fg)]">mint()</strong> untuk
                membentuk posisi eToken (kolateral) dan dToken (utang) dengan leverage tinggi
                sementara pemeriksaan di tengah jalan masih lolos.
              </p>
              <p>
                Setelah itu,{" "}
                <strong className="font-semibold text-[var(--app-fg)]">donateToReserves()</strong>{" "}
                mengurangi kolateral eToken tanpa pemeriksaan kesehatan pasca-operasi, sehingga akun
                menjadi dapat dilikuidasi. Akun kedua yang dikendalikan pelaku kemudian
                melikuidasi posisi buruk itu pada diskon soft-liquidation Euler, memperoleh eToken
                yang nilainya lebih besar daripada utang yang dilunasi, menukarnya menjadi aset pool,
                lalu mengembalikan likuiditas kilat. Pola yang sama diulang terhadap pool lain.
              </p>
              <p>
                Ini adalah rekonstruksi publik dari insiden historis untuk pembelajaran keamanan —
                bukan panduan untuk meniru serangan.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Pemulihan dana
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Dipulihkan
                </p>
                <p className="mt-2 text-2xl font-black text-emerald-400">89,8%</p>
              </div>
              <div className="rounded-xl border border-slate-800/70 bg-[var(--surface)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Nilai pulih
                </p>
                <p className="mt-2 text-2xl font-black text-[var(--app-fg)]">$177.0M</p>
              </div>
              <div className="rounded-xl border border-rose-400/25 bg-rose-400/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Kerugian bersih
                </p>
                <p className="mt-2 text-2xl font-black text-rose-400">$20.1M</p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Pembelajaran
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              Euler menunjukkan bahwa flash loan bukan “peretasan kunci”, melainkan pengganda modal
              instan terhadap bug logika bisnis. Jika satu fungsi mengurangi kolateral tanpa
              invariant solvabilitas, seluruh desain likuidasi bisa dibalik menjadi mesin
              pengurasan pool. Audit modern harus menguji skenario modal tak terbatas dalam satu
              transaksi, termasuk self-liquidation antar akun yang dikendalikan pelaku.
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
