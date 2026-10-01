'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Minus, Plus, Truck, Tag, X } from 'lucide-react';
import { useStore } from './store-provider';
import { Dialog } from '@/components/ui/dialog';
import { Media } from '@/components/ui/media';
import { track } from '@/lib/analytics-client';
import type { ProductCardData } from '@/lib/types';
import type { PricedLine } from '@/lib/commerce/pricing';
import { cn } from '@/lib/utils';

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, cartAction, cartLoading, money, addToCart } = useStore();
  const [code, setCode] = useState('');
  const [recs, setRecs] = useState<ProductCardData[]>([]);
  const lines = cart?.lines ?? [];
  const idsKey = lines.map((l) => l.product_id).join(',');

  useEffect(() => {
    if (!cartOpen) return;
    track('view_cart', { value: cart?.total });
    fetch(`/api/recommendations?ids=${idsKey}`).then((r) => r.json()).then((d) => setRecs((d.products ?? []).filter((p: ProductCardData) => !idsKey.includes(p.id)).slice(0, 4))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartOpen, idsKey]);

  const fs = cart?.free_shipping;
  const pct = fs && fs.threshold ? Math.min(100, Math.round(((fs.threshold - fs.remaining) / fs.threshold) * 100)) : 0;

  return (
    <Dialog open={cartOpen} onClose={() => setCartOpen(false)} label="Shopping bag" variant="drawer-right">
      <div className="flex h-16 shrink-0 items-center border-b border-line px-6">
        <h2 className="font-display text-[24px]">Your bag {cart?.item_count ? <span className="text-muted">({cart.item_count})</span> : null}</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {fs && lines.length > 0 && (
          <div className="border-b border-line px-6 py-4">
            <p className="flex items-center gap-2 text-[13px]"><Truck size={15} strokeWidth={1.4} />
              {fs.remaining > 0 ? <>You&apos;re <strong className="font-medium">{money(fs.remaining)}</strong> away from free delivery.</> : <>You&apos;ve unlocked free delivery.</>}
            </p>
            <div className="mt-2 h-[3px] bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to free delivery">
              <div className="h-full bg-accent-strong transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {lines.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-[26px]">Your bag is empty.</p>
            <p className="mt-2 text-muted">Discover textures, units and bundles made to be noticed.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/wigs" onClick={() => setCartOpen(false)} className="btn btn-primary">Shop wigs</Link>
              <Link href="/hair" onClick={() => setCartOpen(false)} className="btn btn-outline">Shop hair</Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-line px-6">{lines.map((l) => <Line key={l.id} l={l} />)}</ul>
        )}

        {(cart?.saved?.length ?? 0) > 0 && (
          <div className="border-t border-line px-6 py-5">
            <p className="eyebrow mb-3">Saved for later</p>
            <ul className="space-y-4">
              {cart!.saved.map((l) => (
                <li key={l.id} className="flex gap-3">
                  <div className="relative h-20 w-16 shrink-0 bg-panel"><Media src={l.image} alt={l.name} fill sizes="64px" /></div>
                  <div className="flex-1 text-[13px]">
                    <p className="font-display text-[16px]">{l.name}</p>
                    <p className="text-muted">{l.variant_title}</p>
                    <div className="mt-1 flex gap-4">
                      <button type="button" className="underline" onClick={() => cartAction({ action: 'save_for_later', line_id: l.id, saved: false })}>Move to bag</button>
                      <button type="button" className="text-muted underline" onClick={() => cartAction({ action: 'remove', line_id: l.id })}>Remove</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recs.length > 0 && (
          <div className="border-t border-line px-6 py-5">
            <p className="eyebrow mb-3">You may also like</p>
            <ul className="grid grid-cols-2 gap-3">
              {recs.map((p) => (
                <li key={p.id} className="text-[13px]">
                  <Link href={`/products/${p.slug}`} onClick={() => setCartOpen(false)} className="block">
                    <div className="relative aspect-[4/5] bg-panel"><Media src={p.images[0]?.url} alt={p.name} fill sizes="180px" /></div>
                    <p className="mt-2 font-display text-[15px] leading-snug">{p.name}</p>
                  </Link>
                  <div className="flex items-center justify-between">
                    <span>{money(p.price_min)}</span>
                    {p.default_variant_id && p.product_type !== 'bundle_deal' && (
                      <button type="button" onClick={() => addToCart({ product_id: p.id, variant_id: p.default_variant_id!, name: p.name, price: p.price_min })} className="caps text-[10px] underline">Add</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {lines.length > 0 && cart && (
        <div className="shrink-0 border-t border-line bg-surface px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <form className="mb-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!code.trim()) return; const r = await cartAction({ action: 'apply_code', code }); if (r && !r.error) { setCode(''); track('apply_coupon', { coupon: code }); } }}>
            <label htmlFor="cart-code" className="sr-only">Promo code</label>
            <input id="cart-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Have a promo code?" className="input !min-h-[42px] flex-1 uppercase" autoComplete="off" />
            <button type="submit" className="btn btn-outline btn-sm" disabled={cartLoading}>Apply</button>
          </form>
          {cart.codes.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {cart.codes.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 bg-panel px-2 py-1 text-[12px]"><Tag size={12} />{c}
                  <button type="button" aria-label={`Remove code ${c}`} onClick={() => cartAction({ action: 'remove_code', code: c })}><X size={12} /></button></span>
              ))}
            </div>
          )}
          <dl className="space-y-1.5 text-[14px]">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{money(cart.subtotal)}</dd></div>
            {cart.discounts.filter((d) => d.amount > 0).map((d) => (
              <div key={d.id} className="flex justify-between text-sale"><dt>{d.label}</dt><dd className="tabular-nums">−{money(d.amount)}</dd></div>
            ))}
            <div className="flex justify-between text-muted"><dt>Delivery</dt><dd>Calculated at checkout</dd></div>
          </dl>
          <Link href="/checkout" onClick={() => setCartOpen(false)} aria-disabled={cart.has_errors}
            className={cn('btn btn-primary btn-block mt-4', cart.has_errors && 'pointer-events-none opacity-50')}>
            Checkout · {money(cart.subtotal - cart.discount_total)}
          </Link>
          {cart.has_errors && <p className="mt-2 text-center text-[12px] text-sale">Please update the items marked above.</p>}
          <p className="mt-3 text-center text-[11px] text-muted">Secure checkout by Paystack · Card, transfer, USSD & more</p>
        </div>
      )}
    </Dialog>
  );
}

function Line({ l }: { l: PricedLine }) {
  const { cartAction, cartLoading, money, setCartOpen } = useStore();
  return (
    <li className="flex gap-4 py-5">
      <Link href={`/products/${l.slug}`} onClick={() => setCartOpen(false)} className="relative h-[108px] w-[86px] shrink-0 overflow-hidden bg-panel">
        <Media src={l.image} alt={l.name} fill sizes="86px" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between gap-3">
          <Link href={`/products/${l.slug}`} onClick={() => setCartOpen(false)} className="font-display text-[17px] leading-snug">{l.name}</Link>
          <span className="shrink-0 text-[14px] tabular-nums">{money(l.line_subtotal)}</span>
        </div>
        {l.variant_title && l.variant_title !== 'Default' && <p className="mt-0.5 line-clamp-3 text-[12px] leading-5 text-muted">{l.variant_title}</p>}
        {l.compare_at_price && l.compare_at_price > l.unit_price && <p className="text-[12px] text-sale">You save {money((l.compare_at_price - l.unit_price) * l.quantity)}</p>}
        {l.requires_review && <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-accent-strong">Made to order · confirmed with you</p>}
        {l.error && <p className="mt-1 text-[12px] text-sale" role="alert">{l.error}</p>}
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex items-center border border-line" role="group" aria-label={`Quantity for ${l.name}`}>
            <button type="button" className="grid h-9 w-9 place-items-center disabled:opacity-40" disabled={cartLoading}
              onClick={() => cartAction({ action: 'update', line_id: l.id, quantity: l.quantity - 1 })} aria-label="Decrease quantity"><Minus size={13} /></button>
            <span className="w-8 text-center text-[13px] tabular-nums" aria-live="polite">{l.quantity}</span>
            <button type="button" className="grid h-9 w-9 place-items-center disabled:opacity-40" disabled={cartLoading || (l.available !== null && l.quantity >= l.available)}
              onClick={() => cartAction({ action: 'update', line_id: l.id, quantity: l.quantity + 1 })} aria-label="Increase quantity"><Plus size={13} /></button>
          </div>
          <div className="flex gap-3 text-[12px] text-muted">
            <button type="button" className="underline hover:text-ink" onClick={() => cartAction({ action: 'save_for_later', line_id: l.id, saved: true })}>Save for later</button>
            <button type="button" className="underline hover:text-ink" onClick={() => cartAction({ action: 'remove', line_id: l.id })}>Remove</button>
          </div>
        </div>
      </div>
    </li>
  );
}
