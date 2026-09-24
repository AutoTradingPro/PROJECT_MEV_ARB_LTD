const STEPS = [
  {
    n: "01",
    title: "Deteksi Peluang",
    body: "Bot cerdas kami memindai perbedaan harga aset (misalnya ETH atau USDC) di berbagai bursa terdesentralisasi secara real-time.",
  },
  {
    n: "02",
    title: "Eksekusi Kilat",
    body: "Begitu peluang yang menguntungkan ditemukan, kontrak pintar (smart contract) kami secara otomatis meminjam dana dari Vault (seperti Balancer/Aave).",
  },
  {
    n: "03",
    title: "Penyelesaian & Profit",
    body: "Kontrak melakukan jual-beli secara simultan, melunasi pinjaman seketika, dan menyisakan keuntungan bersih langsung ke brankas akun Anda.",
  },
];

const ADVANTAGES = [
  {
    title: "Tanpa Risiko Likuiditas Modal Pribadi",
    body: "Anda tidak perlu merogoh kocek jutaan dolar untuk menjadi trader skala besar. Modal jutaan didapatkan dari likuiditas protokol, sehingga risiko kehilangan tabungan pribadi akibat fluktuasi pasar dapat dieliminasi.",
  },
  {
    title: "Keamanan Transaksi Atomik",
    body: "Berkat teknologi blockchain, tidak ada risiko gagal bayar yang merugikan di tengah jalan. Jika transaksi tidak menghasilkan profit untuk menutup biaya gas dan pinjaman, transaksi otomatis dibatalkan (revert).",
  },
  {
    title: "Kecepatan dan Otomasi Penuh",
    body: "Seluruh proses berjalan secara algoritmik melalui kode kontrak pintar, menghilangkan faktor emosi manusia dan mengeksekusi peluang dalam hitungan milidetik.",
  },
  {
    title: "Pendapatan Pasif Berbasis Kinerja",
    body: "Dengan infrastruktur yang aman dan fitur perlindungan darurat (rescue funds), sistem kami memastikan operasional berjalan efisien dan transparan bagi pengguna.",
  },
];

export default function FlashloanArticle() {
  return (
    <article className="relative mx-auto w-full max-w-6xl px-4 pb-4 pt-2">
      <div className="theme-panel relative overflow-hidden rounded-2xl border border-slate-800/80">
        <div
          className="pointer-events-none absolute inset-x-4 top-4 h-40 rounded-2xl opacity-50"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 8% 0%, rgba(251,191,36,0.10), transparent 60%), radial-gradient(ellipse 50% 70% at 96% 20%, rgba(56,189,248,0.08), transparent 55%)",
          }}
        />

        <div className="relative px-5 py-8 sm:px-8 sm:py-10 md:px-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300/90">
            Edukasi DeFi
          </p>
          <h2 className="mt-3 max-w-3xl text-2xl font-black tracking-tight text-[var(--app-fg)] sm:text-3xl">
            Mengenal Flashloan Arbitrage: Cara Kerja dan Keunggulan Keuangan
            Desentralisasi (DeFi)
          </h2>
          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
            Di dalam ekosistem Keuangan Desentralisasi (DeFi) yang bergerak sangat cepat, peluang
            profit sering kali muncul dalam hitungan detik. Salah satu strategi tercanggih dan paling
            diminati oleh para trader modern adalah{" "}
            <strong className="font-semibold text-[var(--app-fg)]">Flashloan Arbitrage</strong>{" "}
            (Arbitrase Pinjaman Kilat).
          </p>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
            Bagi pengunjung baru, konsep ini mungkin terdengar rumit atau futuristik. Namun, pada
            praktiknya, strategi ini merevolusi cara trader memanfaatkan perbedaan harga tanpa harus
            mempertaruhkan modal pribadi yang besar.
          </p>

          <section className="mt-10">
            <h3 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Apa itu Flashloan Arbitrage?
            </h3>
            <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              <p>
                Secara sederhana,{" "}
                <strong className="font-semibold text-[var(--app-fg)]">Flash Loan</strong> adalah
                jenis pinjaman khusus dalam dunia kripto di mana seorang trader dapat meminjam{" "}
                <strong className="font-semibold text-[var(--app-fg)]">
                  modal dalam jumlah besar (tanpa batasan agunan/kolateral fisik)
                </strong>{" "}
                dari protokol penyedia likuiditas (seperti Aave atau Balancer), dengan syarat:{" "}
                <strong className="font-semibold text-[var(--app-fg)]">
                  pinjaman tersebut harus dipinjam dan dikembalikan dalam satu blok transaksi yang
                  sama (atomic transaction).
                </strong>
              </p>
              <p>
                Jika dalam satu blok transaksi tersebut peminjam gagal mengembalikan dana beserta
                bunga kecilnya, maka seluruh transaksi akan dibatalkan (
                <em className="not-italic text-sky-300/90">revert</em>) secara otomatis oleh sistem
                blockchain, seolah-olah tidak pernah terjadi apa-apa.
              </p>
              <p>
                Sementara itu,{" "}
                <strong className="font-semibold text-[var(--app-fg)]">Arbitrase</strong> adalah
                strategi meraup keuntungan dengan cara membeli aset di bursa (
                <em className="not-italic text-[var(--app-fg)]">exchange</em> atau{" "}
                <em className="not-italic text-[var(--app-fg)]">liquidity pool</em>) yang harganya
                lebih murah, lalu detik itu juga menjualnya di tempat lain yang harganya lebih tinggi.
              </p>
              <p>
                Ketika keduanya digabungkan,{" "}
                <strong className="font-semibold text-[var(--app-fg)]">Flashloan Arbitrage</strong>{" "}
                adalah teknik mengeksekusi perdagangan arbitrase lintas pasar menggunakan{" "}
                <strong className="font-semibold text-[var(--app-fg)]">modal pinjaman kilat</strong>.
                Trader dapat meminjam ribuan hingga jutaan dolar, mencari selisih harga antar-DEX
                (Decentralized Exchange), mengantongi selisih profitnya, lalu melunasi pinjaman
                pokoknya—semuanya terjadi secara instan dalam satu kedipan mata (satu transaksi
                blockchain).
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h3 className="text-lg font-bold tracking-tight text-[var(--app-fg)] sm:text-xl">
              Bagaimana Alur Kerjanya di Platform Kami?
            </h3>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--muted)] sm:text-base">
              Platform kami dirancang untuk mengotomatisasi proses kompleks ini secara aman dan
              transparan:
            </p>
            <ol className="mt-6 grid gap-3 md:grid-cols-3">
              {STEPS.map((step) => (
                <li
                  key={step.n}
                  className="theme-panel-muted rounded-xl border border-slate-800/70 p-4 text-left"
                >
                  <span className="font-mono text-[11px] font-semibold tracking-widest text-sky-400">
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
              Keunggulan Utama Flashloan Arbitrage
            </h3>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--muted)] sm:text-base">
              Mengapa strategi ini menjadi standar emas bagi trader profesional di era Web3? Berikut
              adalah kelebihannya:
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {ADVANTAGES.map((item) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-slate-800/70 bg-[var(--surface)] p-4"
                >
                  <h4 className="text-sm font-bold text-[var(--app-fg)]">{item.title}</h4>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">{item.body}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </article>
  );
}
