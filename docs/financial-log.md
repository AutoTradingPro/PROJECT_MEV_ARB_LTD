# Catatan keuangan operasional infrastruktur bot

Buku ditutup **13 September 2026** (hari ini). Nominal mengikuti struk transaksi perbankan digital (dua desimal, pemisah ribuan titik, desimal koma). Sumber pencatatan kas: `lib/finance/ownerCashbook.ts` (Laporan Keuangan owner).

Mata uang buku: **IDR**. Kas awal tercatat: **Rp 0,00**.

## 1. Rincian biaya riil RPC / WSS (struk bluVirtual Card)

| Tanggal | Layanan | Merchant / pihak | Pembayar | Instrumen | IDR (struk) | USD (struk) |
| --- | --- | --- | --- | --- | ---: | ---: |
| 12 September 2026 | Blockmachine RPC (cadangan node) | TAOSTATS | Operasional bot | bluVirtual Card | Rp 161.797,50 | $9,00 |
| 13 September 2026 | ANKR RPC/WSS (primer) | WEB3 TECHNOLOGIES INC | Mochamad Murtiman | bluVirtual Card | Rp 183.020,29 | — |
| **Subtotal struk baru** | | | | | **Rp 344.817,79** | |

Cek aritmetika struk: `161.797,50 + 183.020,29 = 344.817,79`.

Kurs tersirat Blockmachine: `$9,00 → Rp 161.797,50` ⇒ **Rp 17.977,50 / USD**.

### Riwayat langganan RPC yang sudah ada di buku (tidak diganti)

Pembayaran lama tetap tercatat agar rekap modal tidak kehilangan jejak:

| Tanggal | Uraian | IDR |
| --- | --- | ---: |
| 23 Agustus 2026 | Web3 Technologies Inc (infrastruktur RPC) | Rp 183.000,00 |
| 31 Agustus 2026 | Web3 Technologies Inc (infrastruktur RPC) | Rp 183.821,25 |
| 8 September 2026 | Perpanjangan RPC ANKR (Web3 Technologies Inc) · ref 0908 2470 1973 | Rp 182.652,98 |
| 12 September 2026 | Blockmachine RPC · TAOSTATS | Rp 161.797,50 |
| 13 September 2026 | ANKR RPC/WSS · WEB3 TECHNOLOGIES INC | Rp 183.020,29 |
| **Akumulasi infrastruktur RPC** | | **Rp 894.292,02** |

Siklus amortisasi ANKR dihitung dari jarak bayar vendor yang sama (8 → 13 September = **5 hari**). Porsi harian ANKR terakhir: `183.020,29 ÷ 5 = Rp 36.604,06`. Blockmachine tidak dicampur ke siklus ANKR.

## 2. Pengeluaran rutin sampai 13 September 2026

### Harian (run-rate)

| Pos | Aturan | / hari |
| --- | --- | ---: |
| Kuota 8 GB / 24 jam | 1 paket @ Rp 12.000,00 | Rp 12.000,00 |
| Rokok “Gajah Baru” | 2 bungkus @ Rp 12.000,00 | Rp 24.000,00 |
| Snack | 1 bungkus @ Rp 12.000,00 | Rp 12.000,00 |
| Kopi | 2 gelas @ Rp 5.000,00 | Rp 10.000,00 |
| Token listrik (rata-rata) | Rp 22.000,00 setiap 5 hari | Rp 4.400,00 |
| Porsi RPC ANKR (siklus 5 hari) | struk 13 Sep | Rp 36.604,06 |
| **Run-rate operasional harian** | | **Rp 99.004,06** |

Kuota dihitung 13 Agustus–13 September (**32 hari** = Rp 384.000,00). Konsumsi (rokok, snack, kopi) 7 Agustus–13 September (**38 hari**). Token listrik: 8, 13, 18, 23, 28 Agustus dan 2, 7, 12 September (**8 kali** = Rp 176.000,00).

**Posted 13 September 2026 (hari tutup buku):** kuota + konsumsi + struk ANKR + porsi siklus RPC = **Rp 277.624,35**.

### Mingguan (7–13 September 2026)

Termasuk kuota/konsumsi 7 hari, token 7 & 12 Sep, PDAM 9 Sep (Rp 102.500,00 termasuk admin), ANKR 8 Sep, Blockmachine 12 Sep, ANKR 13 Sep.

**OpEx mingguan: Rp 1.079.970,77**

### Bulanan berjalan / MTD (1–13 September 2026)

Sama seperti mingguan plus opex harian 1–6 September dan token 2 September.

**OpEx bulan berjalan: Rp 1.449.970,77**

### Akumulasi OpEx wajib (kuota, konsumsi, token, RPC, PDAM)

**Rp 3.304.792,02** sampai 13 September 2026.

Langganan Google One / Google AI Plus (Rp 19.000,00 / bulan) **belum terbit ke kas** (jadwal berikutnya 27 September 2026).

## 3. Rekapitulasi modal operasional (buku kas)

| Pos | IDR |
| --- | ---: |
| Kas masuk (setoran modal) | Rp 7.000.000,00 |
| Total pengeluaran (semua pos kas keluar) | Rp 6.054.189,02 |
| Saldo akhir buku | Rp 945.810,98 |
| Subtotal struk RPC baru (12–13 Sep) | Rp 344.817,79 |
| Akumulasi seluruh RPC | Rp 894.292,02 |

Saldo akhir = kas awal Rp 0,00 + kas masuk − total pengeluaran.
