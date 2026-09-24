import { stableWeiToUsd } from "@/lib/bot/configUnits";
import { AAVE_FLASH_FEE_PCT } from "@/lib/bot/constants";
import { readBotState } from "@/lib/bot/store";
import type { TradeRecord } from "@/lib/bot/types";
import { listUsers, type StoredUser } from "@/lib/db";
import { formatFinanceIdr } from "@/lib/finance/format";
import { buildAugust2026Cashbook, CASHBOOK_AS_OF } from "@/lib/finance/ownerCashbook";
import { FINANCE_POLICY, type FinancePeriodId } from "@/lib/finance/policy";
import { inFinanceWindow, resolveFinanceWindow } from "@/lib/finance/periods";
import type { FinanceAuditEvent, FinanceLine, FinancialReport } from "@/lib/finance/types";

function roundUsd(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function isProTier(tier: StoredUser["tier"]): boolean {
  return tier === "pro-1" || tier === "pro-2" || tier === "pro-3";
}

function isProTrade(trade: TradeRecord): boolean {
  const pct = trade.trace?.protocolFeePct;
  if (typeof pct === "number" && Number.isFinite(pct)) {
    return pct < AAVE_FLASH_FEE_PCT.free - 0.01;
  }
  return false;
}

function tradeProfitUsd(trade: TradeRecord): number {
  try {
    return stableWeiToUsd(trade.netProfitWei || "0");
  } catch {
    return 0;
  }
}

function tradeGasUsd(trade: TradeRecord): number {
  try {
    return stableWeiToUsd(trade.trace?.gasCostWei || "0");
  } catch {
    return 0;
  }
}

function custodialOf(user: StoredUser): number {
  return user.mainBalance + user.affiliateBalance + user.stakedBalance;
}

function payableOf(user: StoredUser): number {
  return user.mainBalance + user.affiliateBalance;
}

export async function buildFinancialReport(period: FinancePeriodId): Promise<FinancialReport> {
  const { start, end, label } = resolveFinanceWindow(period);
  const users = listUsers();
  const bot = await readBotState();
  const trades = bot.trades || [];
  const success = trades.filter((trade) => trade.outcome === "success");
  const periodTrades = success.filter((trade) => inFinanceWindow(trade.at, start, end));
  const priorTrades = success.filter((trade) => new Date(trade.at).getTime() < start.getTime());

  const share = FINANCE_POLICY.platformProfitSharePct / 100;

  const feeFrom = (list: TradeRecord[]) =>
    list.filter(isProTrade).reduce((sum, trade) => sum + tradeProfitUsd(trade) * share, 0);

  const gasFrom = (list: TradeRecord[]) => list.reduce((sum, trade) => sum + tradeGasUsd(trade), 0);

  const tipFrom = (list: TradeRecord[]) =>
    list.reduce((sum, trade) => {
      const net = tradeProfitUsd(trade);
      const gas = tradeGasUsd(trade);
      const tipPct = (bot.config?.minerTipPct ?? FINANCE_POLICY.minerTipPct) / 100;
      const grossProxy = net + gas;
      return sum + grossProxy * tipPct;
    }, 0);

  const revenuePeriod = roundUsd(feeFrom(periodTrades));
  const gasPeriod = roundUsd(gasFrom(periodTrades));
  const tipPeriod = roundUsd(tipFrom(periodTrades));
  const opexPeriod = roundUsd(gasPeriod + tipPeriod);
  const netIncome = roundUsd(revenuePeriod - opexPeriod);
  const retainedPrior = roundUsd(feeFrom(priorTrades) - gasFrom(priorTrades) - tipFrom(priorTrades));

  const vaultCustodial = roundUsd(users.reduce((sum, user) => sum + custodialOf(user), 0));
  const userPayables = roundUsd(users.reduce((sum, user) => sum + payableOf(user), 0));
  const stakingLiab = roundUsd(users.reduce((sum, user) => sum + user.stakedBalance, 0));
  const treasury = roundUsd(Math.max(0, retainedPrior + netIncome));
  const totalAssets = roundUsd(vaultCustodial + treasury);
  const totalLiab = roundUsd(userPayables + stakingLiab);
  const totalEquity = roundUsd(treasury);
  const balanced = Math.abs(totalAssets - (totalLiab + totalEquity)) < 0.05;

  const newUsers = users.filter((user) => inFinanceWindow(user.registeredAt, start, end));
  const depositIn = roundUsd(newUsers.reduce((sum, user) => sum + custodialOf(user), 0));
  const openingCustodial = roundUsd(
    users
      .filter((user) => new Date(user.registeredAt).getTime() < start.getTime())
      .reduce((sum, user) => sum + custodialOf(user), 0)
  );
  const openingCash = roundUsd(openingCustodial + Math.max(0, retainedPrior));
  const operatingNet = roundUsd(revenuePeriod - opexPeriod);
  const netChange = roundUsd(operatingNet + depositIn);
  const closingCash = roundUsd(vaultCustodial + treasury);

  const proUsers = users.filter((user) => isProTier(user.tier));
  const stakingUsers = users.filter((user) => user.stakingStatus === "active" || user.stakedBalance > 0);
  const proTrades = periodTrades.filter(isProTrade);

  const incomeRevenue: FinanceLine[] = [
    {
      code: "4000",
      label: "Pendapatan profit sharing Mode Pro",
      amountUsd: revenuePeriod,
      note: `${FINANCE_POLICY.platformProfitSharePct}% dari laba bersih eksekusi Pro`,
    },
    {
      code: "4100",
      label: "Pendapatan lain-lain",
      amountUsd: 0,
      note: "Tidak ada biaya langganan terpisah pada periode ini",
      emphasis: "muted",
    },
  ];
  const incomeExpenses: FinanceLine[] = [
    {
      code: "5100",
      label: "Beban gas admin / jaringan",
      amountUsd: gasPeriod,
      note: "Akumulasi biaya gas transaksi sukses (Rp)",
    },
    {
      code: "5200",
      label: "Beban validator tip",
      amountUsd: tipPeriod,
      note: `Estimasi ${FINANCE_POLICY.minerTipPct}% dari gross proxy`,
    },
  ];

  const auditLog: FinanceAuditEvent[] = [
    ...newUsers.map((user) => ({
      at: user.registeredAt,
      category: "user" as const,
      title: `Registrasi ${user.username}`,
      detail: `${user.email} · tier ${user.tier} · vault ${formatFinanceIdr(custodialOf(user))}`,
    })),
    ...periodTrades.slice(0, 40).map((trade) => ({
      at: trade.at,
      category: "trade" as const,
      title: `${trade.outcome === "success" ? "Eksekusi sukses" : "Eksekusi"} ${trade.pair}`,
      detail: `${trade.route} · net ${formatFinanceIdr(tradeProfitUsd(trade))} · ${isProTrade(trade) ? "Pro" : "non-Pro"} · ${trade.txHash || "tanpa hash"}`,
    })),
    {
      at: end.toISOString(),
      category: "policy",
      title: `Kebijakan ${FINANCE_POLICY.policyVersion}`,
      detail: `Basis ${FINANCE_POLICY.basis} · mata uang ${FINANCE_POLICY.functionalCurrency} · share Pro ${FINANCE_POLICY.platformProfitSharePct}%`,
    },
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const cashbook = buildAugust2026Cashbook(0);
  const generatedAt = period === "aug2026" ? end.toISOString() : new Date().toISOString();
  const cards =
    period === "aug2026"
      ? [
          {
            label: "Total Kas Masuk",
            value: formatFinanceIdr(cashbook.totalInflowIdr),
            hint: "Setoran kas / modal (buku kas owner)",
          },
          {
            label: "Total Pengeluaran",
            value: formatFinanceIdr(cashbook.totalOutflowIdr),
            hint: "Mutasi, nota, inventaris, belanja pribadi, prive, deposit, alokasi Trust Wallet, infrastruktur RPC, utilitas PDAM, kuota, token listrik, dan konsumsi harian",
          },
          {
            label: "Saldo Akhir",
            value: formatFinanceIdr(cashbook.closingIdr),
            hint: `Kas awal ${formatFinanceIdr(cashbook.openingIdr)} + masuk − keluar`,
          },
          {
            label: "Ekuitas owner",
            value: formatFinanceIdr(totalEquity),
            hint: "Laba ditahan platform (buku operasional)",
          },
        ]
      : [
          { label: "Pendapatan periode", value: formatFinanceIdr(revenuePeriod), hint: "Profit sharing Pro" },
          { label: "Laba bersih", value: formatFinanceIdr(netIncome), hint: "Setelah gas + tip" },
          { label: "Aset vault custodial", value: formatFinanceIdr(vaultCustodial), hint: "Deposit + staking user" },
          { label: "Ekuitas owner", value: formatFinanceIdr(totalEquity), hint: "Laba ditahan platform" },
        ];

  return {
    generatedAt,
    period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    periodLabel: label,
    currency: "IDR (Rp)",
    policyVersion: FINANCE_POLICY.policyVersion,
    cards,
    income: {
      revenue: incomeRevenue,
      expenses: incomeExpenses,
      grossProfitUsd: revenuePeriod,
      netIncomeUsd: netIncome,
    },
    balance: {
      assets: [
        {
          code: "1100",
          label: "Kas & setara kas vault custodial",
          amountUsd: vaultCustodial,
          note: "Saldo utama + affiliate + staking user",
        },
        {
          code: "1200",
          label: "Kas operasional platform (treasury)",
          amountUsd: treasury,
          note: "Akumulasi fee Pro setelah beban",
        },
      ],
      liabilities: [
        {
          code: "2100",
          label: "Liabilitas saldo / withdraw user",
          amountUsd: userPayables,
          note: "Saldo utama + affiliate yang dapat ditarik",
        },
        {
          code: "2200",
          label: "Liabilitas staking (dana terkunci)",
          amountUsd: stakingLiab,
          note: `APR ${FINANCE_POLICY.stakingAprPct}% · lock ${FINANCE_POLICY.stakingLockDays} hari`,
        },
      ],
      equity: [
        {
          code: "3100",
          label: "Modal disetor owner",
          amountUsd: 0,
          note: "Belum ada setoran modal tercatat",
          emphasis: "muted",
        },
        {
          code: "3200",
          label: "Laba ditahan",
          amountUsd: totalEquity,
          note: "Akumulasi laba bersih platform",
        },
      ],
      totalAssetsUsd: totalAssets,
      totalLiabilitiesUsd: totalLiab,
      totalEquityUsd: totalEquity,
      balanced,
    },
    cashflow: {
      operating: [
        {
          code: "CFO-01",
          label: "Kas masuk dari profit sharing eksekusi Pro",
          amountUsd: revenuePeriod,
        },
        {
          code: "CFO-02",
          label: "Kas keluar gas admin",
          amountUsd: -gasPeriod,
        },
        {
          code: "CFO-03",
          label: "Kas keluar validator tip",
          amountUsd: -tipPeriod,
        },
        {
          code: "CFO-99",
          label: "Arus kas operasi bersih",
          amountUsd: operatingNet,
          emphasis: "subtotal",
        },
      ],
      investing: [
        {
          code: "CFI-01",
          label: "Investasi / CapEx",
          amountUsd: 0,
          note: "Tidak ada belanja aset tetap pada periode ini",
          emphasis: "muted",
        },
      ],
      financing: [
        {
          code: "CFF-01",
          label: "Kas masuk deposit jaminan user (registrasi periode)",
          amountUsd: depositIn,
        },
        {
          code: "CFF-02",
          label: "Kas keluar penarikan user",
          amountUsd: 0,
          note: "Belum ada ledger withdraw terpisah",
          emphasis: "muted",
        },
        {
          code: "CFF-99",
          label: "Arus kas pendanaan bersih",
          amountUsd: depositIn,
          emphasis: "subtotal",
        },
      ],
      netChangeUsd: netChange,
      openingCashUsd: openingCash,
      closingCashUsd: closingCash,
    },
    equity: {
      openingUsd: roundUsd(Math.max(0, retainedPrior)),
      movements: [
        {
          code: "E-01",
          label: "Laba / (rugi) bersih periode berjalan",
          amountUsd: netIncome,
        },
        {
          code: "E-02",
          label: "Setoran modal",
          amountUsd: 0,
          emphasis: "muted",
        },
        {
          code: "E-03",
          label: "Penarikan / dividen owner",
          amountUsd: 0,
          note: "Tidak ada drawing pada periode ini",
          emphasis: "muted",
        },
      ],
      closingUsd: totalEquity,
    },
    notes: {
      sections: [
        {
          title: "1. Kebijakan akuntansi",
          paragraphs: [
            `Laporan disusun atas dasar ${FINANCE_POLICY.basis} dalam Rupiah (IDR / Rp), mengikuti kerangka ${FINANCE_POLICY.framework}.`,
            "Dana user di vault diperlakukan sebagai aset custodial yang diimbangi liabilitas kepada user (bukan pendapatan).",
            `Pendapatan platform diakui saat eksekusi flash loan Mode Pro berstatus sukses, sebesar ${FINANCE_POLICY.platformProfitSharePct}% dari laba bersih tercatat.`,
            "Beban gas dan validator tip diakui pada periode transaksi sukses. Kegagalan Telegram atau RPC tidak mengubah pengakuan.",
          ],
          rows: [
            { key: "Versi kebijakan", value: FINANCE_POLICY.policyVersion },
            { key: "Basis", value: FINANCE_POLICY.basis },
            { key: "Mata uang fungsional", value: "IDR (Rp)" },
            { key: "Profit sharing Pro", value: `${FINANCE_POLICY.platformProfitSharePct}%` },
          ],
        },
        {
          title: "2. Parameter staking",
          paragraphs: [
            "Staking adalah liabilitas terbatas: dana user tetap milik user dan dicatat terpisah dari kas operasional platform.",
            "Imbal hasil staking belum dikapitalisasi otomatis ke buku besar; CaLK mencantumkan parameter program untuk transparansi.",
          ],
          rows: [
            { key: "APR program", value: `${FINANCE_POLICY.stakingAprPct}%` },
            { key: "Minimum stake", value: formatFinanceIdr(FINANCE_POLICY.stakingMinUsd) },
            { key: "Masa lock", value: `${FINANCE_POLICY.stakingLockDays} hari` },
            { key: "User staking aktif", value: String(stakingUsers.length) },
            { key: "Nilai staked", value: formatFinanceIdr(stakingLiab) },
          ],
        },
        {
          title: "3. Formula spread & profit eksekusi",
          paragraphs: [
            "Spread spot (bps) = (P_jual − P_beli) / P_beli × 10.000. Peluang ditolak jika spread ≤ 0 atau di atas ambang data buruk.",
            "Laba kotor = hasil swap jual − jumlah repay flash loan (pokok + premi). minAmountOut = lantai repay + min profit max(loan×0.60%,costFloor) (slippage adaptif 0.5%–1.0%).",
            "Laba bersih user = laba kotor − biaya gas (setara Rupiah dari quote stablecoin) − validator tip. Platform mengambil porsi Pro dari laba bersih tersebut.",
          ],
          rows: [
            { key: "Premi Aave Free / Pro", value: `${FINANCE_POLICY.aaveFeePctFree}% / ${FINANCE_POLICY.aaveFeePctPro}%` },
            { key: "Min. spread", value: `${FINANCE_POLICY.minSpreadPct}%` },
            { key: "Slippage", value: "Fleksibel (0.5%–1.0%)" },
            { key: "Min. profit", value: formatFinanceIdr(FINANCE_POLICY.minProfitUsd) },
            { key: "Min. likuiditas pool", value: formatFinanceIdr(FINANCE_POLICY.minPoolLiquidityUsd) },
            { key: "Max spot spread (data buruk)", value: `${FINANCE_POLICY.maxSpotSpreadBps} bps` },
            { key: "Validator tip", value: `${FINANCE_POLICY.minerTipPct}%` },
            { key: "Loan default", value: formatFinanceIdr(bot.config?.loanAmountUsd ?? 0) },
          ],
        },
        {
          title: "4. Sumber data operasional",
          paragraphs: [
            "Saldo user, staking, dan tier bersumber dari penyimpanan terpusat lib/db.ts (User List owner).",
            "Transaksi eksekusi bersumber dari data/bot-state.json melalui lib/bot/store.ts.",
            `Identitas neraca: Aset = vault custodial + treasury; Liabilitas = withdraw user + staking; Ekuitas = laba ditahan. Selisih pembulatan di bawah ${formatFinanceIdr(0.05)} dianggap seimbang.`,
          ],
          rows: [
            { key: "Jumlah user", value: String(users.length) },
            { key: "User Pro", value: String(proUsers.length) },
            { key: "Trade sukses (periode)", value: String(periodTrades.length) },
            { key: "Trade Pro (periode)", value: String(proTrades.length) },
            { key: "Neraca seimbang", value: balanced ? "Ya" : "Perlu rekonsiliasi" },
          ],
        },
        {
          title: "5. Buku kas owner (IDR) — 1 Agustus s.d. 15 September 2026",
          paragraphs: [
            "Money management owner dicatat dalam Rupiah, selaras dengan buku operasional platform. Kas masuk adalah setoran modal / pendapatan operasional; pengeluaran mengikuti mutasi rekening, nota, inventaris hardware, deposit exchange, alokasi modal Trust Wallet ETH (uji arbitrase), infrastruktur RPC, utilitas PDAM, langganan software/cloud, opex kuota internet, token listrik, dan konsumsi harian.",
            "Saldo akhir = kas awal (Rp 0, tidak ada saldo pembuka tercatat) + total kas masuk − total pengeluaran.",
            `OpEx wajib (kuota, konsumsi operasional, token listrik, langganan RPC, dan utilitas PDAM) diakumulasi sampai tanggal buku ${CASHBOOK_AS_OF}. Struk riil bluVirtual Card: Blockmachine RPC Rp 161.797,50 (12 September 2026, TAOSTATS, ekuivalen $9,00) dan perpanjangan ANKR RPC/WSS Rp 184.095,56 (15 September 2026, 15:00:58 WIB, WEB3 TECHNOLOGIES INC, No. Ref 0915 8075 5282); subtotal kedua struk Rp 345.893,06. PDAM Rp 102.500,00 (9 September 2026, termasuk biaya admin) tetap masuk rekap mingguan dan bulan berjalan.`,
            ...cashbook.recurring.map((item) =>
              item.intervalDays > 1
                ? `${item.item}: ${item.detail}, ${item.days} kali dari ${item.startDate} s.d. ${item.endDate} = ${formatFinanceIdr(item.totalIdr)}.`
                : `${item.item}: ${item.detail}, harian ${item.startDate} s.d. ${item.endDate} (${item.days} hari) = ${formatFinanceIdr(item.totalIdr)}.`
            ),
          ],
          rows: [
            { key: "Periode", value: cashbook.periodLabel },
            { key: "Sumber", value: cashbook.source },
            { key: "Total kas masuk", value: formatFinanceIdr(cashbook.totalInflowIdr) },
            ...cashbook.recurring.map((item) => ({
              key: `Opex ${item.item}`,
              value:
                item.intervalDays > 1
                  ? `${item.days} kali × ${formatFinanceIdr(item.dailyIdr)} (setiap ${item.intervalDays} hari) = ${formatFinanceIdr(item.totalIdr)}`
                  : `${item.days} × ${formatFinanceIdr(item.dailyIdr)} = ${formatFinanceIdr(item.totalIdr)}`,
            })),
            { key: "OpEx harian", value: formatFinanceIdr(cashbook.opex.daily.amountIdr) },
            { key: "OpEx mingguan", value: formatFinanceIdr(cashbook.opex.weekly.amountIdr) },
            { key: "OpEx bulanan (MTD)", value: formatFinanceIdr(cashbook.opex.monthly.amountIdr) },
            { key: "OpEx wajib terkumpul", value: formatFinanceIdr(cashbook.opex.accumulatedIdr) },
            { key: "Belanja inventaris / hardware", value: formatFinanceIdr(cashbook.inventoryTotalIdr) },
            { key: "Pengeluaran pribadi / konsumsi", value: formatFinanceIdr(cashbook.personalTotalIdr) },
            { key: "Prive / penarikan dana pribadi", value: formatFinanceIdr(cashbook.priveTotalIdr) },
            { key: "Deposit exchange / modal operasional", value: formatFinanceIdr(cashbook.exchangeDepositsTotalIdr) },
            {
              key: "Alokasi modal / uji arbitrase (Trust Wallet ETH)",
              value: formatFinanceIdr(cashbook.web3DepositsTotalIdr),
            },
            { key: "Infrastruktur / Node / RPC", value: formatFinanceIdr(cashbook.infrastructureTotalIdr) },
            {
              key: "Utilitas / Operasional Bulanan (PDAM)",
              value: formatFinanceIdr(cashbook.utilitiesTotalIdr),
            },
            {
              key: "Langganan bulanan terbit ke kas",
              value: formatFinanceIdr(cashbook.subscriptionsCommittedIdr),
            },
            { key: "Total pengeluaran", value: formatFinanceIdr(cashbook.totalOutflowIdr) },
            { key: "Saldo akhir", value: formatFinanceIdr(cashbook.closingIdr) },
            { key: "Jumlah transaksi keluar", value: String(cashbook.outflows.length) },
          ],
        },
        {
          title: "6. Inventaris / hardware pendukung",
          paragraphs: [
            "Belanja perangkat dicatat sebagai kas keluar pada tanggal pembelian dan didaftarkan di kartu inventaris owner (bukan aset vault custodial).",
          ],
          rows: cashbook.inventory.map((item) => ({
            key: `${item.date} · ${item.item}`,
            value: `${item.category} · ${formatFinanceIdr(item.amountIdr)}${item.note ? ` · ${item.note}` : ""}`,
          })),
        },
        {
          title: "7. Pengeluaran pribadi / konsumsi",
          paragraphs: [
            "Belanja pribadi dan kebutuhan rumah tangga dicatat terpisah dari opex operasional harian, tetapi tetap mengurangi kas owner pada tanggal transaksi.",
          ],
          rows: cashbook.personal.map((item) => ({
            key: `${item.date} · ${item.item}`,
            value: `${item.category} · ${formatFinanceIdr(item.amountIdr)}${item.note ? ` · ${item.note}` : ""}`,
          })),
        },
        {
          title: "7b. Prive / penarikan dana pribadi",
          paragraphs: [
            "Penarikan prive ATM dicatat sebagai kas keluar owner, bukan beban operasional bot. Nominal ini mengurangi kas bersih owner tetapi tidak masuk ringkasan OpEx harian/mingguan/bulanan.",
          ],
          rows: cashbook.prive.map((item) => ({
            key: `${item.date} · ${item.item}`,
            value: `${item.category} · ${formatFinanceIdr(item.amountIdr)}${item.note ? ` · ${item.note}` : ""}`,
          })),
        },
        {
          title: "8. Deposit exchange / modal operasional",
          paragraphs: [
            "Transfer deposit ke exchange dicatat sebagai kas keluar pada tanggal transfer dan dikategorikan sebagai modal operasional (bukan pendapatan).",
          ],
          rows: cashbook.exchangeDeposits.map((item) => ({
            key: `${item.date} · ${item.item}`,
            value: `${item.category} · ${formatFinanceIdr(item.amountIdr)}${item.note ? ` · ${item.note}` : ""}`,
          })),
        },
        {
          title: "8b. Pengeluaran alokasi modal / uji arbitrase (Trust Wallet ETH)",
          paragraphs: [
            "Empat transfer ke Trust Wallet (ETH Arbitrum) dicatat sebagai kas keluar / alokasi aset untuk uji arbitrase, bukan kas masuk dan bukan pendapatan. Subtotal Rp 600.000,00 menggantikan catatan lump-sum lama Rp 200.000,00 agar tidak terjadi double-count.",
          ],
          rows: cashbook.web3Deposits.map((item) => ({
            key: `${item.date} · ${item.item}`,
            value: `${item.category} · ${formatFinanceIdr(item.amountIdr)}${item.note ? ` · ${item.note}` : ""}`,
          })),
        },
        {
          title: "8c. Infrastruktur / Node / RPC",
          paragraphs: [
            "Langganan RPC dicatat sebagai kas keluar pada tanggal pembayaran sesuai struk kartu virtual (dua desimal). Blockmachine (cadangan) dan ANKR (primer) diamortisasi terpisah menurut jarak bayar vendor yang sama. Tidak ada nota VPS atau gas maintenance cadangan pada periode ini.",
          ],
          rows: cashbook.infrastructure.map((item) => ({
            key: `${item.date} · ${item.item}`,
            value: `${item.category} · ${formatFinanceIdr(item.amountIdr)}${item.note ? ` · ${item.note}` : ""}`,
          })),
        },
        {
          title: "8d. Utilitas / operasional bulanan (PDAM)",
          paragraphs: [
            "Pembayaran PDAM dicatat sebagai kas keluar pada tanggal transfer, termasuk biaya admin. Total Rp 102.500,00 (Rp 100.000,00 + Rp 2.500,00) masuk mutasi outflow serta ringkasan OpEx mingguan dan bulan berjalan.",
          ],
          rows: cashbook.utilities.map((item) => ({
            key: `${item.date} · ${item.item}`,
            value: `${item.category} · ${formatFinanceIdr(item.amountIdr)}${item.note ? ` · ${item.note}` : ""}`,
          })),
        },
        {
          title: "9. Pengeluaran rutin / langganan software & cloud",
          paragraphs: [
            "Langganan bulanan dicatat sebagai komitmen opex aktif. Nominal baru memotong kas pada tanggal pembayaran; sampai saat itu item tetap tampil di ringkasan pengeluaran rutin beserta jadwal berikutnya.",
          ],
          rows: cashbook.subscriptions.map((item) => ({
            key: item.item,
            value: `${item.category} · ${formatFinanceIdr(item.amountIdr)} / bulan · berikutnya ${item.nextPaymentDate} · ${item.active ? "aktif" : "nonaktif"}`,
          })),
        },
      ],
      auditLog,
    },
    cashbook,
    stats: {
      userCount: users.length,
      proUserCount: proUsers.length,
      stakingUserCount: stakingUsers.length,
      successTradesInPeriod: periodTrades.length,
      proTradesInPeriod: proTrades.length,
    },
  };
}

