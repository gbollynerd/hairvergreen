'use client';
import { useStore } from './store-provider';

export function CurrencySelect() {
  const { currencies, currency, setCurrency } = useStore();
  if (currencies.length < 2) return null;
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Display currency</span>
      <select value={currency.code} onChange={(e) => setCurrency(e.target.value)} className="bg-transparent text-[12px] outline-none" title="Prices are shown in your chosen currency and charged in NGN">
        {currencies.map((c) => <option key={c.code} value={c.code} className="text-ink">{c.code} ({c.symbol})</option>)}
      </select>
    </label>
  );
}
