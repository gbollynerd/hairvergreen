'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Package, Truck, Home, CreditCard, Sparkles } from 'lucide-react';
import type { Order, OrderItem } from '@/lib/types';
import { formatMoney } from '@/lib/money';
import { formatDate, formatDateTime, countryName, cn, titleCase } from '@/lib/utils';
import { Media } from '@/components/ui/media';
import { useStore } from '@/components/store/store-provider';
import { uploadFile } from '@/lib/upload-client';

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment', paid: 'Paid', payment_failed: 'Payment failed', processing: 'Processing', ready_for_shipment: 'Ready to ship',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', refund_requested: 'Refund requested', refunded: 'Refunded', partially_refunded: 'Partially refunded',
};

const STEPS = [
  { key: 'placed', label: 'Order placed', icon: Package },
  { key: 'paid', label: 'Payment confirmed', icon: CreditCard },
  { key: 'processing', label: 'Processing', icon: Sparkles },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: Home },
];

function stepIndex(o: Order) {
  if (o.status === 'delivered' || o.fulfillment_status === 'delivered') return 4;
  if (o.status === 'shipped' || o.fulfillment_status === 'shipped') return 3;
  if (['processing', 'ready_for_shipment'].includes(o.status)) return 2;
  if (o.paid_at) return 1;
  return 0;
}

export function OrderDetail({ order, items, events, returns, token, signedIn }: {
  order: Order; items: OrderItem[]; events: { id: number; type: string; message: string; created_at: string }[];
  returns: { id: string; rma_number: string; status: string; resolution: string; created_at: string }[]; token?: string; signedIn: boolean;
}) {
  const { addToCart } = useStore();
  const [showReturn, setShowReturn] = useState(false);
  const idx = stepIndex(order);
  const cancelled = ['cancelled', 'payment_failed'].includes(order.status);
  const a = order.shipping_address;
  const canReturn = ['delivered', 'shipped'].includes(order.status) && items.some((i) => i.quantity > i.returned_quantity) && !returns.some((r) => ['requested', 'approved', 'awaiting_item'].includes(r.status));

  const reorder = async () => {
    // Bundles and custom pieces are configured on their product pages, so they are skipped here.
    for (const i of items) if (i.product_id && i.variant_id && !i.customization && !i.bundle_components) {
      await addToCart({ product_id: i.product_id, variant_id: i.variant_id, quantity: i.quantity, name: i.product_name, price: i.unit_price });
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Order {order.order_number}</p>
          <h2 className="mt-2 font-display text-[34px]">{STATUS_LABEL[order.status] ?? titleCase(order.status)}</h2>
          <p className="text-[13px] text-muted">Placed {formatDateTime(order.placed_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/orders/${order.order_number}/invoice${token ? `?t=${token}` : ''}`} className="btn btn-outline btn-sm" target="_blank">Invoice</Link>
          {signedIn && order.paid_at && <button type="button" onClick={reorder} className="btn btn-outline btn-sm">Reorder</button>}
          {canReturn && <button type="button" onClick={() => setShowReturn((v) => !v)} className="btn btn-outline btn-sm">Request a return</button>}
        </div>
      </div>

      {!cancelled ? (
        <ol className="grid grid-cols-5 gap-2" aria-label="Order progress">
          {STEPS.map((s, i) => {
            const done = i <= idx; const Icon = s.icon;
            return (
              <li key={s.key} className="flex flex-col items-center text-center" aria-current={i === idx ? 'step' : undefined}>
                <span className={cn('grid h-10 w-10 place-items-center rounded-full border', done ? 'border-primary bg-primary text-primary-contrast' : 'border-line text-muted')}>{done && i < idx ? <Check size={16} /> : <Icon size={16} strokeWidth={1.4} />}</span>
                <span className={cn('mt-2 text-[10px] uppercase tracking-[0.14em] md:text-[11px]', done ? 'text-ink' : 'text-muted')}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      ) : <p className="bg-panel p-4 text-[14px]">{order.status === 'payment_failed' ? 'Payment for this order was not completed, so you have not been charged.' : 'This order was cancelled.'}</p>}

      {order.requires_review && order.review_status === 'pending' && order.paid_at && (
        <p className="border-l-2 border-accent bg-surface p-4 text-[14px]">Your custom piece is in review. Our team will contact you to confirm the details before production begins.</p>
      )}
      {order.tracking_number && (
        <div className="bg-panel p-5 text-[14px]"><p className="label">Tracking</p><p className="mt-1">{order.carrier} · <strong>{order.tracking_number}</strong></p>{order.tracking_url && <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block underline">Track parcel</a>}</div>
      )}

      {showReturn && <ReturnForm order={order} items={items} token={token} onDone={() => { setShowReturn(false); location.reload(); }} />}

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <ul className="divide-y divide-line border-y border-line">
            {items.map((i) => (
              <li key={i.id} className="flex gap-4 py-5">
                <div className="relative h-24 w-20 shrink-0 bg-panel"><Media src={i.image_url} alt={i.product_name} fill sizes="80px" /></div>
                <div className="flex-1 text-[14px]">
                  <p className="font-display text-[18px]">{i.product_name}</p>
                  {i.variant_title && i.variant_title !== 'Default' && <p className="text-[13px] text-muted">{i.variant_title}</p>}
                  <p className="mt-1 text-[13px] text-muted">Qty {i.quantity}{i.returned_quantity > 0 && ` · ${i.returned_quantity} returned`}</p>
                </div>
                <p className="text-[14px] tabular-nums">{formatMoney(i.line_total)}</p>
              </li>
            ))}
          </ul>
          {events.length > 0 && (
            <div className="mt-10"><p className="label mb-4">Updates</p>
              <ol className="space-y-3 border-l border-line pl-5 text-[14px]">{events.map((e) => (
                <li key={e.id} className="relative"><span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-accent-strong" /><p>{e.message}</p><p className="text-[12px] text-muted">{formatDateTime(e.created_at)}</p></li>
              ))}</ol>
            </div>
          )}
          {returns.length > 0 && (
            <div className="mt-10"><p className="label mb-3">Returns</p>
              <ul className="space-y-2 text-[14px]">{returns.map((r) => <li key={r.id} className="flex justify-between bg-panel px-4 py-3"><span>{r.rma_number} · {titleCase(r.resolution)}</span><span>{titleCase(r.status)} · {formatDate(r.created_at)}</span></li>)}</ul>
            </div>
          )}
        </div>
        <aside className="space-y-6 text-[14px]">
          <dl className="space-y-2 bg-surface p-5 ring-1 ring-line">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatMoney(order.subtotal)}</dd></div>
            {order.discount_breakdown?.filter((d) => d.amount > 0).map((d, i) => <div key={i} className="flex justify-between text-sale"><dt>{d.label}</dt><dd>−{formatMoney(d.amount)}</dd></div>)}
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{order.shipping_total ? formatMoney(order.shipping_total) : 'Free'}</dd></div>
            {order.tax_total > 0 && <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd>{formatMoney(order.tax_total)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-2 text-[16px]"><dt>Total</dt><dd className="font-medium">{formatMoney(order.total)}</dd></div>
            {order.refunded_total > 0 && <div className="flex justify-between text-sale"><dt>Refunded</dt><dd>−{formatMoney(order.refunded_total)}</dd></div>}
          </dl>
          {a && <div><p className="label mb-2">Delivering to</p><p>{a.first_name} {a.last_name}<br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}{a.state && `, ${a.state}`} {a.postal_code}<br />{countryName(a.country)}</p></div>}
          {order.shipping_method && <div><p className="label mb-2">Delivery method</p><p>{order.shipping_method.name}</p></div>}
          <p className="text-muted">Questions? <Link href={`/contact`} className="underline">Contact us</Link> with your order number.</p>
        </aside>
      </div>
    </div>
  );
}

function ReturnForm({ order, items, token, onDone }: { order: Order; items: OrderItem[]; token?: string; onDone: () => void }) {
  const { toast } = useStore();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  return (
    <form className="grid gap-5 border border-line bg-surface p-6" onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const chosen = Object.entries(qty).filter(([, q]) => q > 0).map(([order_item_id, quantity]) => ({ order_item_id, quantity, reason: String(fd.get('reason')) }));
      if (!chosen.length) { toast('Choose at least one item', 'error'); return; }
      setBusy(true);
      try {
        const media = [];
        for (const f of files.slice(0, 4)) { try { const u = await uploadFile('return', f); media.push({ path: u.path, bucket: u.bucket }); } catch { /* optional */ } }
        const r = await fetch('/api/returns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
          order_number: order.order_number, token, items: chosen, reason: fd.get('reason'), resolution: fd.get('resolution'), note: fd.get('note') || undefined, media }) });
        const d = await r.json();
        if (!r.ok) toast(d.error || 'Could not submit your request', 'error');
        else { toast(`Return ${d.rma_number} requested — we’ll be in touch.`); onDone(); }
      } finally { setBusy(false); }
    }}>
      <p className="font-display text-[24px]">Request a return or exchange</p>
      <p className="text-[13px] text-muted">Please read our <Link href="/policies/refund-policy" className="underline">Refund Policy</Link>. Worn, cut, coloured or custom items can’t be returned.</p>
      <ul className="divide-y divide-line">{items.filter((i) => i.quantity > i.returned_quantity).map((i) => (
        <li key={i.id} className="flex items-center justify-between gap-4 py-3 text-[14px]">
          <span>{i.product_name} <span className="text-muted">{i.variant_title !== 'Default' && i.variant_title}</span></span>
          <label className="flex items-center gap-2"><span className="sr-only">Quantity to return</span>
            <select className="input !min-h-[38px] !w-20 !py-1" value={qty[i.id] ?? 0} onChange={(e) => setQty((q) => ({ ...q, [i.id]: Number(e.target.value) }))}>
              {Array.from({ length: i.quantity - i.returned_quantity + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
            </select></label>
        </li>
      ))}</ul>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field"><span className="label">Reason</span><select name="reason" className="input" required>
          {['Not as described', 'Wrong item received', 'Damaged or defective', 'Changed my mind', 'Wrong length or texture ordered', 'Other'].map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className="field"><span className="label">I’d like</span><select name="resolution" className="input"><option value="refund">A refund</option><option value="exchange">An exchange</option><option value="store_credit">Store credit</option></select></label>
      </div>
      <label className="field"><span className="label">Details (optional)</span><textarea name="note" className="input !min-h-[80px]" maxLength={1500} /></label>
      <label className="field"><span className="label">Photos (optional)</span><input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="text-[13px]" /></label>
      <button type="submit" disabled={busy} className="btn btn-primary justify-self-start">{busy ? 'Submitting…' : 'Submit request'}</button>
    </form>
  );
}
