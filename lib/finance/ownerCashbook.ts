export type CashbookKind = "inflow" | "outflow";

export interface OwnerCashbookEntry {
  date: string;
  label: string;
  amountIdr: number;
  kind: CashbookKind;
  note?: string;
}

export interface OwnerCashbookLine {
  code: string;
  date: string;
  label: string;
  amountIdr: number;
  note?: string;
  kind: CashbookKind;
}

export interface OwnerRecurringOpex {
  id: string;
  item: string;
  detail: string;
  unitPriceIdr: number;
  qtyPerDay: number;
  dailyIdr: number;
  startDate: string;
  endDate: string;
  frequency: "daily" | "every_n_days";
  intervalDays: number;
  days: number;
  totalIdr: number;
}

export interface OwnerMonthlySubscription {
  id: string;
  item: string;
  category: string;
  amountIdr: number;
  frequency: "monthly";
  nextPaymentDate: string;
  active: boolean;
  note?: string;
}

export interface OwnerInventoryItem {
  id: string;
  date: string;
  item: string;
  category: string;
  amountIdr: number;
  note?: string;
}

export interface OwnerOpexWindow {
  start: string;
  end: string;
  amountIdr: number;
}

/** Ringkasan OpEx owner — harian (run-rate + porsi RPC), 7 hari, dan bulan berjalan. */
export interface OwnerOpexSummary {
  asOf: string;
  runRateDailyIdr: number;
  rpcDailySliceIdr: number;
  rpcCycleDays: number;
  rpcLatestIdr: number;
  rpcTotalIdr: number;
  daily: OwnerOpexWindow;
  weekly: OwnerOpexWindow;
  monthly: OwnerOpexWindow;
  accumulatedIdr: number;
}

export interface OwnerCashbook {
  id: "owner-cash-2026";
  currency: "IDR";
  periodLabel: string;
  source: string;
  openingIdr: number;
  inflows: OwnerCashbookLine[];
  outflows: OwnerCashbookLine[];
  mutasiLines: OwnerCashbookLine[];
  dailyOpexLines: OwnerCashbookLine[];
  periodicOpexLines: OwnerCashbookLine[];
  recurring: OwnerRecurringOpex[];
  subscriptions: OwnerMonthlySubscription[];
  subscriptionsCommittedIdr: number;
  commitmentLines: OwnerCashbookLine[];
  inventory: OwnerInventoryItem[];
  inventoryTotalIdr: number;
  personal: OwnerInventoryItem[];
  personalTotalIdr: number;
  prive: OwnerInventoryItem[];
  priveTotalIdr: number;
  exchangeDeposits: OwnerInventoryItem[];
  exchangeDepositsTotalIdr: number;
  web3Deposits: OwnerInventoryItem[];
  web3DepositsTotalIdr: number;
  infrastructure: OwnerInventoryItem[];
  infrastructureTotalIdr: number;
  utilities: OwnerInventoryItem[];
  utilitiesTotalIdr: number;
  opex: OwnerOpexSummary;
  totalInflowIdr: number;
  totalOutflowIdr: number;
  closingIdr: number;
}

function roundIdr(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Buku kas owner — mutasi Agustus 2026 (setoran modal + nota/mutasi). */
export const AUGUST_2026_CASHBOOK_ENTRIES: OwnerCashbookEntry[] = [
  { date: "2026-08-07", kind: "inflow", amountIdr: 3_000_000, label: "Setoran Kas / Modal" },
  { date: "2026-08-12", kind: "inflow", amountIdr: 2_000_000, label: "Setoran Kas / Modal" },
  {
    date: "2026-09-07",
    kind: "inflow",
    amountIdr: 2_000_000,
    label: "Transfer Masuk / Setoran Kas ke Rekening 8640087448 (Mochamad Murtiman)",
    note: "Pemasukan Kas / Modal",
  },
  {
    date: "2026-09-18",
    kind: "inflow",
    amountIdr: 1_500_000,
    label: "Transfer Masuk / Setoran Kas — Mochamad Murtiman (BCA)",
    note: "08:30:42 WIB · Pemasukan Kas / Modal · a.n. Mochamad Murtiman (BCA)",
  },
  { date: "2026-08-01", kind: "outflow", amountIdr: 17_000, label: "Indomaret" },
  { date: "2026-08-01", kind: "outflow", amountIdr: 3_179.08, label: "Biaya Kartu ATM" },
  { date: "2026-08-03", kind: "outflow", amountIdr: 20_000, label: "Biaya Adm" },
  { date: "2026-08-07", kind: "outflow", amountIdr: 100_000, label: "Pulsa Telkomsel" },
  { date: "2026-08-07", kind: "outflow", amountIdr: 102_000, label: "GoPay / TSEL Transfer" },
  { date: "2026-08-08", kind: "outflow", amountIdr: 99_500, label: "Indomaret" },
  { date: "2026-08-08", kind: "outflow", amountIdr: 250_000, label: "Tarikan Tunai ATM" },
  { date: "2026-08-08", kind: "outflow", amountIdr: 16_820.92, label: "Biaya Kartu ATM" },
  { date: "2026-08-08", kind: "outflow", amountIdr: 200_000, label: "GoPay Transfer" },
  { date: "2026-08-11", kind: "outflow", amountIdr: 15_000, label: "GoPay Transfer" },
  { date: "2026-08-12", kind: "outflow", amountIdr: 100_000, label: "Tarikan Tunai ATM" },
  { date: "2026-08-14", kind: "outflow", amountIdr: 105_000, label: "DANA Transfer" },
  { date: "2026-08-14", kind: "outflow", amountIdr: 103_000, label: "QR Toko Sembako" },
  { date: "2026-08-14", kind: "outflow", amountIdr: 100_000, label: "Tarikan Tunai ATM" },
  { date: "2026-08-17", kind: "outflow", amountIdr: 100_000, label: "Tarikan Tunai ATM" },
];

/** Infrastruktur bot — langganan RPC / node (kas keluar, dihitung juga di ringkasan OpEx). */
export const OWNER_INFRASTRUCTURE_OPEX: OwnerInventoryItem[] = [
  {
    id: "infra-rpc-web3-2026-08-23",
    date: "2026-08-23",
    item: "Web3 Technologies Inc (Infrastruktur RPC)",
    category: "Infrastruktur / Node / RPC",
    amountIdr: 183_000,
  },
  {
    id: "infra-rpc-web3-2026-08-31",
    date: "2026-08-31",
    item: "Web3 Technologies Inc (Infrastruktur RPC)",
    category: "Infrastruktur / Node / RPC",
    amountIdr: 183_821.25,
  },
  {
    id: "infra-rpc-ankr-2026-09-08",
    date: "2026-09-08",
    item: "Perpanjangan RPC ANKR (Web3 Technologies Inc)",
    category: "Infrastruktur / Node / RPC",
    amountIdr: 182_652.98,
    note: "22:24:58 WIB · bluVirtual Card (Debit Online) · No. Ref 0908 2470 1973",
  },
  {
    id: "infra-rpc-blockmachine-2026-09-12",
    date: "2026-09-12",
    item: "Blockmachine RPC (Cadangan node)",
    category: "Infrastruktur / Node / RPC",
    amountIdr: 161_797.5,
    note: "Struk bluVirtual Card · Merchant: TAOSTATS · ekuivalen $9,00 · a.n. operasional bot",
  },
  {
    id: "infra-rpc-ankr-2026-09-13",
    date: "2026-09-13",
    item: "ANKR RPC/WSS (Web3 Technologies Inc)",
    category: "Infrastruktur / Node / RPC",
    amountIdr: 183_020.29,
    note: "Struk bluVirtual Card · Merchant: WEB3 TECHNOLOGIES INC · a.n. Mochamad Murtiman",
  },
  {
    id: "infra-rpc-ankr-2026-09-15",
    date: "2026-09-15",
    item: "Perpanjangan RPC WSS ANKR (Web3 Technologies Inc)",
    category: "Infrastruktur / Node / RPC",
    amountIdr: 184_095.56,
    note: "15:00:58 WIB · bluVirtual Card (Debit Online) · No. Ref 0915 8075 5282",
  },
  {
    id: "infra-rpc-quicknode-2026-09-18",
    date: "2026-09-18",
    item: "QuickNode RPC/WSS (MEV Protection · Ethereum / Arbitrum / Polygon)",
    category: "Infrastruktur / Node / RPC",
    amountIdr: 373_550.36,
    note: "21:59:46 WIB · bluVirtual Card · Pembayaran langganan QuickNode",
  },
];

/** Utilitas operasional bulanan — PDAM dan biaya admin transfer. */
export const OWNER_UTILITY_EXPENSES: OwnerInventoryItem[] = [
  {
    id: "util-pdam-jatim-2026-09-09",
    date: "2026-09-09",
    item: "Pembayaran PDAM (Transfer ke Bank Jatim)",
    category: "Utilitas / Operasional Bulanan (PDAM)",
    amountIdr: 100_000,
    note: "16:08:43 WIB · Nominal transfer Rp 100.000,00 · No. Ref 20260909CENAIDJA51036030198",
  },
  {
    id: "util-pdam-admin-2026-09-09",
    date: "2026-09-09",
    item: "Biaya Admin Pembayaran PDAM",
    category: "Utilitas / Operasional Bulanan (PDAM)",
    amountIdr: 2_500,
    note: "16:08:43 WIB · Biaya admin Rp 2.500,00 · No. Ref 20260909CENAIDJA51036030198",
  },
];

/** Inventaris / hardware pendukung — belanja aset operasional (kas keluar). */
export const OWNER_INVENTORY_ITEMS: OwnerInventoryItem[] = [
  {
    id: "inv-mouse-robot-2026-08-30",
    date: "2026-08-30",
    item: "Mouse Bluetooth Merk ROBOT",
    category: "Inventaris / Hardware Pendukung",
    amountIdr: 100_000,
    note: "Perangkat input operasional workspace owner",
  },
];

function taggedExpenseToEntries(items: OwnerInventoryItem[]): OwnerCashbookEntry[] {
  return items.map((item) => ({
    date: item.date,
    kind: "outflow",
    amountIdr: item.amountIdr,
    label: item.item,
    note: `${item.category}${item.note ? ` · ${item.note}` : ""}`,
  }));
}

/** Pengeluaran pribadi / konsumsi (bukan opex rutin harian). */
export const OWNER_PERSONAL_EXPENSES: OwnerInventoryItem[] = [
  {
    id: "pribadi-belanja-2026-08-13",
    date: "2026-08-13",
    item: "Belanja Pribadi",
    category: "Pengeluaran Pribadi / Konsumsi",
    amountIdr: 128_161,
  },
  {
    id: "rt-beras-indomaret-2026-09-09",
    date: "2026-09-09",
    item: "Pembelian beras 5 kg di Indomaret",
    category: "Konsumsi / Kebutuhan Rumah Tangga",
    amountIdr: 89_000,
  },
];

/** Prive owner — penarikan dana pribadi (bukan opex bot). */
export const OWNER_PRIVE_WITHDRAWALS: OwnerInventoryItem[] = [
  {
    id: "prive-atm-2026-09-09",
    date: "2026-09-09",
    item: "Ambil pribadi / Prive ATM",
    category: "Prive / Penarikan Dana Pribadi",
    amountIdr: 100_000,
  },
];

/** Transfer deposit ke exchange — modal operasional (kas keluar). */
export const OWNER_EXCHANGE_DEPOSITS: OwnerInventoryItem[] = [
  {
    id: "xch-indodax-2026-08-20",
    date: "2026-08-20",
    item: "Transfer ke Indodax Nasional Indonesia",
    category: "Deposit Exchange / Modal Operasional",
    amountIdr: 200_736,
  },
  {
    id: "xch-tokocrypto-2026-09-06",
    date: "2026-09-06",
    item: "Transfer ke CACI-Tokocrypto (Virtual Account)",
    category: "Deposit Exchange / Modal Operasional",
    amountIdr: 200_000,
  },
];

/** Alokasi modal ke Trust Wallet (ETH Arbitrum) — uji arbitrase / kas keluar. */
export const OWNER_WEB3_DEPOSITS: OwnerInventoryItem[] = [
  {
    id: "web3-trust-wallet-eth-2026-09-07-202455",
    date: "2026-09-07",
    item: "Alokasi Modal / Uji Arbitrase — Trust Wallet ETH (Arbitrum)",
    category: "Pengeluaran Alokasi Modal / Uji Arbitrase",
    amountIdr: 100_000,
    note: "20:24:55 WIB · Ref 1s26 cba7 2289",
  },
  {
    id: "web3-trust-wallet-eth-2026-09-08-124427",
    date: "2026-09-08",
    item: "Alokasi Modal / Uji Arbitrase — Trust Wallet ETH (Arbitrum)",
    category: "Pengeluaran Alokasi Modal / Uji Arbitrase",
    amountIdr: 100_000,
    note: "12:44:27 WIB · RRN 206610007",
  },
  {
    id: "web3-trust-wallet-eth-2026-09-10-022659",
    date: "2026-09-10",
    item: "Alokasi Modal / Uji Arbitrase — Trust Wallet ETH (Arbitrum)",
    category: "Pengeluaran Alokasi Modal / Uji Arbitrase",
    amountIdr: 200_000,
    note: "02:26:59 WIB · RRN 265671355",
  },
  {
    id: "web3-trust-wallet-eth-2026-09-10-042439",
    date: "2026-09-10",
    item: "Alokasi Modal / Uji Arbitrase — Trust Wallet ETH (Arbitrum)",
    category: "Pengeluaran Alokasi Modal / Uji Arbitrase",
    amountIdr: 200_000,
    note: "04:24:39 WIB · RRN 266302673",
  },
];

/** Tanggal tutup buku — selaras setoran kas & nota QuickNode 18 September 2026. */
export const CASHBOOK_AS_OF = "2026-09-18";

type RecurringOpexSpec = {
  id: string;
  item: string;
  detail: string;
  unitPriceIdr: number;
  qtyPerDay: number;
  startDate: string;
  endDate: string;
  intervalDays?: number;
};

/** Paket kuota harian 8 GB / 24 jam — operasional bot & pemantauan. */
export const OWNER_QUOTA_OPEX: RecurringOpexSpec = {
  id: "quota",
  item: "Pembelian Kuota 8 GB (24 Jam)",
  detail: "1 paket @ Rp 12.000 · 24 jam",
  unitPriceIdr: 12_000,
  qtyPerDay: 1,
  startDate: "2026-08-13",
  endDate: CASHBOOK_AS_OF,
};

/** Konsumsi harian owner 7 Agustus — 18 September 2026. */
export const OWNER_DAILY_CONSUMABLES: RecurringOpexSpec[] = [
  {
    id: "rokok",
    item: 'Rokok "Gajah Baru"',
    detail: "2 bungkus @ Rp 12.000 = Rp 24.000 / hari",
    unitPriceIdr: 12_000,
    qtyPerDay: 2,
    startDate: "2026-08-07",
    endDate: CASHBOOK_AS_OF,
  },
  {
    id: "snack",
    item: "Snack",
    detail: "1 bungkus @ Rp 12.000 / hari",
    unitPriceIdr: 12_000,
    qtyPerDay: 1,
    startDate: "2026-08-07",
    endDate: CASHBOOK_AS_OF,
  },
  {
    id: "kopi",
    item: "Kopi",
    detail: "2 gelas @ Rp 5.000 = Rp 10.000 / hari",
    unitPriceIdr: 5_000,
    qtyPerDay: 2,
    startDate: "2026-08-07",
    endDate: CASHBOOK_AS_OF,
  },
];

/** Token listrik — pembelian berkala setiap 5 hari. */
export const OWNER_TOKEN_LISTRIK_OPEX: RecurringOpexSpec = {
  id: "token-listrik",
  item: "Token Listrik",
  detail: "1 token @ Rp 22.000 · setiap 5 hari",
  unitPriceIdr: 22_000,
  qtyPerDay: 1,
  startDate: "2026-08-08",
  endDate: CASHBOOK_AS_OF,
  intervalDays: 5,
};

export const OWNER_RECURRING_OPEX: RecurringOpexSpec[] = [
  OWNER_QUOTA_OPEX,
  ...OWNER_DAILY_CONSUMABLES,
  OWNER_TOKEN_LISTRIK_OPEX,
];

/** Langganan software & cloud — opex bulanan (terbit ke kas pada tanggal pembayaran). */
export const OWNER_MONTHLY_SUBSCRIPTIONS: OwnerMonthlySubscription[] = [
  {
    id: "sub-google-one-ai-plus-400gb",
    item: "Google One / Google AI Plus (400 GB)",
    category: "Pengeluaran Rutin / Langganan Software & Cloud",
    amountIdr: 19_000,
    frequency: "monthly",
    nextPaymentDate: "2026-09-27",
    active: true,
    note: "Langganan bulanan aktif",
  },
];

function eachIsoDate(from: string, to: string, intervalDays = 1): string[] {
  const dates: string[] = [];
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const step = Math.max(1, Math.floor(intervalDays)) * 86_400_000;
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
    return dates;
  }
  for (let t = start.getTime(); t <= end.getTime(); t += step) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

function addIsoDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoDaySpan(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000);
}

function inIsoRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function sumEntriesInRange(entries: OwnerCashbookEntry[], start: string, end: string): number {
  return roundIdr(
    entries.reduce((sum, item) => (inIsoRange(item.date, start, end) ? sum + item.amountIdr : sum), 0)
  );
}

function specInterval(spec: RecurringOpexSpec): number {
  return Math.max(1, Math.floor(spec.intervalDays ?? 1));
}

function isDailyOpexSpec(spec: RecurringOpexSpec): boolean {
  return specInterval(spec) === 1;
}

function isSubscriptionLabel(label: string): boolean {
  return /google one|google ai plus/i.test(label);
}

function lineTotal(lines: OwnerCashbookLine[]): number {
  return roundIdr(lines.reduce((sum, line) => sum + line.amountIdr, 0));
}

function purchaseAmount(spec: RecurringOpexSpec): number {
  return roundIdr(spec.unitPriceIdr * spec.qtyPerDay);
}

export function expandDailyOpex(spec: RecurringOpexSpec): OwnerCashbookEntry[] {
  const amount = purchaseAmount(spec);
  const intervalDays = specInterval(spec);
  const cadence = intervalDays === 1 ? "Opex harian" : `Opex setiap ${intervalDays} hari`;
  return eachIsoDate(spec.startDate, spec.endDate, intervalDays).map((date) => ({
    date,
    kind: "outflow" as const,
    amountIdr: amount,
    label: spec.item,
    note: `${cadence} · ${spec.detail}`,
  }));
}

export function summarizeDailyOpex(spec: RecurringOpexSpec): OwnerRecurringOpex {
  const intervalDays = specInterval(spec);
  const days = eachIsoDate(spec.startDate, spec.endDate, intervalDays).length;
  const dailyIdr = purchaseAmount(spec);
  return {
    id: spec.id,
    item: spec.item,
    detail: spec.detail,
    unitPriceIdr: spec.unitPriceIdr,
    qtyPerDay: spec.qtyPerDay,
    dailyIdr,
    startDate: spec.startDate,
    endDate: spec.endDate,
    frequency: intervalDays === 1 ? "daily" : "every_n_days",
    intervalDays,
    days,
    totalIdr: roundIdr(days * dailyIdr),
  };
}

export function quotaOpexEntries(): OwnerCashbookEntry[] {
  return expandDailyOpex(OWNER_QUOTA_OPEX);
}

function subscriptionPosted(sub: OwnerMonthlySubscription, asOf: string): boolean {
  return sub.active && sub.nextPaymentDate <= asOf;
}

export function expandMonthlySubscriptions(
  items: OwnerMonthlySubscription[],
  asOf: string
): OwnerCashbookEntry[] {
  return items.filter((item) => subscriptionPosted(item, asOf)).map((item) => ({
    date: item.nextPaymentDate,
    kind: "outflow" as const,
    amountIdr: roundIdr(item.amountIdr),
    label: item.item,
    note: `${item.category} · Langganan bulanan · ${item.note ?? "Aktif"}`,
  }));
}

function formatIdDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function toLines(entries: OwnerCashbookEntry[], kind: CashbookKind, prefix: string): OwnerCashbookLine[] {
  return entries
    .filter((item) => item.kind === kind)
    .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
    .map((item, index) => ({
      code: `${prefix}-${String(index + 1).padStart(3, "0")}`,
      date: item.date,
      label: `${formatIdDate(item.date)} · ${item.label}`,
      amountIdr: roundIdr(item.amountIdr),
      note: item.note,
      kind,
    }));
}

function rpcVendorFamily(item: string): "ankr" | "blockmachine" | "quicknode" | "other" {
  if (/quicknode|quiknode/i.test(item)) return "quicknode";
  if (/blockmachine|taostats/i.test(item)) return "blockmachine";
  if (/ankr|web3 technologies/i.test(item)) return "ankr";
  return "other";
}

function rpcCycleDays(items: OwnerInventoryItem[]): number {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  if (!latest) return 30;
  const family = rpcVendorFamily(latest.item);
  const dates = sorted.filter((row) => rpcVendorFamily(row.item) === family).map((row) => row.date);
  if (dates.length < 2) return 30;
  const span = isoDaySpan(dates[dates.length - 2], dates[dates.length - 1]);
  return Math.max(1, span);
}

function buildOpexSummary(input: {
  asOf: string;
  recurring: OwnerRecurringOpex[];
  dailyEntries: OwnerCashbookEntry[];
  periodicEntries: OwnerCashbookEntry[];
  infrastructure: OwnerInventoryItem[];
  utilities: OwnerInventoryItem[];
}): OwnerOpexSummary {
  const infraEntries = taggedExpenseToEntries(input.infrastructure);
  const utilityEntries = taggedExpenseToEntries(input.utilities);
  const posted = [...input.dailyEntries, ...input.periodicEntries, ...infraEntries, ...utilityEntries];
  const latestRpc = [...input.infrastructure].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const cycleDays = rpcCycleDays(input.infrastructure);
  const rpcLatestIdr = roundIdr(latestRpc?.amountIdr ?? 0);
  const rpcDailySliceIdr = cycleDays > 0 ? roundIdr(rpcLatestIdr / cycleDays) : 0;
  const rpcTotalIdr = roundIdr(input.infrastructure.reduce((sum, item) => sum + item.amountIdr, 0));
  const runRateRecurring = roundIdr(
    input.recurring.reduce((sum, item) => sum + item.dailyIdr / Math.max(1, item.intervalDays), 0)
  );
  const runRateDailyIdr = roundIdr(runRateRecurring + rpcDailySliceIdr);
  const weekStart = addIsoDays(input.asOf, -6);
  const monthStart = `${input.asOf.slice(0, 8)}01`;
  const postedToday = sumEntriesInRange(posted, input.asOf, input.asOf);
  return {
    asOf: input.asOf,
    runRateDailyIdr,
    rpcDailySliceIdr,
    rpcCycleDays: cycleDays,
    rpcLatestIdr,
    rpcTotalIdr,
    daily: {
      start: input.asOf,
      end: input.asOf,
      amountIdr: roundIdr(postedToday + rpcDailySliceIdr),
    },
    weekly: {
      start: weekStart,
      end: input.asOf,
      amountIdr: sumEntriesInRange(posted, weekStart, input.asOf),
    },
    monthly: {
      start: monthStart,
      end: input.asOf,
      amountIdr: sumEntriesInRange(posted, monthStart, input.asOf),
    },
    accumulatedIdr: roundIdr(posted.reduce((sum, item) => sum + item.amountIdr, 0)),
  };
}

function toCommitmentLines(items: OwnerMonthlySubscription[]): OwnerCashbookLine[] {
  return items.map((item, index) => ({
    code: `KB-${String(index + 1).padStart(3, "0")}`,
    date: item.nextPaymentDate,
    label: `${formatIdDate(item.nextPaymentDate)} · ${item.item}`,
    amountIdr: roundIdr(item.amountIdr),
    note: `${item.category} · ${item.active ? "Aktif" : "Nonaktif"}${item.note ? ` (${item.note})` : ""}`,
    kind: "outflow",
  }));
}

export function buildAugust2026Cashbook(openingIdr = 0): OwnerCashbook {
  const recurring = OWNER_RECURRING_OPEX.map(summarizeDailyOpex);
  const dailyOpexEntries = OWNER_RECURRING_OPEX.filter(isDailyOpexSpec)
    .flatMap(expandDailyOpex)
    .filter((item) => !isSubscriptionLabel(item.label));
  const periodicOpexEntries = OWNER_RECURRING_OPEX.filter((spec) => !isDailyOpexSpec(spec)).flatMap(
    expandDailyOpex
  );
  const inventory = OWNER_INVENTORY_ITEMS.map((item) => ({
    ...item,
    amountIdr: roundIdr(item.amountIdr),
  }));
  const personal = OWNER_PERSONAL_EXPENSES.map((item) => ({
    ...item,
    amountIdr: roundIdr(item.amountIdr),
  }));
  const prive = OWNER_PRIVE_WITHDRAWALS.map((item) => ({
    ...item,
    amountIdr: roundIdr(item.amountIdr),
  }));
  const exchangeDeposits = OWNER_EXCHANGE_DEPOSITS.map((item) => ({
    ...item,
    amountIdr: roundIdr(item.amountIdr),
  }));
  const web3Deposits = OWNER_WEB3_DEPOSITS.map((item) => ({
    ...item,
    amountIdr: roundIdr(item.amountIdr),
  }));
  const subscriptions = OWNER_MONTHLY_SUBSCRIPTIONS.map((item) => ({
    ...item,
    amountIdr: roundIdr(item.amountIdr),
  }));
  const infrastructure = OWNER_INFRASTRUCTURE_OPEX.map((item) => ({
    ...item,
    amountIdr: roundIdr(item.amountIdr),
  }));
  const utilities = OWNER_UTILITY_EXPENSES.map((item) => ({
    ...item,
    amountIdr: roundIdr(item.amountIdr),
  }));
  const subscriptionEntries = expandMonthlySubscriptions(subscriptions, CASHBOOK_AS_OF);
  const mutasiEntries = [
    ...AUGUST_2026_CASHBOOK_ENTRIES,
    ...taggedExpenseToEntries(inventory),
    ...taggedExpenseToEntries(personal),
    ...taggedExpenseToEntries(prive),
    ...taggedExpenseToEntries(exchangeDeposits),
    ...taggedExpenseToEntries(web3Deposits),
    ...taggedExpenseToEntries(infrastructure),
    ...taggedExpenseToEntries(utilities),
  ];
  const opex = buildOpexSummary({
    asOf: CASHBOOK_AS_OF,
    recurring,
    dailyEntries: dailyOpexEntries,
    periodicEntries: periodicOpexEntries,
    infrastructure,
    utilities,
  });
  const postedEntries = [
    ...mutasiEntries,
    ...dailyOpexEntries,
    ...periodicOpexEntries,
    ...subscriptionEntries,
  ];
  const inflows = toLines(postedEntries, "inflow", "KI");
  const mutasiLines = toLines(mutasiEntries, "outflow", "KE");
  const dailyOpexLines = toLines(dailyOpexEntries, "outflow", "OH");
  const periodicOpexLines = toLines(periodicOpexEntries, "outflow", "OB");
  const postedSubscriptionLines = toLines(subscriptionEntries, "outflow", "KB");
  const outflows = [...mutasiLines, ...dailyOpexLines, ...periodicOpexLines, ...postedSubscriptionLines];
  const totalInflowIdr = lineTotal(inflows);
  const totalOutflowIdr = roundIdr(outflows.reduce((sum, line) => sum + line.amountIdr, 0));
  const inventoryTotalIdr = roundIdr(inventory.reduce((sum, item) => sum + item.amountIdr, 0));
  const personalTotalIdr = roundIdr(personal.reduce((sum, item) => sum + item.amountIdr, 0));
  const priveTotalIdr = roundIdr(prive.reduce((sum, item) => sum + item.amountIdr, 0));
  const exchangeDepositsTotalIdr = roundIdr(
    exchangeDeposits.reduce((sum, item) => sum + item.amountIdr, 0)
  );
  const web3DepositsTotalIdr = roundIdr(web3Deposits.reduce((sum, item) => sum + item.amountIdr, 0));
  const infrastructureTotalIdr = roundIdr(
    infrastructure.reduce((sum, item) => sum + item.amountIdr, 0)
  );
  const utilitiesTotalIdr = roundIdr(utilities.reduce((sum, item) => sum + item.amountIdr, 0));
  const subscriptionsCommittedIdr = roundIdr(
    subscriptionEntries.reduce((sum, item) => sum + item.amountIdr, 0)
  );
  const opening = roundIdr(openingIdr);
  return {
    id: "owner-cash-2026",
    currency: "IDR",
    periodLabel: "1 Agustus — 18 September 2026",
    source:
      "Mutasi rekening, nota, inventaris, belanja pribadi, prive owner, deposit exchange, alokasi modal Trust Wallet ETH (uji arbitrase), infrastruktur RPC (ANKR / Blockmachine / QuickNode), utilitas PDAM, langganan bulanan, kuota, token listrik, dan konsumsi harian owner",
    openingIdr: opening,
    inflows,
    outflows,
    mutasiLines,
    dailyOpexLines,
    periodicOpexLines,
    recurring,
    subscriptions,
    subscriptionsCommittedIdr,
    commitmentLines: toCommitmentLines(subscriptions),
    inventory,
    inventoryTotalIdr,
    personal,
    personalTotalIdr,
    prive,
    priveTotalIdr,
    exchangeDeposits,
    exchangeDepositsTotalIdr,
    web3Deposits,
    web3DepositsTotalIdr,
    infrastructure,
    infrastructureTotalIdr,
    utilities,
    utilitiesTotalIdr,
    opex,
    totalInflowIdr,
    totalOutflowIdr,
    closingIdr: roundIdr(opening + totalInflowIdr - totalOutflowIdr),
  };
}
