'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, ChevronDown, Tag, X, Check } from 'lucide-react';
import type { Address } from '@/lib/types';
import type { CartView } from '@/lib/commerce/cart';
import type { Quote } from '@/lib/commerce/pricing';
import { useStore } from '@/components/store/store-provider';
import { Media } from '@/components/ui/media';
import { Wordmark } from '@/components/ui/logo';
import { COUNTRIES, NIGERIAN_STATES, cn } from '@/lib/utils';
import { track } from '@/lib/analytics-client';

type Addr = { first_name: string; last_name: string; phone: string; line1: string; line2: string; city: string; state: string; postal_code: string; country: string };
const blank = (country = 'NG'): Addr => ({ first_name: '', last_name: '', phone: '', line1: '', line2: '', city: '', state: '', postal_code: '', country });

export function CheckoutClient({ initialCart, user, addresses, profile, requirePhone, termsPage, allowNote }: {
  initialCart: CartView; user: { id: string; email: string; name: string | null } | null; addresses: Address[];
  profile: { full_name: string | null; phone: string | null } | null; requirePhone: boolean; termsPage: string; allowNote: boolean;
}) {
  const { money, cartAction, currency, toast } = useStore();
  const def = addresses.find((a) => a.is_default_shipping) ?? addresses[0];
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? def?.phone ?? '');
  const [marketing, setMarketing] = useState(false);
  const [savedId, setSavedId] = useState<string | 'new'>(def?.id ?? 'new');
  const nameParts = (profile?.full_name || user?.name || '').split(' ');
  const [ship, setShip] = useState<Addr>(def ? { ...blank(), ...def, phone: def.phone ?? '', line2: def.line2 ?? '', state: def.state ?? '', postal_code: def.postal_code ?? '' } as Addr
    : { ...blank(initialCart.country || 'NG'), first_name: nameParts[0] ?? '', last_name: nameParts.slice(1).join(' ') });
  const [billingSame, setBillingSame] = useState(true);
  const [bill, setBill] = useState<Addr>(blank());
  const [saveAddress, setSaveAddress] = useState(!!user && !addresses.length);
  const [note, setNote] = useState('');
  const [methodId, setMethodId] = useState<string | null>(null);
  const [quote, setQuote] = useState<(Quote & { codes?: string[] }) | null>(initialCart);
  const [quoting, setQuoting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(user ? 2 : 1);

  useEffect(() => { track('begin_checkout', { value: initialCart.total }); }, [initialCart.total]);

  const refreshQuote = useCallback(async (opts?: { method?: string | null }) => {
    setQuoting(true);
    try {
      const r = await fetch('/api/checkout/quote', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ country: ship.country, state: ship.state || null, email: email || null, shipping_method_id: opts?.method ?? methodId }) });
      const q = await r.json();
      if (r.ok) {
        setQuote(q);
        if (!q.shipping_options.find((o: { id: string }) => o.id === (opts?.method ?? methodId))) setMethodId(q.selected_shipping?.id ?? null);
      }
    } finally { setQuoting(false); }
  }, [ship.country, ship.state, email, methodId]);

  useEffect(() => { const t = setTimeout(() => refreshQuote(), 250); return () => clearTimeout(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ship.country, ship.state]);

  const chooseSaved = (id: string) => {
    setSavedId(id);
    const a = addresses.find((x) => x.id === id);
    if (a) setShip({ ...blank(), ...a, phone: a.phone ?? '', line2: a.line2 ?? '', state: a.state ?? '', postal_code: a.postal_code ?? '' } as Addr);
    else setShip(blank(ship.country));
  };

  const contactValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && (!requirePhone || phone.trim().length >= 7);
  const addrValid = ship.first_name && ship.last_name && ship.line1.length >= 3 && ship.city && ship.country && (ship.country !== 'NG' || ship.state);
  const billValid = billingSame || (bill.first_name && bill.last_name && bill.line1 && bill.city && bill.country);

  const pay = async () => {
    if (!methodId) { setError('Please choose a delivery option.'); return; }
    setPaying(true); setError(null);
    try {
      const utm = Object.fromEntries(new URLSearchParams(sessionStorage.getItem('hg_utm') || '').entries());
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        email, phone, shipping: { ...ship, phone: ship.phone || phone }, billing_same: billingSame, billing: billingSame ? undefined : bill,
        shipping_method_id: methodId, note, marketing, save_address: saveAddress && savedId === 'new', display_currency: currency.code, utm }) });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || 'Something went wrong'); if (d.quote) setQuote(d.quote);
        setPaying(false); return;
      }
      window.location.href = d.redirect;
    } catch {
      setError('Connection problem — please try again.'); setPaying(false);
    }
  };

  const q = quote ?? initialCart;
  const lines = q.lines;
  const itemCount = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);

  const Summary = (
    <div className="space-y-5">
      <ul className="space-y-4">
        {lines.map((l) => (
          <li key={l.id} className="flex gap-3">
            <div className="relative h-20 w-16 shrink-0 bg-panel"><Media src={l.image} alt={l.name} fill sizes="64px" /><span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-contrast">{l.quantity}</span></div>
            <div className="min-w-0 flex-1 text-[13px]"><p className="font-display text-[16px] leading-snug">{l.name}</p>{l.variant_title && l.variant_title !== 'Default' && <p className="line-clamp-2 text-muted">{l.variant_title}</p>}{l.error && <p className="text-sale">{l.error}</p>}</div>
            <p className="text-[13px] tabular-nums">{money(l.line_subtotal)}</p>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!code) return; const r = await cartAction({ action: 'apply_code', code }); if (r && !r.error) { setCode(''); refreshQuote(); } }}>
        <label htmlFor="co-code" className="sr-only">Promo code</label>
        <input id="co-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="input !min-h-[44px] flex-1 uppercase" placeholder="Have a promo code?" />
        <button type="submit" className="btn btn-outline btn-sm">Apply</button>
      </form>
      {(q.codes ?? initialCart.codes).length > 0 && (
        <div className="flex flex-wrap gap-2">{(q.codes ?? initialCart.codes).map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5 bg-panel px-2 py-1 text-[12px]"><Tag size={12} />{c}<button type="button" aria-label={`Remove ${c}`} onClick={async () => { await cartAction({ action: 'remove_code', code: c }); refreshQuote(); }}><X size={12} /></button></span>
        ))}</div>
      )}
      <dl className="space-y-2 border-t border-line pt-4 text-[14px]">
        <div className="flex justify-between"><dt className="text-muted">Subtotal · {itemCount} item{itemCount === 1 ? '' : 's'}</dt><dd className="tabular-nums">{money(q.subtotal)}</dd></div>
        {q.discounts.filter((d) => d.amount > 0).map((d) => <div key={d.id} className="flex justify-between text-sale"><dt>{d.label}</dt><dd className="tabular-nums">−{money(d.amount)}</dd></div>)}
        <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="tabular-nums">{q.selected_shipping ? (q.shipping_total ? money(q.shipping_total) : 'Free') : '—'}</dd></div>
        {q.tax_total > 0 && <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd className="tabular-nums">{money(q.tax_total)}</dd></div>}
        <div className="flex justify-between border-t border-line pt-3 text-[17px]"><dt>Total</dt><dd className="font-medium tabular-nums">{money(q.total)}</dd></div>
        {currency.code !== 'NGN' && <p className="text-[12px] text-muted">Shown in {currency.code} for reference. You’ll be charged ₦{(q.total / 100).toLocaleString('en-NG')} in Naira.</p>}
      </dl>
      {q.requires_review && <p className="bg-panel p-3 text-[12px]">Your bag includes a made-to-order piece. After payment, our team confirms your configuration with you before production begins.</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg">
      <div className="container-x flex h-16 items-center justify-between gap-4 border-b border-line">
        <Link href="/" className="text-primary"><Wordmark /></Link>
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted sm:text-[12px]"><Lock size={14} /> <span className="max-sm:sr-only">Secure checkout</span></p>
      </div>
      <div className="container-x grid grid-cols-[minmax(0,1fr)] gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16 lg:py-12">
        {/* Mobile summary toggle */}
        <div className="lg:hidden">
          <button type="button" onClick={() => setSummaryOpen((v) => !v)} aria-expanded={summaryOpen} className="flex w-full items-center justify-between border border-line bg-surface px-4 py-3 text-[14px]">
            <span className="flex min-w-0 items-center gap-2">{summaryOpen ? 'Hide' : 'Show'} order summary <ChevronDown size={14} className={cn('transition', summaryOpen && 'rotate-180')} /></span>
            <span className="font-medium tabular-nums">{money(q.total)}</span>
          </button>
          {summaryOpen && <div className="border-x border-b border-line bg-surface p-4">{Summary}</div>}
        </div>

        <div className="space-y-8">
          <ol className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.16em] sm:gap-6 sm:text-[11px] sm:tracking-[0.2em]" aria-label="Checkout steps">
            {['Contact', 'Delivery', 'Payment'].map((s, i) => (
              <li key={s} className={cn('flex items-center gap-2', step === i + 1 ? 'text-ink' : 'text-muted')} aria-current={step === i + 1 ? 'step' : undefined}>
                <span className={cn('grid h-6 w-6 place-items-center rounded-full border text-[10px]', step > i + 1 ? 'border-primary bg-primary text-primary-contrast' : step === i + 1 ? 'border-ink' : 'border-line')}>{step > i + 1 ? <Check size={12} /> : i + 1}</span>{s}
              </li>
            ))}
          </ol>

          {/* Step 1 */}
          <section className="border border-line bg-surface p-5 md:p-7" aria-labelledby="s1">
            <div className="flex items-center justify-between"><h2 id="s1" className="font-display text-[26px]">Contact</h2>
              {!user && <Link href="/login?next=/checkout" className="text-[13px] underline">Sign in</Link>}{step > 1 && <button type="button" className="text-[13px] underline" onClick={() => setStep(1)}>Edit</button>}</div>
            {step === 1 ? (
              <div className="mt-5 grid gap-4">
                <label className="field"><span className="label">Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" autoComplete="email" required /></label>
                <label className="field"><span className="label">Phone {requirePhone ? '' : '(optional)'}</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" autoComplete="tel" placeholder="+234…" /></label>
                <label className="flex items-center gap-3 text-[14px] text-muted"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="h-4 w-4 accent-[var(--hg-primary)]" /> Email me new drops and offers</label>
                <button type="button" disabled={!contactValid} onClick={() => { setStep(2); cartAction({ action: 'set_email', email }).catch(() => {}); refreshQuote(); }} className="btn btn-primary justify-self-start">Continue to delivery</button>
              </div>
            ) : <p className="mt-2 text-[14px] text-muted">{email}{phone && ` · ${phone}`}</p>}
          </section>

          {/* Step 2 */}
          <section className={cn('border border-line bg-surface p-5 md:p-7', step < 2 && 'opacity-60')} aria-labelledby="s2">
            <div className="flex items-center justify-between"><h2 id="s2" className="font-display text-[26px]">Delivery</h2>{step > 2 && <button type="button" className="text-[13px] underline" onClick={() => setStep(2)}>Edit</button>}</div>
            {step === 2 && (
              <div className="mt-5 grid gap-4">
                {addresses.length > 0 && (
                  <label className="field"><span className="label">Saved addresses</span>
                    <select className="input" value={savedId} onChange={(e) => chooseSaved(e.target.value)}>
                      {addresses.map((a) => <option key={a.id} value={a.id}>{a.label ? `${a.label} — ` : ''}{a.line1}, {a.city}</option>)}
                      <option value="new">Use a new address</option>
                    </select></label>
                )}
                <AddressFields a={ship} onChange={(patch) => { setShip((s) => ({ ...s, ...patch })); if (savedId !== 'new') setSavedId('new'); }} />
                {user && savedId === 'new' && <label className="flex items-center gap-3 text-[14px] text-muted"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="h-4 w-4 accent-[var(--hg-primary)]" /> Save this address to my account</label>}

                <fieldset className="mt-2">
                  <legend className="label mb-3">Delivery method {quoting && <span className="normal-case tracking-normal">· updating…</span>}</legend>
                  {q.shipping_options.length === 0 ? <p className="text-[14px] text-sale">We don’t have a delivery option for this address yet. Please contact us and we’ll arrange shipping.</p> : (
                    <div className="grid gap-2">
                      {q.shipping_options.map((o) => (
                        <label key={o.id} className={cn('flex cursor-pointer items-center justify-between gap-4 border px-4 py-3 text-[14px]', methodId === o.id ? 'border-primary' : 'border-line')}>
                          <span className="flex items-center gap-3"><input type="radio" name="ship" checked={methodId === o.id} onChange={() => { setMethodId(o.id); refreshQuote({ method: o.id }); }} className="accent-[var(--hg-primary)]" />
                            <span><span className="block">{o.name}{o.carrier ? ` · ${o.carrier}` : ''}</span>{o.min_days != null && <span className="text-[12px] text-muted">{o.service_level === 'pickup' ? 'Ready in' : 'Arrives in'} {o.min_days === o.max_days ? o.min_days : `${o.min_days}–${o.max_days}`} business day{o.max_days === 1 ? '' : 's'}</span>}</span></span>
                          <span className="tabular-nums">{o.price === 0 ? (o.original_price > 0 ? <><s className="mr-2 text-muted">{money(o.original_price)}</s>Free</> : 'Free') : money(o.price)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
                <button type="button" disabled={!addrValid || !methodId || quoting} onClick={() => setStep(3)} className="btn btn-primary justify-self-start">Continue to payment</button>
              </div>
            )}
            {step > 2 && <p className="mt-2 text-[14px] text-muted">{ship.first_name} {ship.last_name}, {ship.line1}, {ship.city}{ship.state && `, ${ship.state}`}, {ship.country} · {q.selected_shipping?.name}</p>}
          </section>

          {/* Step 3 */}
          <section className={cn('border border-line bg-surface p-5 md:p-7', step < 3 && 'opacity-60')} aria-labelledby="s3">
            <h2 id="s3" className="font-display text-[26px]">Payment</h2>
            {step === 3 && (
              <div className="mt-5 grid gap-5">
                <div className="bg-panel p-4 text-[14px]">
                  <p className="font-medium">Pay securely with Paystack</p>
                  <p className="mt-1 text-muted">Card, bank transfer, USSD, bank account and other channels available on Paystack. You’ll be redirected to complete payment, then returned here.</p>
                </div>
                <label className="flex items-center gap-3 text-[14px]"><input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} className="h-4 w-4 accent-[var(--hg-primary)]" /> Billing address is the same as delivery</label>
                {!billingSame && <AddressFields a={bill} onChange={(p) => setBill((b) => ({ ...b, ...p }))} compact />}
                {allowNote && <label className="field"><span className="label">Order note (optional)</span><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className="input !min-h-[80px]" placeholder="Anything we should know?" /></label>}
                {error && <p className="bg-sale/10 p-3 text-[14px] text-sale" role="alert">{error}</p>}
                <button type="button" onClick={pay} disabled={paying || !billValid || q.has_errors || !contactValid || !addrValid} className="btn btn-primary btn-block !min-h-[56px]">
                  <Lock size={15} /> {paying ? 'Redirecting to Paystack…' : `Pay ${money(q.total)}`}
                </button>
                <p className="text-center text-[12px] text-muted">By placing your order you agree to our <Link href={termsPage} className="underline">Terms</Link> and <Link href="/policies/refund-policy" className="underline">Refund Policy</Link>.</p>
              </div>
            )}
          </section>
          {q.has_errors && <p className="text-[14px] text-sale" role="alert">Some items in your bag need attention. <button type="button" className="underline" onClick={() => toast('Open your bag to update items')}>Review bag</button></p>}
        </div>

        <aside className="hidden lg:block" aria-label="Order summary"><div className="sticky top-8 border border-line bg-surface p-6"><h2 className="mb-5 font-display text-[24px]">Order summary</h2>{Summary}</div></aside>
      </div>
    </div>
  );
}

function AddressFields({ a, onChange, compact }: { a: Addr; onChange: (p: Partial<Addr>) => void; compact?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="field md:col-span-2"><span className="label">Country</span>
        <select className="input" value={a.country} onChange={(e) => onChange({ country: e.target.value, state: '' })} autoComplete="country">
          {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select></label>
      <label className="field"><span className="label">First name</span><input className="input" value={a.first_name} onChange={(e) => onChange({ first_name: e.target.value })} autoComplete="given-name" required /></label>
      <label className="field"><span className="label">Last name</span><input className="input" value={a.last_name} onChange={(e) => onChange({ last_name: e.target.value })} autoComplete="family-name" required /></label>
      <label className="field md:col-span-2"><span className="label">Address</span><input className="input" value={a.line1} onChange={(e) => onChange({ line1: e.target.value })} autoComplete="address-line1" required /></label>
      <label className="field md:col-span-2"><span className="label">Apartment, landmark (optional)</span><input className="input" value={a.line2} onChange={(e) => onChange({ line2: e.target.value })} autoComplete="address-line2" /></label>
      <label className="field"><span className="label">City</span><input className="input" value={a.city} onChange={(e) => onChange({ city: e.target.value })} autoComplete="address-level2" required /></label>
      {a.country === 'NG' ? (
        <label className="field"><span className="label">State</span><select className="input" value={a.state} onChange={(e) => onChange({ state: e.target.value })} required>
          <option value="">Select state</option>{NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s === 'FCT' ? 'FCT (Abuja)' : s}</option>)}</select></label>
      ) : (
        <label className="field"><span className="label">State / Region</span><input className="input" value={a.state} onChange={(e) => onChange({ state: e.target.value })} autoComplete="address-level1" /></label>
      )}
      <label className="field"><span className="label">Postcode {a.country === 'NG' && '(optional)'}</span><input className="input" value={a.postal_code} onChange={(e) => onChange({ postal_code: e.target.value })} autoComplete="postal-code" /></label>
      {!compact && <label className="field"><span className="label">Delivery phone</span><input className="input" value={a.phone} onChange={(e) => onChange({ phone: e.target.value })} autoComplete="tel" /></label>}
    </div>
  );
}
