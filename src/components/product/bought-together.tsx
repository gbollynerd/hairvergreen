'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { ProductCardData } from '@/lib/types';
import { Media, MediaThumb } from '@/components/ui/media';
import { useStore } from '@/components/store/store-provider';

export function BoughtTogether({ main, items }: { main: ProductCardData; items: ProductCardData[] }) {
  const { money, addToCart, setQuickView } = useStore();
  const [picked, setPicked] = useState<string[]>(items.filter((i) => i.in_stock).map((i) => i.id));
  const all = [main, ...items];
  const chosen = items.filter((i) => picked.includes(i.id));
  const total = chosen.reduce((s, p) => s + p.price_min, 0);
  const addAll = async () => {
    for (const p of chosen) {
      if (p.default_variant_id) await addToCart({ product_id: p.id, variant_id: p.default_variant_id, name: p.name, price: p.price_min });
      else { setQuickView(p.slug); return; }
    }
  };
  return (
    <section className="container-x mt-20 md:mt-28" aria-labelledby="fbt-h">
      <p className="eyebrow mb-3">Complete the look</p>
      <h2 id="fbt-h" className="display-3 mb-8">Frequently bought together</h2>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
          {all.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              {i > 0 && <Plus size={16} className="shrink-0 text-muted" />}
              <Link href={`/products/${p.slug}`} className="relative block h-36 w-28 shrink-0 overflow-hidden bg-panel md:h-44 md:w-36"><MediaThumb item={p.images[0]} alt={p.name} fill sizes="144px" /></Link>
            </div>
          ))}
        </div>
        <div className="flex-1 space-y-3">
          <p className="text-[14px] text-muted">This piece — plus:</p>
          {items.map((p) => (
            <label key={p.id} className="flex items-center gap-3 text-[14px]">
              <input type="checkbox" className="h-4 w-4 accent-[var(--hg-primary)]" disabled={!p.in_stock} checked={picked.includes(p.id)} onChange={(e) => setPicked((x) => e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id))} />
              <span className="flex-1">{p.name}{!p.default_variant_id && <span className="text-muted"> (choose options)</span>}</span><span className="tabular-nums">{p.price_max > p.price_min && 'from '}{money(p.price_min)}</span>
            </label>
          ))}
          <button type="button" disabled={!chosen.length} onClick={addAll} className="btn btn-primary mt-3">Add {chosen.length} to bag · {money(total)}</button>
        </div>
      </div>
    </section>
  );
}
