import { formatMoney } from '@/lib/money';
import { formatDate, countryName } from '@/lib/utils';
import type { Order, OrderItem } from '@/lib/types';
import { PrintButton } from './print-button';

export function Invoice({ order, items, store, packing }: { order: Order; items: OrderItem[]; store: Record<string, string>; packing?: boolean }) {
  const a = order.shipping_address; const b = order.billing_address ?? a;
  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-[13px] text-ink print:p-0">
      <div className="mb-6 flex justify-end print:hidden"><PrintButton /></div>
      <header className="flex items-start justify-between border-b border-line pb-6">
        <div><p className="wordmark text-[20px]">Hairver Green</p><p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted">Luxury Hair House · Lagos</p>
          <p className="mt-3 text-muted">{store.address}<br />{store.email}{store.phone && <><br />{store.phone}</>}</p></div>
        <div className="text-right"><p className="font-display text-[28px]">{packing ? 'Packing slip' : 'Invoice'}</p><p className="mt-1">Order {order.order_number}</p><p className="text-muted">{formatDate(order.paid_at ?? order.placed_at)}</p>
          {!packing && <p className="mt-1 text-muted">Payment: {order.payment_status}{order.payment_channel ? ` · ${order.payment_channel}` : ''}</p>}</div>
      </header>
      <div className="grid grid-cols-2 gap-8 py-6">
        {a && <div><p className="label mb-2">Ship to</p><p>{a.first_name} {a.last_name}<br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.city}{a.state && `, ${a.state}`} {a.postal_code}<br />{countryName(a.country)}{a.phone && <><br />{a.phone}</>}</p></div>}
        {!packing && b && <div><p className="label mb-2">Bill to</p><p>{b.first_name} {b.last_name}<br />{b.line1}<br />{b.city}{b.state && `, ${b.state}`}<br />{countryName(b.country)}<br />{order.email}</p></div>}
        {packing && <div><p className="label mb-2">Delivery</p><p>{order.shipping_method?.name}{order.carrier && <><br />{order.carrier}</>}{order.tracking_number && <><br />Tracking: {order.tracking_number}</>}</p>{order.customer_note && <p className="mt-3"><span className="label">Note</span><br />{order.customer_note}</p>}</div>}
      </div>
      <table className="w-full">
        <thead><tr className="border-b border-ink/40 text-left"><th className="py-2">Item</th><th className="py-2">SKU</th><th className="py-2 text-right">Qty</th>{!packing && <><th className="py-2 text-right">Price</th><th className="py-2 text-right">Total</th></>}{packing && <th className="py-2 text-right">✓</th>}</tr></thead>
        <tbody>{items.map((i) => (
          <tr key={i.id} className="border-b border-line align-top">
            <td className="py-3"><p className="font-medium">{i.product_name}</p>{i.variant_title && i.variant_title !== 'Default' && <p className="text-muted">{i.variant_title}</p>}
              {i.bundle_components?.map((c, n) => <p key={n} className="text-muted">— {c.quantity}× {c.name} {c.variant_title !== 'Default' && `(${c.variant_title})`}</p>)}</td>
            <td className="py-3 text-muted">{i.sku}</td><td className="py-3 text-right">{i.quantity}</td>
            {!packing && <><td className="py-3 text-right">{formatMoney(i.unit_price)}</td><td className="py-3 text-right">{formatMoney(i.line_total)}</td></>}
            {packing && <td className="py-3 text-right">☐</td>}
          </tr>))}</tbody>
      </table>
      {!packing && (
        <dl className="ml-auto mt-6 w-64 space-y-1">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(order.subtotal)}</dd></div>
          {order.discount_total > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatMoney(order.discount_total)}</dd></div>}
          <div className="flex justify-between"><dt>Shipping</dt><dd>{formatMoney(order.shipping_total)}</dd></div>
          {order.tax_total > 0 && <div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(order.tax_total)}</dd></div>}
          <div className="flex justify-between border-t border-ink/40 pt-2 font-medium"><dt>Total (NGN)</dt><dd>{formatMoney(order.total)}</dd></div>
          {order.refunded_total > 0 && <div className="flex justify-between text-sale"><dt>Refunded</dt><dd>−{formatMoney(order.refunded_total)}</dd></div>}
        </dl>
      )}
      <p className="mt-10 text-center text-[11px] text-muted">Thank you for choosing Hairver Green.</p>
    </div>
  );
}
