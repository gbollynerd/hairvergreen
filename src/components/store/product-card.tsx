'use client';
import Link from 'next/link';
import { Eye, Plus } from 'lucide-react';
import type { ProductCardData } from '@/lib/types';
import { CardMediaView } from './card-media';
import { Stars } from '@/components/ui/stars';
import { Price } from './price';
import { WishlistButton } from './wishlist-button';
import { useStore } from './store-provider';
import { percentOff } from '@/lib/money';
import { cn } from '@/lib/utils';

export function ProductCard({ p, priority, className, sizes = '(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw' }: { p: ProductCardData; priority?: boolean; className?: string; sizes?: string }) {
  const { addToCart, setQuickView } = useStore();
  const off = percentOff(p.price_min, p.compare_at);
  const quickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (p.default_variant_id && p.product_type !== 'bundle_deal' && p.product_type !== 'custom_unit') {
      await addToCart({ product_id: p.id, variant_id: p.default_variant_id, name: p.name, price: p.price_min });
    } else setQuickView(p.slug);
  };
  return (
    <article className={cn('group relative flex flex-col', className)}>
      <Link href={`/products/${p.slug}`} className="relative block aspect-[4/5] overflow-hidden bg-panel" aria-label={p.name}>
        <CardMediaView images={p.images} name={p.name} sizes={sizes} priority={priority} />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {!p.in_stock && <span className="bg-surface/95 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">Sold out</span>}
          {p.in_stock && off > 0 && <span className="bg-sale px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white">−{off}%</span>}
          {p.is_new && <span className="bg-primary px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-primary-contrast">New</span>}
        </div>
      </Link>
      <WishlistButton productId={p.id} name={p.name} className="absolute right-2 top-2 grid h-10 w-10 place-items-center bg-surface/0 text-ink" />
      <div className="mt-4 flex flex-1 flex-col gap-1.5 px-0.5">
        <h3 className="font-display text-[19px] leading-snug md:text-[21px]"><Link href={`/products/${p.slug}`} className="link-underline">{p.name}</Link></h3>
        {p.rating_count > 0 && (
          <div className="flex items-center gap-2 text-[12px] text-muted"><Stars value={p.rating_avg} size={11} /> <span>({p.rating_count})</span></div>
        )}
        <Price amount={p.price_min} compareAt={p.compare_at} from={p.price_max > p.price_min} />
        <div className="mt-2 flex min-w-0 gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <button type="button" onClick={quickAdd} disabled={!p.in_stock} className="btn btn-outline btn-sm min-w-0 flex-1 !px-2 sm:!px-4" aria-label={`Quick add ${p.name}`}>
            <Plus size={14} strokeWidth={1.5} /> {p.in_stock ? (p.default_variant_id && p.product_type !== 'bundle_deal' ? 'Add' : 'Choose') : 'Sold out'}
          </button>
          <button type="button" onClick={(e) => { e.preventDefault(); setQuickView(p.slug); }} className="btn btn-outline btn-sm px-3 max-[389px]:hidden" aria-label={`Quick view ${p.name}`}>
            <Eye size={15} strokeWidth={1.4} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ items, className }: { items: ProductCardData[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4', className)}>
      {items.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}
    </div>
  );
}
