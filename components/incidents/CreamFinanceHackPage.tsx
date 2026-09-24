import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

const SOURCE_URL = "https://smartcontractshacking.com/hacks/cream-finance-hack-2021";

export default function CreamFinanceHackPage() {
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
            Cream Finance Hack (2021) — $130M
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Ethereum · 27 Oktober 2021 · Lending / manipulasi oracle share-price
          </p>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Apa yang terjadi
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Pada <strong className="font-semibold text-[var(--app-fg)]">27 Oktober 2021</strong>,
                pelaku memakai likuiditas kilat untuk memanipulasi{" "}
                <strong className="font-semibold text-[var(--app-fg)]">pricePerShare</strong> vault
                Yearn yUSD, yang dipakai Cream lewat{" "}
                <strong className="font-semibold text-[var(--app-fg)]">PriceOracleProxy</strong> untuk
                menilai kolateral. Setelah mengecilkan vault dan menambahkan aset underlying secara
                langsung, pelaku menggandakan harga share yang dilaporkan, menggembungkan kolateral
                crYUSD, lalu meminjam sekitar{" "}
                <strong className="font-semibold text-[var(--app-fg)]">$130 juta</strong> dari pasar
                Cream Ethereum v1.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Akar penyebab teknis
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Flash loan membuat rangkaian itu atomik, tetapi kegagalan intinya adalah{" "}
                <strong className="font-semibold text-[var(--app-fg)]">
                  oracle harga share spot yang bisa dimanipulasi
                </strong>
                . Cream menilai kolateral crYUSD dari{" "}
                <strong className="font-semibold text-[var(--app-fg)]">pricePerShare</strong> vault
                Yearn secara instan, tanpa perlindungan terhadap donasi dan redeem yang mengubah
                rasio dalam transaksi yang sama.
              </p>
              <p>
                Yearn kemudian menyelamatkan sekitar{" "}
                <strong className="font-semibold text-[var(--app-fg)]">$9,42 juta</strong> yang
                didonasikan selama manipulasi — pemulihan parsial, bukan pengembalian dari pelaku.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Detail kasus &amp; protokol
            </h2>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Klasifikasi", "DEX / borrowing and lending"],
                ["Jenis protokol", "Exploit / flash loan attack (oracle)"],
                ["Aset / kontrak terdampak", "CREAM, crYUSD, pasar lending v1"],
                ["Pola serangan", "Oracle manipulation & price manipulation"],
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
                Cream mengandalkan{" "}
                <strong className="font-semibold text-[var(--app-fg)]">pricePerShare</strong> vault
                Yearn yUSD secara instan untuk menilai kolateral crYUSD. Pelaku memakai likuiditas
                kilat untuk membentuk posisi kolateral besar, merebut kembali sebagian besar share
                yUSD agar vault menyusut, lalu mendonasikan aset underlying sehingga harga share yang
                dilaporkan naik tajam.
              </p>
              <p>
                Nilai yang terdistorsi itu menggandakan kolateral semu dan membuka ruang pinjam di
                berbagai pasar lending Cream. Seluruh langkah tertutup dalam satu transaksi atomik.
              </p>
              <p>
                Ini adalah rekonstruksi publik dari insiden historis untuk pembelajaran keamanan —
                bukan panduan untuk meniru serangan.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Dampak &amp; catatan pasca-insiden
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-rose-400/25 bg-rose-400/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Dipinjam dari pasar Cream
                </p>
                <p className="mt-2 text-2xl font-black text-rose-400">$130M</p>
              </div>
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Diselamatkan Yearn (donasi)
                </p>
                <p className="mt-2 text-2xl font-black text-emerald-400">$9.42M</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-500">
              <li>
                12 September 2022 — sumber mencatat 1000 ETH ditukar menjadi 80 BTC dan di-bridge
                lewat protokol REN dari alamat kedua pelaku.
              </li>
              <li>
                23 Maret 2023 — tim Cream membagikan temuan soal dana yang dieksploitasi, termasuk
                keyakinan mereka terkait pencucian di TradeOgre DEX.
              </li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Pembelajaran
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              Cream menunjukkan bahwa oracle yang membaca harga share vault secara spot mudah
              digeser dengan redeem dan donasi di transaksi yang sama. Flash loan hanya
              memperbesar skala; perlindungan yang sehat memakai TWAP, umpan yang tidak
              di-update atomik, dan batas pinjam yang tidak bergantung pada rasio vault yang
              bisa diubah pelaku.
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
