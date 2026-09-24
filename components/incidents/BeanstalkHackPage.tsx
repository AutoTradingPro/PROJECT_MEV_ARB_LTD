import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

const SOURCE_URL = "https://smartcontractshacking.com/hacks/beanstalk-hack-2022";

export default function BeanstalkHackPage() {
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
            Beanstalk Governance Hack (2022) — $181M
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Ethereum · 17 April 2022 · DAO governance / hak suara flash-loan
          </p>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Apa yang terjadi
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Sistem tata kelola Beanstalk di Ethereum dieksploitasi pada{" "}
                <strong className="font-semibold text-[var(--app-fg)]">17 April 2022</strong> melalui
                hak suara sementara yang didanai likuiditas kilat. Analisis keamanan memperkirakan
                dampak nilai protokol kotor sekitar{" "}
                <strong className="font-semibold text-[var(--app-fg)]">$181 juta</strong>, sementara
                pengungkapan Beanstalk sendiri menyebut sekitar{" "}
                <strong className="font-semibold text-[var(--app-fg)]">$77 juta</strong> aset
                non-BEAN milik pengguna yang diambil. Kedua angka memakai ukuran berbeda dan{" "}
                <strong className="font-semibold text-[var(--app-fg)]">tidak dijumlahkan</strong>.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Akar penyebab teknis
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Deposit ke Silo saat itu langsung memberi{" "}
                <strong className="font-semibold text-[var(--app-fg)]">kekuatan suara Stalk</strong>.
                Jalur eksekusi darurat memungkinkan mayoritas dua pertiga yang bersifat sementara
                untuk mengotorisasi kode proposal{" "}
                <strong className="font-semibold text-[var(--app-fg)]">
                  sebelum modal suara pinjaman harus dikembalikan
                </strong>
                .
              </p>
              <p>
                Pelajaran utamanya: hak tata kelola tidak boleh dihitung dari saldo yang bisa
                dipinjam dan dikembalikan dalam satu transaksi. Voting power butuh periode vesting,
                snapshot yang tidak bisa dibeli secara atomik, atau penundaan eksekusi proposal.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Detail kasus &amp; protokol
            </h2>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Klasifikasi", "DAO governance / hak suara flash-loan"],
                ["Jenis protokol", "Algo-stables"],
                ["Aset / kontrak terdampak", "BEAN dan aset non-BEAN di protokol"],
                ["Bahasa implementasi", "Solidity"],
                ["Jaringan", "Ethereum"],
                ["Tanggal insiden", "17 April 2022"],
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
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <li>
                Pelaku mengajukan proposal tata kelola berbahaya sebelum transaksi eksploitasi.
              </li>
              <li>
                Lebih dari{" "}
                <strong className="font-semibold text-[var(--app-fg)]">$1 miliar</strong> likuiditas
                kilat membiayai posisi LP yang disetor ke Silo, sehingga pelaku menguasai lebih dari
                dua pertiga kekuatan suara Stalk.
              </li>
              <li>
                <strong className="font-semibold text-[var(--app-fg)]">emergencyCommit()</strong>{" "}
                mengeksekusi BIP-18. Logika yang disuplai pelaku berjalan lewat jalur eksekusi
                istimewa Diamond dan menarik aset protokol.
              </li>
              <li>
                Pelaku membongkar posisi dan mengembalikan pinjaman kilat dalam transaksi yang sama.
              </li>
            </ol>
            <p className="mt-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              Beanstalk kemudian menghapus mekanisme tata kelola yang terkompromi. Pengungkapannya
              memisahkan sekitar $77 juta aset non-BEAN yang diambil dari estimasi dampak lebih luas
              sebesar $181 juta.
            </p>
            <p className="mt-3 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              Ini adalah rekonstruksi publik dari insiden historis untuk pembelajaran keamanan —
              bukan panduan untuk meniru serangan.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Dampak yang dilaporkan
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-rose-400/25 bg-rose-400/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Dampak nilai protokol (estimasi)
                </p>
                <p className="mt-2 text-2xl font-black text-rose-400">$181M</p>
              </div>
              <div className="rounded-xl border border-slate-800/70 bg-[var(--surface)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Aset non-BEAN pengguna (disclosure)
                </p>
                <p className="mt-2 text-2xl font-black text-[var(--app-fg)]">$77M</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Riwayat tinjauan keamanan yang disebut sumber: Omniscia, Trail of Bits, dan Halborn.
              Audit sebelumnya tidak mencegah celah tata kelola yang bisa dibeli secara atomik.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Pembelajaran
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              Beanstalk menunjukkan bahwa flash loan bisa membeli mayoritas DAO dalam satu blok jika
              deposit langsung menjadi suara dan eksekusi darurat tidak menunggu periode
              komitmen. Flash liquidity di sini bukan bug EVM, melainkan pengganda hak tata kelola
              yang tidak dirancang untuk modal tak terbatas dalam satu transaksi.
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
