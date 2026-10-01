'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Minus, Plus, ShieldCheck, Truck, RefreshCcw, Check, BellRing } from 'lucide-react';
import type { ProductFull, Variant, BundleItem } from '@/lib/types';
import { useStore } from '@/components/store/store-provider';
import { Price } from '@/components/store/price';
import { WishlistButton } from '@/components/store/wishlist-button';
import { Stars } from '@/components/ui/stars';
import { ProductGallery } from './product-gallery';
import { track } from '@/lib/analytics-client';
import { cn } from '@/lib/utils';

export type AttrMap = Record<string, Record<string, { label: string; sort: number; swatch: string | null }>>;

const OPTION_LABELS: Record<string, string> = { texture: 'Texture', length: 'Length', color: 'Colour', lace: 'Lace', density: 'Density', construction: 'Construction', cap_size: 'Cap size' };
const avail = (v: Variant) => !v.track_inventory || v.allow_backorder ? Infinity : Math.max(0, v.stock_on_hand - v.stock_reserved);

export function ProductView({ product, attrs, compact = false, initialOptions }: { product: ProductFull; attrs: AttrMap; compact?: boolean; initialOptions?: Record<string, string> }) {
  const router = useRouter();
  const { addToCart, money, setQuickView } = useStore();
  const variants = product.variants;
  const keys = product.option_keys.filter((k) => variants.some((v) => v.options?.[k]));

  const firstAvailable = variants.find((v) => avail(v) > 0) ?? variants[0];
  const initial = useMemo(() => {
    const fromUrl = initialOptions && variants.find((v) => keys.every((k) => !initialOptions[k] || v.options[k] === initialOptions[k]));
    return { ...(fromUrl ?? firstAvailable)?.options };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);
  const [sel, setSel] = useState<Record<string, string>>(initial);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [bundleSel, setBundleSel] = useState<Record<string, string>>({});

  const variant = variants.find((v) => keys.every((k) => v.options[k] === sel[k])) ?? (keys.length === 0 ? variants[0] : undefined);
  const stock = variant ? avail(variant) : 0;
  const isBundle = product.product_type === 'bundle_deal' && product.bundle;
  const isCustom = product.product_type === 'custom_unit';

  useEffect(() => {
    track('view_item', { product_id: product.id, value: variant?.price, name: product.name });
    try {
      const k = 'hg_recently_viewed';
      const list: string[] = JSON.parse(localStorage.getItem(k) || '[]');
      localStorage.setItem(k, JSON.stringify([product.slug, ...list.filter((s) => s !== product.slug)].slice(0, 12)));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const values = (k: string) => {
    const vals = [...new Set(variants.map((v) => v.options[k]).filter(Boolean))];
    return vals.sort((a, b) => (attrs[k]?.[a]?.sort ?? 99) - (attrs[k]?.[b]?.sort ?? 99) || a.localeCompare(b, undefined, { numeric: true }));
  };
  const choose = (k: string, val: string) => {
    const next = { ...sel, [k]: val };
    let match = variants.find((v) => keys.every((kk) => v.options[kk] === next[kk]));
    if (!match) match = variants.find((v) => v.options[k] === val && avail(v) > 0) ?? variants.find((v) => v.options[k] === val);
    const opts = match ? { ...match.options } : next;
    setSel(opts);
    setQty(1);
    track('select_variant', { product_id: product.id, variant_id: match?.id, [k]: val });
    if (!compact) {
      const params = new URLSearchParams(opts);
      window.history.replaceState(null, '', `?${params.toString()}`);
    }
  };
  const state = (k: string, val: string) => {
    const others = keys.filter((x) => x !== k);
    const cands = variants.filter((v) => v.options[k] === val && others.every((o) => !sel[o] || v.options[o] === sel[o]));
    if (!cands.length) return 'none';
    return cands.some((v) => avail(v) > 0) ? 'ok' : 'out';
  };

  // Bundle price
  const bundle = isBundle ? product.bundle! : null;
  const bundleInfo = useMemo(() => {
    if (!bundle) return null;
    let sum = 0; let missing: string | null = null; let outOfStock = false;
    for (const it of bundle.items) {
      const vid = it.variant_id ?? bundleSel[it.id];
      if (!vid || vid === 'none') { if (!it.is_optional) missing ??= it.label || it.product.name; continue; }
      const v = it.product.variants.find((x) => x.id === vid);
      if (!v) { missing ??= it.label || it.product.name; continue; }
      if (avail(v) < it.quantity * qty) outOfStock = true;
      sum += v.price * it.quantity;
    }
    const price = bundle.pricing_mode === 'fixed' ? (variants[0]?.price ?? 0)
      : bundle.pricing_mode === 'percent_off' ? Math.round(sum * (1 - bundle.value / 100)) : Math.max(0, sum - bundle.value * 100);
    return { sum, price, missing, outOfStock };
  }, [bundle, bundleSel, variants, qty]);

  const price = bundleInfo ? bundleInfo.price : variant?.price ?? product.price;
  const compare = bundleInfo ? (bundleInfo.sum > bundleInfo.price ? bundleInfo.sum : null) : variant?.compare_at_price ?? null;
  const canBuy = isBundle ? !bundleInfo?.missing && !bundleInfo?.outOfStock : !!variant && stock > 0 && qty <= stock;

  const add = async (buyNow = false) => {
    if (isCustom) { router.push('/services/custom-units'); setQuickView(null); return; }
    if (!canBuy || !variants[0]) return;
    setBusy(true);
    const ok = await addToCart({
      product_id: product.id, variant_id: (isBundle ? variants[0] : variant!).id, quantity: qty, name: product.name, price,
      bundle_selection: isBundle ? Object.fromEntries(bundle!.items.filter((i) => !i.variant_id).map((i) => [i.id, bundleSel[i.id] ?? 'none'])) : null,
    });
    setBusy(false);
    if (ok && buyNow) { setQuickView(null); router.push('/checkout'); }
    if (ok && compact) setQuickView(null);
  };

  const stockLabel = !variant ? 'Choose your options' : stock === Infinity ? 'In stock' : stock <= 0 ? 'Sold out' : stock <= variant.low_stock_threshold ? `Only ${stock} left` : 'In stock';

  return (
    <div className={cn('grid gap-8 lg:gap-14', compact ? 'md:grid-cols-2' : 'lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,1fr)]')}>
      <ProductGallery media={product.media} selection={sel} name={product.name} compact={compact} />

      <div className={cn(!compact && 'lg:sticky lg:top-[140px] lg:self-start')}>
        {product.category && !compact && (
          <p className="eyebrow mb-3"><Link href={`/${product.category.parent?.slug ?? product.category.slug}${product.category.parent ? '/' + product.category.slug : ''}`}>{product.category.name}</Link></p>
        )}
        <h1 className={cn('font-display', compact ? 'text-[30px]' : 'text-[34px] md:text-[44px]')}>{product.name}</h1>
        {product.rating_count > 0 && (
          <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-[13px] text-muted"><Stars value={Number(product.rating_avg)} /> {Number(product.rating_avg).toFixed(1)} · {product.rating_count} review{product.rating_count === 1 ? '' : 's'}</a>
        )}
        <div className="mt-4"><Price amount={price} compareAt={compare} size="lg" showSave from={isCustom} /></div>
        {bundle?.headline && <p className="mt-2 text-[13px] uppercase tracking-[0.16em] text-accent-strong">{bundle.headline}</p>}
        {product.short_description && <p className="mt-5 text-[15px] leading-7 text-muted">{product.short_description}</p>}

        {/* Variant selectors */}
        {!isBundle && !isCustom && keys.map((k) => (
          <fieldset key={k} className="mt-7">
            <legend className="mb-3 flex w-full items-center justify-between">
              <span className="label">{OPTION_LABELS[k] ?? k}: <span className="normal-case tracking-normal text-ink">{attrs[k]?.[sel[k]]?.label ?? sel[k]}</span></span>
              {k === 'length' && !compact && <a href="#length-guide" className="text-[12px] text-muted underline">Length guide</a>}
              {k === 'texture' && !compact && <Link href="/hair-guide" className="text-[12px] text-muted underline">Texture guide</Link>}
            </legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={OPTION_LABELS[k] ?? k}>
              {values(k).map((val) => {
                const st = state(k, val);
                const a = attrs[k]?.[val];
                return (
                  <button key={val} type="button" role="radio" aria-checked={sel[k] === val} data-unavailable={st !== 'ok'}
                    onClick={() => choose(k, val)} className={cn('chip', k === 'length' && 'min-w-[58px]')}
                    aria-label={`${a?.label ?? val}${st === 'out' ? ' — sold out' : st === 'none' ? ' — not available with current selection' : ''}`}>
                    {a?.swatch && k === 'color' && <span className="mr-2 inline-block h-3.5 w-3.5 rounded-full border border-line" style={{ background: a.swatch }} aria-hidden />}
                    {a?.label ?? val}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        {/* Bundle builder */}
        {isBundle && (
          <div className="mt-7 space-y-5">
            {bundle!.items.map((it) => <BundleRow key={it.id} it={it} attrs={attrs} value={bundleSel[it.id]} onChange={(v) => setBundleSel((s) => ({ ...s, [it.id]: v }))} money={money} />)}
            {bundleInfo && bundleInfo.sum > 0 && bundleInfo.sum > bundleInfo.price && (
              <div className="flex items-center justify-between bg-panel px-4 py-3 text-[14px]">
                <span>Regular total <s className="text-muted">{money(bundleInfo.sum)}</s></span>
                <span className="font-medium text-sale">You save {money(bundleInfo.sum - bundleInfo.price)}</span>
              </div>
            )}
          </div>
        )}

        {isCustom ? (
          <div className="mt-7 space-y-3">
            <Link href="/services/custom-units" className="btn btn-primary btn-block">Design your custom unit</Link>
            <Link href="/services/consultation" className="btn btn-outline btn-block">Book a consultation</Link>
          </div>
        ) : (
          <>
            <div className="mt-7 flex items-center gap-3">
              <div className="flex h-12 items-center border border-line" role="group" aria-label="Quantity">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-12 w-11 place-items-center" aria-label="Decrease quantity"><Minus size={14} /></button>
                <span className="w-8 text-center tabular-nums" aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(isBundle ? 5 : Math.min(20, stock), q + 1))} className="grid h-12 w-11 place-items-center" aria-label="Increase quantity"><Plus size={14} /></button>
              </div>
              <p className={cn('text-[13px]', stock <= 0 && !isBundle ? 'text-sale' : 'text-muted')} aria-live="polite">
                {isBundle ? (bundleInfo?.missing ? `Choose: ${bundleInfo.missing}` : bundleInfo?.outOfStock ? 'A selected item is sold out' : 'Ready to add') : stockLabel}
              </p>
            </div>

            <div className="mt-4 grid gap-3" id="buy-buttons">
              {canBuy || isBundle ? (
                <>
                  <button type="button" onClick={() => add(false)} disabled={busy || !canBuy} className="btn btn-primary btn-block">
                    {busy ? 'Adding…' : `Add to bag · ${money(price * qty)}`}
                  </button>
                  <button type="button" onClick={() => add(true)} disabled={busy || !canBuy} className="btn btn-outline btn-block">Buy now</button>
                </>
              ) : (
                <BackInStock productId={product.id} variantId={variant?.id} />
              )}
            </div>
          </>
        )}

        <div className="mt-5 flex items-center justify-between">
          <WishlistButton productId={product.id} name={product.name} withLabel />
          {compact && <Link href={`/products/${product.slug}`} onClick={() => setQuickView(null)} className="caps text-[11px] underline">View full details</Link>}
        </div>

        {!compact && (
          <ul className="mt-8 grid gap-3 border-t border-line pt-6 text-[13px] text-muted">
            <li className="flex items-center gap-3"><ShieldCheck size={17} strokeWidth={1.3} className="text-accent-strong" /> Secure checkout with Paystack — card, transfer, USSD & more</li>
            <li className="flex items-center gap-3"><Truck size={17} strokeWidth={1.3} className="text-accent-strong" /> Ships from Lagos · delivery options shown at checkout</li>
            <li className="flex items-center gap-3"><RefreshCcw size={17} strokeWidth={1.3} className="text-accent-strong" /> <Link href="/policies/refund-policy" className="underline">Returns & exchanges policy</Link></li>
          </ul>
        )}
      </div>

      {!compact && !isCustom && (
        <StickyBar name={product.name} price={price} disabled={!canBuy || busy} onAdd={() => add(false)} />
      )}
    </div>
  );
}

function BundleRow({ it, attrs, value, onChange, money }: { it: BundleItem; attrs: AttrMap; value?: string; onChange: (v: string) => void; money: (n: number) => string }) {
  const fixed = it.variant_id ? it.product.variants.find((v) => v.id === it.variant_id) : null;
  const label = (v: Variant) => Object.entries(v.options).map(([k, x]) => attrs[k]?.[x]?.label ?? x).join(' / ') || 'Standard';
  return (
    <div className="border border-line p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-[18px]">{it.label || it.product.name}{it.quantity > 1 && ` × ${it.quantity}`}</p>
        {it.is_optional && <span className="text-[11px] uppercase tracking-[0.16em] text-muted">Optional</span>}
      </div>
      <p className="text-[12px] text-muted">{it.product.name}</p>
      {fixed ? (
        <p className="mt-2 flex items-center gap-2 text-[13px]"><Check size={14} className="text-accent-strong" /> {label(fixed)} · {money(fixed.price)}</p>
      ) : (
        <label className="mt-3 block">
          <span className="sr-only">Choose {it.label || it.product.name}</span>
          <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">{it.is_optional ? 'Not needed' : 'Choose an option'}</option>
            {it.product.variants.map((v) => {
              const a = avail(v);
              return <option key={v.id} value={v.id} disabled={a < it.quantity}>{label(v)} — {money(v.price)}{a < it.quantity ? ' (sold out)' : ''}</option>;
            })}
          </select>
        </label>
      )}
    </div>
  );
}

function BackInStock({ productId, variantId }: { productId: string; variantId?: string }) {
  const { user, toast } = useStore();
  const [email, setEmail] = useState(user?.email ?? '');
  const [done, setDone] = useState(false);
  if (done) return <p className="flex items-center gap-2 bg-panel p-4 text-[14px]"><BellRing size={16} /> We&apos;ll email you when it&apos;s back.</p>;
  return (
    <form className="grid gap-2" onSubmit={async (e) => {
      e.preventDefault();
      const r = await fetch('/api/back-in-stock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, product_id: productId, variant_id: variantId }) });
      if (r.ok) setDone(true); else toast('Please enter a valid email', 'error');
    }}>
      <p className="text-[14px]">Sold out in this option. Get an email when it returns.</p>
      <div className="flex gap-2">
        <label htmlFor="bis-email" className="sr-only">Email</label>
        <input id="bis-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" className="input flex-1" />
        <button type="submit" className="btn btn-primary">Notify me</button>
      </div>
    </form>
  );
}

function StickyBar({ name, price, disabled, onAdd }: { name: string; price: number; disabled: boolean; onAdd: () => void }) {
  const { money } = useStore();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.getElementById('buy-buttons');
    if (!target || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(target);
    return () => io.disconnect();
  }, []);
  return (
    <div className={cn('fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-500 lg:hidden', show ? 'translate-y-0' : 'translate-y-full')} aria-hidden={!show}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1"><p className="truncate font-display text-[16px]">{name}</p><p className="text-[13px] tabular-nums">{money(price)}</p></div>
        <button type="button" onClick={onAdd} disabled={disabled} tabIndex={show ? 0 : -1} className="btn btn-primary">Add to bag</button>
      </div>
    </div>
  );
}
