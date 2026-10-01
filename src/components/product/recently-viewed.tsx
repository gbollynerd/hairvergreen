'use client';
import { useEffect, useState } from 'react';
import type { ProductCardData } from '@/lib/types';
import { ProductRail } from '@/components/sections/product-rail';

export function RecentlyViewed({ exclude }: { exclude?: string }) {
  const [items, setItems] = useState<ProductCardData[]>([]);
  useEffect(() => {
    let slugs: string[] = [];
    try { slugs = JSON.parse(localStorage.getItem('hg_recently_viewed') || '[]').filter((s: string) => s !== exclude).slice(0, 8); } catch {}
    if (!slugs.length) return;
    fetch(`/api/products/cards?slugs=${slugs.join(',')}`).then((r) => r.json()).then((d) => setItems(d.products ?? [])).catch(() => {});
  }, [exclude]);
  if (!items.length) return null;
  return (
    <section className="container-x mt-20 md:mt-28" aria-labelledby="rv-h">
      <h2 id="rv-h" className="display-3 mb-10">Recently viewed</h2>
      <ProductRail items={items} />
    </section>
  );
}
