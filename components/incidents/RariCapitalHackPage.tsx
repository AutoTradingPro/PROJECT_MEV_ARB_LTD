import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

const SOURCE_URL = "https://smartcontractshacking.com/hacks/rari-capital-hack-2022";

export default function RariCapitalHackPage() {
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
            Rari Capital Hack (2022) — $80.0M
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Ethereum · 30 April 2022 · Yield aggregator / reentrancy ekosistem Fuse
          </p>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Apa yang terjadi
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Pada <strong className="font-semibold text-[var(--app-fg)]">30 April 2022</strong>,
                beberapa pool Fuse milik Rari Capital (termasuk integrasi Fei) dieksploitasi lewat
                reentrancy yang didanai likuiditas kilat. Tujuh pool terdampak; kerugian yang
                dilaporkan sekitar{" "}
                <strong className="font-semibold text-[var(--app-fg)]">$80 juta</strong>. Peminjaman
                dihentikan untuk memotong kerugian lanjutan.
              </p>
              <p>
                Sumber studi mengklasifikasikan insiden ini sebagai{" "}
                <strong className="font-semibold text-[var(--app-fg)]">ekosistem / reentrancy</strong>{" "}
                pada yield aggregator. Pola yang sama pernah muncul di protokol fork Compound lain
                (termasuk CREAM Lending 2021).
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Akar penyebab teknis
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Fuse memakai fork Compound yang tidak selalu mengikuti pola{" "}
                <strong className="font-semibold text-[var(--app-fg)]">
                  checks-effects-interactions
                </strong>
                . Fungsi pinjam ETH mentransfer dana ke kontrak penerima{" "}
                <strong className="font-semibold text-[var(--app-fg)]">
                  sebelum catatan utang diperbarui
                </strong>
                . Saat ETH masuk, fallback pelaku bisa memanggil{" "}
                <strong className="font-semibold text-[var(--app-fg)]">exitMarket()</strong> di
                Comptroller seolah-olah belum ada utang, lalu menarik kolateral.
              </p>
              <p>
                Rari sempat menambahkan reentrancy guard global pada cToken, tetapi perlindungan itu
                tidak menutup{" "}
                <strong className="font-semibold text-[var(--app-fg)]">exitMarket()</strong>. Pelajaran:
                kunci reentrancy harus mencakup jalur lintas kontrak, bukan hanya fungsi lokal yang
                terlihat “berisiko”.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Detail kasus &amp; protokol
            </h2>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Klasifikasi", "Ekosistem / reentrancy"],
                ["Jenis protokol", "Yield aggregator (Fuse / FeiRari)"],
                ["Bahasa implementasi", "Solidity"],
                ["Jaringan", "Ethereum"],
                ["Tanggal insiden", "30 April 2022"],
                ["Tinjauan keamanan (sumber)", "Quantstamp"],
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
                Secara publik, pelaku memakai flash loan sebagai kolateral di pool Fuse (fork
                Compound yang rentan), meminjam ETH, lalu memanfaatkan jendela sebelum catatan utang
                terbarui untuk keluar dari pasar dan menarik kolateral. Langkah itu diulang di
                beberapa token dan pool (antara lain 8, 18, 27, 127, 144, 146, 156).
              </p>
              <p>
                Flash loan membuat seluruh siklus atomik: pinjam modal besar, eksploitasi celah
                reentrancy, kembalikan pinjaman kilat, sisakan selisih. Ini rekonstruksi insiden
                historis untuk pembelajaran keamanan — bukan panduan untuk meniru serangan.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Dampak &amp; pemulihan
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-rose-400/25 bg-rose-400/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Kerugian terlapor
                </p>
                <p className="mt-2 text-2xl font-black text-rose-400">$80.0M</p>
              </div>
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Pool Fuse terdampak
                </p>
                <p className="mt-2 text-2xl font-black text-emerald-400">7</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Tribe DAO (payung Rari Capital, Fei Protocol, dan protokol terkait) kemudian
              mengesahkan pemungutan suara on-chain untuk mengganti kerugian korban. Laporan
              terkait menyebut niat penggantian penuh atas ~$80 juta.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Pembelajaran
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              Rari Capital menunjukkan bahwa flash loan plus reentrancy pada fork Compound masih
              bisa menguras pool jika transfer ETH terjadi sebelum utang dicatat, dan jika
              exitMarket tidak dilindungi guard yang sama. Audit (misalnya Quantstamp) tidak
              menjamin aman setelah patch parsial. Setiap jalur yang mengubah kolateral atau utang
              harus atomik: catat dulu, baru kirim dana.
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
