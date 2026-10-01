'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProductCardData } from '@/lib/types';
import { useStore } from '@/components/store/store-provider';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/store/price';

export function AccountWishlist({ items }: { items: { product: ProductCardData; price_at_add: number | null; notify_restock: boolean }[] }) {
  const { toggleWishlist, addToCart, setQuickView, money } = useStore();
  const router = useRouter();
  if (!items.length) return <div className="bg-panel p-10 text-center"><p className="font-display text-[24px]">Your wishlist is empty.</p><Link href="/shop" className="btn btn-primary mt-5">Discover pieces</Link></div>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map(({ product: p, price_at_add }) => {
        const dropped = price_at_add && p.price_min < price_at_add;
        return (
          <li key={p.id} className="flex gap-4 py-5">
            <Link href={`/products/${p.slug}`} className="relative h-28 w-24 shrink-0 bg-panel"><Media src={p.images[0]?.url} alt={p.name} fill sizes="96px" /></Link>
            <div className="flex flex-1 flex-col gap-1 text-[14px]">
              <Link href={`/products/${p.slug}`} className="font-display text-[19px]">{p.name}</Link>
              <Price amount={p.price_min} compareAt={p.compare_at} from={p.price_max > p.price_min} size="sm" />
              {dropped && <p className="text-[12px] text-sale">Price dropped since you saved it (was {money(price_at_add)})</p>}
              <p className={p.in_stock ? 'text-[12px] text-muted' : 'text-[12px] text-sale'}>{p.in_stock ? 'In stock' : 'Sold out — we’ll email you when it’s back'}</p>
              <div className="mt-auto flex gap-4 pt-2 text-[13px]">
                {p.in_stock && <button type="button" className="underline" onClick={async () => {
                  if (p.default_variant_id && p.product_type !== 'bundle_deal') { const ok = await addToCart({ product_id: p.id, variant_id: p.default_variant_id, name: p.name, price: p.price_min }); if (ok) { await toggleWishlist(p.id); router.refresh(); } }
                  else setQuickView(p.slug);
                }}>Move to bag</button>}
                <button type="button" className="text-muted underline" onClick={async () => { await toggleWishlist(p.id); router.refresh(); }}>Remove</button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
