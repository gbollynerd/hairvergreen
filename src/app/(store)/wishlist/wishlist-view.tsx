'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ProductCardData } from '@/lib/types';
import { useStore } from '@/components/store/store-provider';
import { ProductCard } from '@/components/store/product-card';

export function WishlistView() {
  const { wishlist, user } = useStore();
  const [items, setItems] = useState<ProductCardData[] | null>(null);
  const key = wishlist.join(',');
  useEffect(() => {
    if (!key) { setItems([]); return; }
    fetch(`/api/products/cards?ids=${key}`).then((r) => r.json()).then((d) => setItems(d.products ?? []));
  }, [key]);
  return (
    <div className="mt-10">
      {!user && <p className="mb-8 bg-panel px-5 py-4 text-[14px]">Your wishlist is saved on this device. <Link href="/login?next=/wishlist" className="underline">Sign in</Link> to keep it across devices and get restock alerts.</p>}
      {items === null ? <p className="text-muted">Loading…</p> : items.length === 0 ? (
        <div className="py-16 text-center"><p className="font-display text-[26px]">Nothing saved yet.</p><p className="mt-2 text-muted">Tap the heart on any piece to keep it here.</p><Link href="/shop" className="btn btn-primary mt-6">Explore the collection</Link></div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}
    </div>
  );
}
