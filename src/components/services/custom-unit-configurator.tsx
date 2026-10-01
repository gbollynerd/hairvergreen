'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { priceCustomUnit, type CustomUnitConfig } from '@/lib/commerce/custom-unit';
import { useStore } from '@/components/store/store-provider';
import { cn } from '@/lib/utils';

export function CustomUnitConfigurator({ productId, variantId, basePrice, config }: { productId: string; variantId?: string; basePrice: number; config: CustomUnitConfig }) {
  const { addToCart, money } = useStore();
  const initial: Record<string, string | string[]> = {};
  for (const g of config.groups) if (g.required && !g.multiple) initial[g.key] = g.options[0]?.value;
  const [sel, setSel] = useState<Record<string, string | string[]>>(initial);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const priced = useMemo(() => priceCustomUnit(basePrice, config, sel), [basePrice, config, sel]);

  const toggle = (key: string, value: string, multiple?: boolean) => setSel((s) => {
    if (!multiple) return { ...s, [key]: value };
    const cur = (s[key] as string[]) ?? [];
    return { ...s, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
  });

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
      <div className="space-y-9">
        <div><p className="eyebrow">Configure</p><h2 className="display-2 mt-2">Design your unit</h2></div>
        {config.groups.map((g) => (
          <fieldset key={g.key}>
            <legend className="label mb-3">{g.label}{g.multiple ? ' (choose any)' : ''}</legend>
            <div className="flex flex-wrap gap-2" role={g.multiple ? 'group' : 'radiogroup'}>
              {g.options.map((o) => {
                const on = g.multiple ? ((sel[g.key] as string[]) ?? []).includes(o.value) : sel[g.key] === o.value;
                return (
                  <button key={o.value} type="button" role={g.multiple ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => toggle(g.key, o.value, g.multiple)} className={cn('chip', 'flex-col !items-start !py-2 text-left')}>
                    <span>{o.label}</span>{o.price > 0 && <span className={cn('text-[11px]', on ? 'opacity-80' : 'text-muted')}>+{money(o.price)}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <label className="field"><span className="label">Anything else? (optional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 800))} className="input" placeholder="Hairline preferences, head measurements, reference looks…" /></label>
      </div>
      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="border border-line bg-surface p-6">
          <p className="eyebrow">Your unit</p>
          <ul className="mt-4 space-y-1.5 text-[14px] text-muted">{priced.summary.map((s) => <li key={s}>{s}</li>)}</ul>
          <div className="mt-6 flex items-baseline justify-between border-t border-line pt-4"><span className="text-[14px]">Estimated price</span><span className="font-display text-[30px] tabular-nums">{money(priced.price)}</span></div>
          <p className="mt-2 text-[12px] text-muted">Every custom unit is reviewed by our team. We confirm the final details and timeline with you before production — typically 7–14 business days.</p>
          {priced.errors.length > 0 && <p className="mt-3 text-[13px] text-sale">{priced.errors[0]}</p>}
          <button type="button" disabled={busy || !variantId || priced.errors.length > 0} className="btn btn-primary btn-block mt-5"
            onClick={async () => { setBusy(true); await addToCart({ product_id: productId, variant_id: variantId!, customization: { ...sel, notes }, name: 'Custom unit', price: priced.price }); setBusy(false); }}>
            {busy ? 'Adding…' : 'Add to bag'}
          </button>
          <Link href="/services/consultation" className="btn btn-outline btn-block mt-3">Talk to a stylist first</Link>
        </div>
      </aside>
    </div>
  );
}
