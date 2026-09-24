export type CurrencyCategory = "popular" | "bitcoin" | "fiat";

export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
  category: CurrencyCategory;
  icon: "usd" | "eur" | "gbp" | "btc" | "eth" | "flag";
  flag?: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", label: "United States Dollar", symbol: "$", category: "popular", icon: "usd" },
  { code: "EUR", label: "Euro", symbol: "€", category: "popular", icon: "eur" },
  { code: "GBP", label: "Pound Sterling", symbol: "£", category: "popular", icon: "gbp" },
  { code: "BTC", label: "Bitcoin", symbol: "₿", category: "popular", icon: "btc" },
  { code: "ETH", label: "Ethereum", symbol: "Ξ", category: "popular", icon: "eth" },
  { code: "BITS", label: "Bits", symbol: "BITS", category: "bitcoin", icon: "btc" },
  { code: "SAT", label: "Satoshi", symbol: "SAT", category: "bitcoin", icon: "btc" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", category: "fiat", icon: "flag", flag: "🇦🇺" },
  { code: "BRL", label: "Brazilian Real", symbol: "R$", category: "fiat", icon: "flag", flag: "🇧🇷" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$", category: "fiat", icon: "flag", flag: "🇨🇦" },
  { code: "CHF", label: "Swiss Franc", symbol: "Fr", category: "fiat", icon: "flag", flag: "🇨🇭" },
  { code: "CLP", label: "Chilean Peso", symbol: "$", category: "fiat", icon: "flag", flag: "🇨🇱" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥", category: "fiat", icon: "flag", flag: "🇨🇳" },
  { code: "CZK", label: "Czech Koruna", symbol: "Kč", category: "fiat", icon: "flag", flag: "🇨🇿" },
  { code: "DKK", label: "Danish Krone", symbol: "kr", category: "fiat", icon: "flag", flag: "🇩🇰" },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$", category: "fiat", icon: "flag", flag: "🇭🇰" },
  { code: "HUF", label: "Hungarian Forint", symbol: "Ft", category: "fiat", icon: "flag", flag: "🇭🇺" },
  { code: "IDR", label: "Indonesian Rupiah", symbol: "Rp", category: "fiat", icon: "flag", flag: "🇮🇩" },
  { code: "INR", label: "Indian Rupee", symbol: "₹", category: "fiat", icon: "flag", flag: "🇮🇳" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥", category: "fiat", icon: "flag", flag: "🇯🇵" },
  { code: "KRW", label: "South Korean Won", symbol: "₩", category: "fiat", icon: "flag", flag: "🇰🇷" },
  { code: "MXN", label: "Mexican Peso", symbol: "$", category: "fiat", icon: "flag", flag: "🇲🇽" },
  { code: "MYR", label: "Malaysian Ringgit", symbol: "RM", category: "fiat", icon: "flag", flag: "🇲🇾" },
  { code: "NOK", label: "Norwegian Krone", symbol: "kr", category: "fiat", icon: "flag", flag: "🇳🇴" },
  { code: "NZD", label: "New Zealand Dollar", symbol: "NZ$", category: "fiat", icon: "flag", flag: "🇳🇿" },
  { code: "PHP", label: "Philippine Peso", symbol: "₱", category: "fiat", icon: "flag", flag: "🇵🇭" },
  { code: "PLN", label: "Polish Zloty", symbol: "zł", category: "fiat", icon: "flag", flag: "🇵🇱" },
  { code: "SEK", label: "Swedish Krona", symbol: "kr", category: "fiat", icon: "flag", flag: "🇸🇪" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$", category: "fiat", icon: "flag", flag: "🇸🇬" },
  { code: "THB", label: "Thai Baht", symbol: "฿", category: "fiat", icon: "flag", flag: "🇹🇭" },
  { code: "TRY", label: "Turkish Lira", symbol: "₺", category: "fiat", icon: "flag", flag: "🇹🇷" },
  { code: "TWD", label: "New Taiwan Dollar", symbol: "NT$", category: "fiat", icon: "flag", flag: "🇹🇼" },
  { code: "ZAR", label: "South African Rand", symbol: "R", category: "fiat", icon: "flag", flag: "🇿🇦" },
];

export function getCurrency(code: string): CurrencyOption | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

export function currenciesByCategory(category: CurrencyCategory): CurrencyOption[] {
  return CURRENCIES.filter((c) => c.category === category);
}
