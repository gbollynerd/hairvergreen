// All amounts are integer minor units (kobo). Display conversion is presentational only —
// orders are always created and charged in the base currency (NGN).

export type DisplayCurrency = { code: string; symbol: string; rate: number };

export const BASE_CURRENCY: DisplayCurrency = { code: 'NGN', symbol: '₦', rate: 1 };

export function formatMoney(minor: number | null | undefined, currency: DisplayCurrency = BASE_CURRENCY, opts?: { exact?: boolean }) {
  const naira = (minor ?? 0) / 100;
  const value = currency.code === 'NGN' ? naira : naira / (currency.rate || 1);
  const digits = currency.code === 'NGN' ? (opts?.exact && value % 1 ? 2 : 0) : 2;
  const n = new Intl.NumberFormat('en-NG', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  return `${currency.symbol}${n}`;
}

export const toMinor = (major: number | string) => Math.round(Number(major || 0) * 100);
export const toMajor = (minor: number | null | undefined) => (minor ?? 0) / 100;

export function percentOff(price: number, compareAt?: number | null) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
