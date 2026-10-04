# Catatan keuangan operasional infrastruktur bot

Buku ditutup **30 September 2026** (hari ini). Periode buku: **1 Agustus — 30 September 2026**. Nominal mengikuti struk transaksi perbankan digital (dua desimal, pemisah ribuan titik, desimal koma). Sumber pencatatan kas: `lib/finance/ownerCashbook.ts` (Laporan Keuangan owner); semua angka di bawah sama dengan hasil `buildAugust2026Cashbook()`.

Mata uang buku: **IDR**. Kas awal tercatat: **Rp 0,00**.

## 1. Kas masuk (setoran modal)

| Tanggal | Uraian | IDR |
| --- | --- | ---: |
| 7 Agustus 2026 | Setoran Kas / Modal | Rp 3.000.000,00 |
| 12 Agustus 2026 | Setoran Kas / Modal | Rp 2.000.000,00 |
| 7 September 2026 | Transfer Masuk / Setoran Kas ke Rekening 8640087448 (Mochamad Murtiman) | Rp 2.000.000,00 |
| 18 September 2026 | Transfer Masuk / Setoran Kas — Mochamad Murtiman (BCA), 08:30:42 WIB | Rp 1.500.000,00 |
| 30 September 2026 11:08:00 | m-Transfer BCA BERHASIL ke 8640087448 a.n. MOCHAMAD MURTIMAN (kategori KAS) | Rp 2.000.000,00 |
| **Total kas masuk** | | **Rp 10.500.000,00** |

## 2. Infrastruktur RPC / WSS (struk bluVirtual Card)

| Tanggal | Layanan | Keterangan struk | IDR |
| --- | --- | --- | ---: |
| 23 Agustus 2026 | Web3 Technologies Inc (infrastruktur RPC) | — | Rp 183.000,00 |
| 31 Agustus 2026 | Web3 Technologies Inc (infrastruktur RPC) | — | Rp 183.821,25 |
| 8 September 2026 | Perpanjangan RPC ANKR (Web3 Technologies Inc) | 22:24:58 WIB · No. Ref 0908 2470 1973 | Rp 182.652,98 |
| 12 September 2026 | Blockmachine RPC (cadangan node) | Merchant TAOSTATS · ekuivalen $9,00 | Rp 161.797,50 |
| 13 September 2026 | ANKR RPC/WSS (Web3 Technologies Inc) | a.n. Mochamad Murtiman | Rp 183.020,29 |
| 15 September 2026 | Perpanjangan RPC WSS ANKR (Web3 Technologies Inc) | 15:00:58 WIB · No. Ref 0915 8075 5282 | Rp 184.095,56 |
| 18 September 2026 | QuickNode RPC/WSS (MEV Protection · Ethereum / Arbitrum / Polygon) | 21:59:46 WIB · langganan QuickNode | Rp 373.550,36 |
| **Akumulasi infrastruktur RPC** | | | **Rp 1.451.937,94** |

Kurs tersirat Blockmachine: `$9,00 → Rp 161.797,50` ⇒ **Rp 17.977,50 / USD**.

Porsi harian RPC dihitung dari struk terakhir (QuickNode, 18 September). QuickNode baru punya satu pembayaran, jadi siklusnya memakai default **30 hari**: `373.550,36 ÷ 30 = Rp 12.451,68 / hari`. Vendor lain (ANKR, Blockmachine) tidak dicampur ke siklus ini.

## 3. Langganan software & cloud

| Tanggal | Layanan | Kategori | Metode | Status | IDR |
| --- | --- | --- | --- | --- | ---: |
| 25 September 2026 | Cursor AI (Cursor Usage Mid Aug) | Langganan / Software / AI Tool | Blu Virtual Card (BCA Digital) | **Sudah terbit ke kas** | Rp 372.536,20 |
| 27 September 2026 | Google One / Google AI Plus (400 GB) | Pengeluaran Rutin / Langganan Software & Cloud | — | **Sudah terbit ke kas** | Rp 19.000,00 |
| 30 September 2026 21:46:02 | Cursor AI (Cursor Usage Mid Aug) | Pengeluaran | bluVirtual Card · Debit Online · No. Ref 0930 8602 8480 · kartu 0813 | **Sudah terbit ke kas** | Rp 745.951,55 |

Keterangan Cursor AI 30 September: pembayaran tagihan langganan / penggunaan Cursor Usage Mid Aug, kategori **Pengeluaran**.

## 4. Pengeluaran rutin sampai 30 September 2026

### Harian (run-rate)

| Pos | Aturan | / hari |
| --- | --- | ---: |
| Kuota 8 GB / 24 jam | 1 paket @ Rp 12.000,00 | Rp 12.000,00 |
| Rokok “Gajah Baru” | 2 bungkus @ Rp 12.000,00 | Rp 24.000,00 |
| Snack | 1 bungkus @ Rp 12.000,00 | Rp 12.000,00 |
| Kopi | 2 gelas @ Rp 5.000,00 | Rp 10.000,00 |
| Token listrik (rata-rata) | Rp 22.000,00 setiap 5 hari | Rp 4.400,00 |
| Porsi RPC QuickNode (siklus 30 hari) | struk 18 Sep | Rp 12.451,68 |
| **Run-rate operasional harian** | | **Rp 74.851,68** |

| Pos | Periode | Hari / kali | Total |
| --- | --- | ---: | ---: |
| Kuota 8 GB | 13 Agustus – 30 September | 49 hari | Rp 588.000,00 |
| Rokok “Gajah Baru” | 7 Agustus – 30 September | 55 hari | Rp 1.320.000,00 |
| Snack | 7 Agustus – 30 September | 55 hari | Rp 660.000,00 |
| Kopi | 7 Agustus – 30 September | 55 hari | Rp 550.000,00 |
| Token listrik | 8, 13, 18, 23, 28 Agustus · 2, 7, 12, 17, 22, 27 September | 11 kali | Rp 242.000,00 |
| **Subtotal opex harian + berkala** | | | **Rp 3.360.000,00** |

**Posted 30 September 2026 (hari tutup buku):** kuota + konsumsi Rp 58.000,00 + Cursor AI Rp 745.951,55 + porsi RPC Rp 12.451,68 = **Rp 816.403,23**. Tidak ada jadwal token listrik hari ini (terakhir 27 September, berikutnya 2 Oktober).

### Mingguan (24–30 September 2026)

Opex harian 7 hari (Rp 406.000,00) + token listrik 27 September (Rp 22.000,00) + Google One 27 September (Rp 19.000,00) + Cursor AI 25 September (Rp 372.536,20) + Cursor AI 30 September (Rp 745.951,55). Tidak ada struk RPC dalam minggu ini.

**OpEx mingguan: Rp 1.565.487,75**

### Bulanan berjalan / MTD (1–30 September 2026)

| Pos | IDR |
| --- | ---: |
| Opex harian 30 hari (@ Rp 58.000,00) | Rp 1.740.000,00 |
| Token listrik 2, 7, 12, 17, 22, 27 September | Rp 132.000,00 |
| RPC September (ANKR 8 & 13 & 15, Blockmachine 12, QuickNode 18) | Rp 1.085.116,69 |
| PDAM 9 September (termasuk admin Rp 2.500,00) | Rp 102.500,00 |
| Google One 27 September | Rp 19.000,00 |
| Cursor AI 25 dan 30 September | Rp 1.118.487,75 |
| **OpEx bulan berjalan** | **Rp 4.197.104,44** |

### Akumulasi OpEx wajib (kuota, konsumsi, token, RPC, PDAM, langganan terbit)

`3.360.000,00 + 1.451.937,94 + 102.500,00 + 1.137.487,75` = **Rp 6.051.925,69** sampai 30 September 2026.

## 5. Pengeluaran non-opex

| Pos | Rincian | IDR |
| --- | --- | ---: |
| Mutasi rekening & nota (Agustus) | Indomaret, biaya kartu/adm, pulsa, GoPay/DANA, QR toko, tarikan tunai ATM | Rp 1.331.500,00 |
| Inventaris / hardware | Mouse Bluetooth ROBOT (30 Agustus) | Rp 100.000,00 |
| Pengeluaran pribadi / konsumsi | Belanja pribadi 13 Agustus Rp 128.161,00 · beras 5 kg 9 September Rp 89.000,00 · belanja bulanan 22 September Rp 106.800,00 (rincian di bawah) | Rp 323.961,00 |
| Prive owner | Tarik ATM 9 September | Rp 100.000,00 |
| Deposit exchange | Indodax 20 Agustus Rp 200.736,00 · Tokocrypto 6 September Rp 200.000,00 | Rp 400.736,00 |
| Alokasi modal Trust Wallet ETH (Arbitrum) | 7, 8, 10, 10 September (uji arbitrase) | Rp 600.000,00 |
| **Subtotal non-opex** | | **Rp 2.856.197,00** |

### Belanja bulanan 22 September 2026 — IDM TQ52 DIPONEGORO BOJ

Kategori: **Belanja Bulanan / Kebutuhan Sehari-hari**.

| Rincian | IDR |
| --- | ---: |
| Beli Beras (5 kg) | Rp 98.000,00 |
| Beli Sikat Gigi | Rp 8.800,00 |
| **Total struk** | **Rp 106.800,00** |

## 6. Rekapitulasi modal operasional (buku kas)

| Pos | IDR |
| --- | ---: |
| Kas awal | Rp 0,00 |
| Kas masuk (setoran modal) | Rp 10.500.000,00 |
| Akumulasi OpEx wajib | Rp 6.051.925,69 |
| Pengeluaran non-opex | Rp 2.856.197,00 |
| **Total pengeluaran (semua pos kas keluar)** | **Rp 8.908.122,69** |
| **Saldo akhir buku** | **Rp 1.591.877,31** |

Saldo akhir = kas awal Rp 0,00 + kas masuk − total pengeluaran = `10.500.000,00 − 8.908.122,69 = 1.591.877,31`.

Dengan run-rate Rp 74.851,68 / hari, saldo akhir cukup untuk sekitar **21 hari** operasional, belum termasuk perpanjangan RPC berikutnya.
