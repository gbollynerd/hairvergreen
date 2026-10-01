'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Group = { key: string; options: { value: string; label: string }[] };
const TITLES: Record<string, string> = { texture: 'Texture', length: 'Length', color: 'Colour', lace: 'Lace', density: 'Density', construction: 'Construction' };

function useFilterNav() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const update = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mut(p);
    p.delete('page');
    start(() => router.replace(`${pathname}${p.toString() ? '?' + p.toString() : ''}`, { scroll: false }));
  };
  const values = (k: string) => (sp.get(k) || '').split(',').filter(Boolean);
  const toggle = (k: string, v: string) => update((p) => {
    const cur = (p.get(k) || '').split(',').filter(Boolean);
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    if (next.length) p.set(k, next.join(',')); else p.delete(k);
  });
  const setParam = (k: string, v: string | null) => update((p) => { if (v) p.set(k, v); else p.delete(k); });
  return { sp, values, toggle, setParam, update, pending };
}

function FilterBody({ groups, priceMin, priceMax, categories }: { groups: Group[]; priceMin: number; priceMax: number; categories?: { slug: string; name: string }[] }) {
  const { sp, values, toggle, setParam, update } = useFilterNav();
  const [min, setMin] = useState(sp.get('min') ?? '');
  const [max, setMax] = useState(sp.get('max') ?? '');
  return (
    <div className="space-y-8">
      {categories && categories.length > 0 && (
        <fieldset>
          <legend className="label mb-3">Category</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button key={c.slug} type="button" className="chip !min-h-[36px] text-[12px]" aria-pressed={sp.get('category') === c.slug}
                onClick={() => setParam('category', sp.get('category') === c.slug ? null : c.slug)}>{c.name}</button>
            ))}
          </div>
        </fieldset>
      )}
      {groups.map((g) => (
        <fieldset key={g.key}>
          <legend className="label mb-3">{TITLES[g.key] ?? g.key}</legend>
          <div className={cn('flex flex-wrap gap-2')}>
            {g.options.map((o) => (
              <button key={o.value} type="button" className="chip !min-h-[36px] text-[12px]" aria-pressed={values(g.key).includes(o.value)} onClick={() => toggle(g.key, o.value)}>{o.label}</button>
            ))}
          </div>
        </fieldset>
      ))}
      <fieldset>
        <legend className="label mb-3">Price (₦)</legend>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); update((p) => { if (min) p.set('min', min); else p.delete('min'); if (max) p.set('max', max); else p.delete('max'); }); }}>
          <label className="sr-only" htmlFor="pmin">Minimum price</label>
          <input id="pmin" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} placeholder={String(priceMin)} className="input !min-h-[40px] !px-2 text-[13px]" />
          <span aria-hidden>–</span>
          <label className="sr-only" htmlFor="pmax">Maximum price</label>
          <input id="pmax" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} placeholder={String(priceMax)} className="input !min-h-[40px] !px-2 text-[13px]" />
          <button type="submit" className="btn btn-outline btn-sm !px-3">Go</button>
        </form>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="label mb-3">Refine</legend>
        {[['availability', 'in_stock', 'In stock only'], ['sale', '1', 'On sale'], ['new', '1', 'New arrivals'], ['rating', '4', 'Rated 4★ & up']].map(([k, v, l]) => (
          <label key={k} className="flex cursor-pointer items-center gap-3 text-[14px]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--hg-primary)]" checked={sp.get(k) === v} onChange={(e) => setParam(k, e.target.checked ? v : null)} />{l}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export function FilterPanel(props: { groups: Group[]; priceMin: number; priceMax: number; categories?: { slug: string; name: string }[]; total: number }) {
  const [open, setOpen] = useState(false);
  const { sp } = useFilterNav();
  const activeCount = ['texture', 'length', 'color', 'lace', 'density', 'construction', 'min', 'max', 'availability', 'sale', 'new', 'rating', 'category']
    .reduce((n, k) => n + (sp.get(k) ? (sp.get(k)!.split(',').length) : 0), 0);
  return (
    <>
      <aside className="hidden lg:block" aria-label="Filters"><div className="sticky top-[150px]"><FilterBody {...props} /></div></aside>
      <div className="lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-outline btn-sm w-full"><SlidersHorizontal size={14} /> Filter {activeCount > 0 && `(${activeCount})`}</button>
        <Dialog open={open} onClose={() => setOpen(false)} label="Filters" variant="sheet" className="rounded-t-xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
            <p className="font-display text-[22px]">Filter</p>
          </div>
          <div className="px-5 py-6"><FilterBody {...props} /></div>
          <div className="sticky bottom-0 border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-primary btn-block">Show {props.total} results</button>
          </div>
        </Dialog>
      </div>
    </>
  );
}

export function SortSelect() {
  const { sp, setParam, pending } = useFilterNav();
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <span className="text-muted">Sort</span>
      <select className="bg-transparent py-1 text-[13px] outline-none" value={sp.get('sort') ?? 'featured'} onChange={(e) => setParam('sort', e.target.value === 'featured' ? null : e.target.value)} aria-busy={pending}>
        <option value="featured">Featured</option><option value="best_selling">Best selling</option><option value="newest">Newest</option>
        <option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="rating">Top rated</option>
      </select>
    </label>
  );
}

export function ActiveFilters({ labels }: { labels: Record<string, Record<string, string>> }) {
  const { sp, toggle, setParam, update } = useFilterNav();
  const chips: { k: string; v: string; label: string }[] = [];
  for (const k of Object.keys(TITLES)) for (const v of (sp.get(k) || '').split(',').filter(Boolean)) chips.push({ k, v, label: labels[k]?.[v] ?? v });
  if (sp.get('min') || sp.get('max')) chips.push({ k: 'price', v: '', label: `₦${sp.get('min') || 0} – ₦${sp.get('max') || '∞'}` });
  for (const [k, l] of [['availability', 'In stock'], ['sale', 'On sale'], ['new', 'New'], ['rating', '4★ & up']] as const) if (sp.get(k)) chips.push({ k, v: '', label: l });
  if (!chips.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button key={c.k + c.v} type="button" onClick={() => c.k === 'price' ? update((p) => { p.delete('min'); p.delete('max'); }) : c.v ? toggle(c.k, c.v) : setParam(c.k, null)}
          className="inline-flex items-center gap-1.5 bg-panel px-3 py-1.5 text-[12px]" aria-label={`Remove filter ${c.label}`}>{c.label} <X size={12} /></button>
      ))}
      <button type="button" onClick={() => update((p) => { [...p.keys()].filter((k) => k !== 'q' && k !== 'sort' && k !== 'category').forEach((k) => p.delete(k)); })} className="text-[12px] underline">Clear all</button>
    </div>
  );
}
