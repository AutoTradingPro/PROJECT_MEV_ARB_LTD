const CYCLE = [
  {
    n: "01",
    title: "Borrow",
    body: "Kontrak memanggil protokol likuiditas dan menarik modal besar tanpa agunan, dengan janji pelunasan di akhir transaksi yang sama.",
  },
  {
    n: "02",
    title: "Execute",
    body: "Dana itu dipakai dalam langkah-langkah berantai: swap, deposit, atau interaksi lain yang mengubah harga, cadangan, atau umpan oracle.",
  },
  {
    n: "03",
    title: "Repay",
    body: "Pokok plus fee protokol dikembalikan ke vault flash loan sebelum transaksi selesai. Sisa selisih menjadi laba (atau kerugian) pelaku.",
  },
  {
    n: "04",
    title: "Atomic Revert",
    body: "Jika pelunasan gagal, EVM membatalkan seluruh langkah. Tidak ada utang tersisa—tetapi dampak harga dan desain protokol tetap bisa dieksploitasi jika logika bisnis lemah.",
  },
];

export default function FlashLoanAttacksArticle() {
  return (
    <article className="relative mx-auto w-full max-w-6xl px-4 pb-12 pt-2">
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
            Keamanan DeFi
          </p>
          <h2 className="mt-3 max-w-3xl text-2xl font-black tracking-tight text-[var(--app-fg)] sm:text-3xl">
            Memahami Flash Loan Attacks &amp; Keamanan DeFi
          </h2>
          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
            Flash loan adalah primitif yang sah di DeFi. Yang berbahaya bukan pinjaman kilat itu
            sendiri, melainkan ketika protokol mengandalkan asumsi harga atau cadangan yang bisa
            diubah dalam satu transaksi atomik. Artikel ini merangkum pola serangan, risiko modal
            tak terbatas, dan siklus teknisnya—sebagai edukasi keamanan, bukan panduan eksploitasi.
          </p>

          <section className="mt-10">
            <h3 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Apa sebenarnya &quot;Flash Loan Attacks&quot;?
            </h3>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Istilah{" "}
                <strong className="font-semibold text-[var(--app-fg)]">flash loan attack</strong>{" "}
                merujuk pada eksploitasi finansial yang memanfaatkan pinjaman tanpa agunan di dalam{" "}
                <strong className="font-semibold text-[var(--app-fg)]">satu atomic transaction</strong>
                . Pelaku meminjam likuiditas sangat besar, menjalankan serangkaian panggilan kontrak,
                lalu mengembalikan dana sebelum blok selesai. Karena semua langkah hidup atau mati
                bersama, mereka tidak perlu modal sendiri yang sebanding dengan skala serangan.
              </p>
              <p>
                Pola yang paling sering muncul adalah{" "}
                <strong className="font-semibold text-[var(--app-fg)]">manipulasi oracle</strong> dan
                distorsi harga spot. Jika protokol membaca harga dari cadangan AMM yang dangkal, atau
                dari umpan yang bisa diubah di transaksi yang sama, flash loan memungkinkan pelaku
                menggeser harga, memicu likuidasi, mint, borrow, atau redeem yang salah nilai, lalu
                menutup posisi sebelum dunia luar &quot;melihat&quot; state sementara itu.
              </p>
              <p>
                Ini bukan peretasan kunci privat, melainkan penyalahgunaan aturan bisnis yang sudah
                tercatat on-chain: protokol mempercayai angka yang masih bisa diubah dalam jendela
                atomik yang sama. Pertahanan yang sehat memakai oracle yang tahan manipulasi (TWAP,
                umpan eksternal yang tidak di-update di tx yang sama), isolasi likuiditas, dan
                pemeriksaan invariant setelah setiap langkah.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h3 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Masalah &quot;Modal Tak Terbatas&quot;
            </h3>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Flash loan{" "}
                <strong className="font-semibold text-[var(--app-fg)]">
                  mendemokratisasi akses ke modal besar
                </strong>
                : siapa pun yang bisa menulis kontrak yang sah dapat meminjam puluhan atau ratusan
                juta dolar tanpa kolateral, selama utang dilunasi di akhir transaksi. Untuk arbitrase
                yang sehat, ini meratakan lapangan: pedagang kecil bisa mengeksekusi selisih harga
                yang sebelumnya hanya terjangkau desk institusi.
              </p>
              <p>
                Sisi sistemiknya berbeda. Desain keamanan yang mengasumsikan &quot;penyerang tidak
                punya cukup uang&quot; runtuh. Batas ekonomi yang dulu melindungi pool kecil, oracle
                spot, atau parameter governance menjadi rapuh jika modal serangan praktis tidak
                terbatas dalam satu blok. Risiko bergeser dari kredit (gagal bayar) ke{" "}
                <strong className="font-semibold text-[var(--app-fg)]">
                  risiko desain protokol
                </strong>
                : invariant yang salah, oracle yang naif, dan kurangnya circuit breaker.
              </p>
              <p>
                Karena revert atomik menghapus utang jika pelunasan gagal, protokol pemberi pinjaman
                kilat sendiri jarang merugi. Yang terpukul adalah protokol di tengah rantai
                eksekusi—lending, vault, atau stablecoin—yang salah menafsirkan state sementara.
                Itulah mengapa audit DeFi modern menguji skenario &quot;modal tak terbatas dalam satu
                transaksi&quot;, bukan hanya skenario saldo attacker di awal blok.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h3 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Cara Kerja Flash Loan
            </h3>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              Siklusnya selalu tertutup dalam satu transaksi. Empat tahap ini yang menentukan apakah
              state akhir valid—atau seluruh jejak dibatalkan:
            </p>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CYCLE.map((step) => (
                <li
                  key={step.n}
                  className="theme-panel-muted rounded-xl border border-slate-800/70 p-4 text-left"
                >
                  <span className="font-mono text-[11px] font-semibold tracking-widest text-amber-300">
                    {step.n}
                  </span>
                  <h4 className="mt-2 text-sm font-bold text-[var(--app-fg)]">{step.title}</h4>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-10">
            <h3 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Mengapa &quot;Flash Loan Attacks&quot; berbahaya?
            </h3>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Skala dan kecepatannya yang membuat serangan ini merusak. Dalam{" "}
                <strong className="font-semibold text-[var(--app-fg)]">satu transaksi—hitungan detik</strong>
                , cadangan pool bisa dikuras secara massal: harga spot terdistorsi, posisi lending
                dilikuidasi berantai, dan vault yang mengandalkan oracle naif mengeluarkan aset jauh
                di bawah nilai wajar. Tidak ada jendela operasional untuk pause manual sebelum
                kerusakan tercatat on-chain.
              </p>
              <p>
                Bagi protokol, dampaknya bisa setara{" "}
                <strong className="font-semibold text-[var(--app-fg)]">kebangkrutan tiba-tiba</strong>
                : cadangan asuransi habis, token tata kelola anjlok, dan fungsi mint/borrow berhenti
                karena invariant dilanggar.{" "}
                <strong className="font-semibold text-[var(--app-fg)]">Liquidity providers</strong>{" "}
                menanggung kerugian impermanen ekstrem atau bad debt yang tidak pernah mereka setujui
                secara eksplisit—mereka hanya menaruh likuiditas, lalu melihat TVL menguap setelah satu
                blok.
              </p>
              <p>
                Efeknya jarang berhenti di satu aplikasi. Harga yang patah memicu{" "}
                <strong className="font-semibold text-[var(--app-fg)]">kepanikan pasar</strong>
                : withdrawal massal di protokol tetangga, depeg stablecoin, dan spiral likuidasi di
                pasar yang memakai umpan harga yang sama. Itulah mengapa flash loan attack diperlakukan
                sebagai risiko sistemik DeFi, bukan insiden desk yang terisolasi.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h3 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Mengapa penyerang menyukai flash loan?
            </h3>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Daya tarik utamanya adalah{" "}
                <strong className="font-semibold text-[var(--app-fg)]">tanpa risiko modal pribadi</strong>
                . Pelaku tidak perlu mengunci tabungan sendiri seukuran target serangan. Mereka
                meminjam likuiditas protokol, mengeksekusi logika, lalu mengembalikan pokok plus fee.
                Jika langkah di tengah gagal menghasilkan selisih yang cukup, transaksi{" "}
                <strong className="font-semibold text-[var(--app-fg)]">dibatalkan secara atomik</strong>
                —kerugian finansial di on-chain praktis nol, selain biaya gas yang terbakar.
              </p>
              <p>
                Tidak ada{" "}
                <strong className="font-semibold text-[var(--app-fg)]">agunan fisik atau kolateral</strong>{" "}
                yang bisa disita jika rencana gagal. Syaratnya hanya pelunasan di akhir transaksi yang
                sama. Kombinasi itu mengubah serangan menjadi eksperimen berbiaya rendah: coba, revert,
                sesuaikan parameter, coba lagi—tanpa meninggalkan utang atau aset yang tersangkut.
              </p>
              <p>
                Ditambah{" "}
                <strong className="font-semibold text-[var(--app-fg)]">kecepatan eksekusi kilat</strong>
                . Semua langkah selesai dalam satu blok, sebelum oracle eksternal, tim keamanan, atau
                governance sempat bereaksi. Bagi penyerang, flash loan adalah pengganda modal instan
                dengan opsi &quot;undo&quot; bawaan; bagi protokol yang lemah, itu jendela yang terlalu
                sempit untuk dipertahankan dengan asumsi ekonomi tradisional.
              </p>
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}
