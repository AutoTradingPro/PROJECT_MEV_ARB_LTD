import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

const SOURCE_URL = "https://smartcontractshacking.com/hacks/cream-lending-hack-2021";

export default function CreamLandingHackPage() {
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
            CREAM Lending Hack (2021) — $130.0M
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Ethereum · 27 Oktober 2021 · Lending oracle / manipulasi harga share vault
          </p>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Apa yang terjadi
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Pasar lending CREAM Finance Ethereum v1 dieksploitasi pada{" "}
                <strong className="font-semibold text-[var(--app-fg)]">27 Oktober 2021</strong> senilai
                sekitar{" "}
                <strong className="font-semibold text-[var(--app-fg)]">$130 juta</strong>. Serangan
                menggabungkan likuiditas kilat dengan manipulasi harga share vault yUSD yang diandalkan
                oracle kolateral CREAM. Pelaku membuat kolateral yUSD tampak lebih bernilai, lalu
                meminjam hampir seluruh likuiditas v1 yang tersedia dalam satu transaksi.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Akar penyebab teknis
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Penilaian kolateral CREAM mempercayai{" "}
                <strong className="font-semibold text-[var(--app-fg)]">
                  nilai tukar vault yUSD yang bisa dimanipulasi
                </strong>
                , sementara supply rekursif tanpa batas memperkuat nilai kolateral hasil distorsi
                itu. Transfer langsung token underlying ke vault mengubah{" "}
                <strong className="font-semibold text-[var(--app-fg)]">pricePerShare</strong>, dan
                dengan itu mengubah nilai oracle yang dipakai CREAM.
              </p>
              <p>
                Pelajaran untuk protokol lending: batasi kolateral dari share vault yang bisa
                dikomposisi, pakai harga yang tahan manipulasi, dan kekang jalur supply rekursif
                yang bisa memperbesar kesalahan valuasi sesaat.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Detail kasus &amp; protokol
            </h2>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Klasifikasi", "Lending oracle / manipulasi harga share vault"],
                ["Jenis protokol", "Lending"],
                ["Kartu di portal", "Cream Landing"],
                ["Bahasa implementasi", "Solidity"],
                ["Jaringan", "Ethereum"],
                ["Tanggal insiden", "27 Oktober 2021"],
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
                Pelaku memakai dua akun yang dikendalikan sendiri serta likuiditas kilat dari
                MakerDAO dan Aave. Satu akun membuat yUSD dan menyetorkannya ke CREAM, sementara
                akun lain memakai kolateral ETH untuk meminjam yUSD secara rekursif dan
                mengirimkannya kembali, sehingga kolateral crYUSD yang tercatat pada akun pertama
                membesar.
              </p>
              <p>
                Pelaku kemudian menarik token Yearn 4-Curve dari vault yUSD dan mentransfer sekitar{" "}
                <strong className="font-semibold text-[var(--app-fg)]">$8 juta</strong> underlying
                yCrv kembali ke vault itu. Langkah itu menggandakan{" "}
                <strong className="font-semibold text-[var(--app-fg)]">pricePerShare</strong> yUSD,
                dan oracle hibrida CREAM menggandakan nilai kolateral yang dilaporkan. Akun itu lalu
                meminjam sisa likuiditas, mengembalikan pinjaman sementara, dan menyisakan selisihnya.
              </p>
              <p>
                Ini adalah rekonstruksi publik dari insiden historis untuk pembelajaran keamanan —
                bukan panduan untuk meniru serangan.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Dampak yang dilaporkan
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-rose-400/25 bg-rose-400/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Likuiditas v1 yang dipinjam
                </p>
                <p className="mt-2 text-2xl font-black text-rose-400">$130.0M</p>
              </div>
              <div className="rounded-xl border border-slate-800/70 bg-[var(--surface)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Transfer underlying ke vault
                </p>
                <p className="mt-2 text-2xl font-black text-[var(--app-fg)]">~$8M</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Riwayat tinjauan keamanan yang disebut sumber: Trail of Bits. Pola serangan: oracle
              manipulation &amp; price manipulation.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Pembelajaran
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              Cream Landing (CREAM Lending) memperjelas bahwa oracle share vault plus supply
              rekursif tanpa batas bisa menggandakan kesalahan harga sesaat menjadi pengurasan
              pasar. Flash loan dari Maker dan Aave hanya modal sementara; yang fatal adalah
              mempercayai pricePerShare yang berubah karena transfer underlying dalam transaksi
              yang sama.
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
