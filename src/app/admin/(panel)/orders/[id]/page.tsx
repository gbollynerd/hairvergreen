import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card, Badge, ORDER_TONE, DefinitionList } from '@/components/admin/ui';
import { ActionButton } from '@/components/admin/client';
import { formatMoney } from '@/lib/money';
import { formatDateTime, titleCase, countryName } from '@/lib/utils';
import { updateOrderStatus, reviewCustomization, resendConfirmation, verifyPaymentAction } from '../actions';
import { TrackingForm, NoteForm, CancelForm, RefundForm, OfflinePaymentForm } from './forms';
import type { Order, OrderItem } from '@/lib/types';

export default async function OrderDetailAdmin({ params }: PageProps<'/admin/orders/[id]'>) {
  const staff = await requireStaffPage('orders.view');
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: order } = await db.from('orders').select('*').eq('id', id).maybeSingle();
  if (!order) notFound();
  const o = order as Order & { access_token: string; utm: Record<string, string> | null };
  const [{ data: items }, { data: events }, { data: payments }, { data: refunds }, { data: returns }, { data: customer }] = await Promise.all([
    db.from('order_items').select('*').eq('order_id', id).order('created_at'),
    db.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    db.from('payments').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    db.from('refunds').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    db.from('return_requests').select('id, rma_number, status, resolution, created_at').eq('order_id', id),
    o.customer_id ? db.from('customer_stats').select('*').eq('customer_id', o.customer_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const can = (p: string) => staff.permissions.has(p);
  const paid = !!o.paid_at;
  const a = o.shipping_address; const b = o.billing_address;
  const phone = (o.phone || a?.phone || '').replace(/\D/g, '');
  const next = { paid: 'processing', processing: 'ready_for_shipment', ready_for_shipment: 'shipped', shipped: 'delivered' }[o.status as string];

  return (
    <>
      <PageHeader back={{ href: '/admin/orders', label: 'Orders' }} title={`Order ${o.order_number}`}
        description={<span className="flex flex-wrap items-center gap-2">Placed {formatDateTime(o.placed_at)} <Badge tone={ORDER_TONE[o.status]}>{titleCase(o.status)}</Badge><Badge tone={o.payment_status === 'paid' ? 'green' : 'gold'}>Payment: {titleCase(o.payment_status)}</Badge>{o.requires_review && <Badge tone="purple">Custom review: {o.review_status}</Badge>}</span>}
        actions={<>
          <a href={`/orders/${o.order_number}/invoice?t=${o.access_token}`} target="_blank" className="btn btn-outline btn-sm">Invoice</a>
          <a href={`/orders/${o.order_number}/invoice?t=${o.access_token}&packing=1`} target="_blank" className="btn btn-outline btn-sm">Packing slip</a>
          {can('orders.edit') && next && paid && <ActionButton variant="primary" action={updateOrderStatus.bind(null, id, next, true)}>Mark {titleCase(next)}</ActionButton>}
        </>} />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {o.requires_review && o.review_status === 'pending' && paid && can('orders.edit') && (
            <Card title="Customization review required">
              <p className="text-[14px]">This order contains a made-to-order piece. Confirm the configuration with the customer, then approve to begin production.</p>
              <div className="mt-4 flex gap-2"><ActionButton variant="primary" action={reviewCustomization.bind(null, id, 'approved')}>Approve & start production</ActionButton><ActionButton action={reviewCustomization.bind(null, id, 'changes_requested')}>Needs changes</ActionButton></div>
            </Card>
          )}
          <Card title={`Items (${(items ?? []).length})`} padded={false}>
            <ul className="divide-y divide-line">
              {((items ?? []) as OrderItem[]).map((i) => (
                <li key={i.id} className="flex gap-4 p-4 text-[13px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.image_url ? <img src={i.image_url} alt="" className="h-20 w-16 object-cover" /> : <div className="h-20 w-16 bg-panel" />}
                  <div className="flex-1">
                    <p className="font-medium">{i.product_id ? <Link href={`/admin/products/${i.product_id}`} className="underline">{i.product_name}</Link> : i.product_name}</p>
                    {i.variant_title && i.variant_title !== 'Default' && <p className="text-muted">{i.variant_title}</p>}
                    <p className="text-muted">SKU {i.sku ?? '—'} · {formatMoney(i.unit_price)} × {i.quantity}{i.returned_quantity > 0 && ` · ${i.returned_quantity} returned`}</p>
                    {i.bundle_components && <ul className="mt-1 text-muted">{i.bundle_components.map((c, n) => <li key={n}>— {c.quantity}× {c.name} ({c.variant_title})</li>)}</ul>}
                    {i.customization && <pre className="mt-2 whitespace-pre-wrap bg-panel p-2 text-[11px]">{Object.entries(i.customization).map(([k, v]) => `${titleCase(k)}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join('\n')}</pre>}
                  </div>
                  <div className="text-right tabular-nums"><p>{formatMoney(i.line_total)}</p>{i.line_discount > 0 && <p className="text-sale">−{formatMoney(i.line_discount)}</p>}{can('finance.view') && <p className="text-[11px] text-muted">Cost {formatMoney(i.unit_cost * i.quantity)}</p>}</div>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-line p-4 text-[13px]">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(o.subtotal)}</dd></div>
              {o.discount_breakdown?.map((d, n) => <div key={n} className="flex justify-between text-sale"><dt>{d.label}</dt><dd>{d.amount ? `−${formatMoney(d.amount)}` : 'Free shipping'}</dd></div>)}
              <div className="flex justify-between"><dt>Shipping · {o.shipping_method?.name}</dt><dd>{formatMoney(o.shipping_total)}</dd></div>
              {o.tax_total > 0 && <div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(o.tax_total)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 text-[15px] font-medium"><dt>Total</dt><dd>{formatMoney(o.total)}</dd></div>
              {o.refunded_total > 0 && <div className="flex justify-between text-sale"><dt>Refunded</dt><dd>−{formatMoney(o.refunded_total)}</dd></div>}
              {can('finance.view') && paid && <div className="flex justify-between text-muted"><dt>Est. profit (after COGS & fees)</dt><dd>{formatMoney(o.total - o.tax_total - o.refunded_total - o.cost_total - o.payment_fees)}</dd></div>}
            </dl>
          </Card>

          {can('orders.edit') && <Card title="Shipping & tracking"><TrackingForm orderId={id} carrier={o.carrier} number={o.tracking_number} url={o.tracking_url} canShip={paid && !['shipped', 'delivered', 'cancelled'].includes(o.status)} /></Card>}

          <Card title="Timeline">
            {can('orders.edit') && <NoteForm orderId={id} />}
            <ol className="mt-5 space-y-4 border-l border-line pl-5 text-[13px]">
              {(events ?? []).map((e: any) => (
                <li key={e.id} className="relative"><span className={`absolute -left-[25px] top-1.5 h-2 w-2 rounded-full ${e.is_internal ? 'bg-muted' : 'bg-accent-strong'}`} />
                  <p>{e.message}</p><p className="text-[11px] text-muted">{formatDateTime(e.created_at)}{e.actor_name && ` · ${e.actor_name}`}{e.is_internal ? ' · internal' : ' · visible to customer'}</p></li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <DefinitionList items={[['Name', o.customer_name], ['Email', <a key="e" href={`mailto:${o.email}`} className="underline">{o.email}</a>], ['Phone', o.phone],
              ['Orders', customer ? `${(customer as any).orders_count} · ${formatMoney((customer as any).total_spent)} lifetime` : null],
              ['Account', o.user_id ? 'Registered' : 'Guest']]} />
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`mailto:${o.email}?subject=${encodeURIComponent(`Your Hairver Green order ${o.order_number}`)}`} className="btn btn-outline btn-sm">Email</a>
              {phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">WhatsApp</a>}
              {o.customer_id && can('customers.view') && <Link href={`/admin/customers/${o.customer_id}`} className="btn btn-outline btn-sm">Profile</Link>}
              {can('orders.edit') && paid && <ActionButton action={resendConfirmation.bind(null, id)}>Resend confirmation</ActionButton>}
            </div>
          </Card>
          <Card title="Addresses">
            {a && <div className="text-[13px]"><p className="label mb-1">Shipping</p><p>{a.first_name} {a.last_name}<br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}{a.state && `, ${a.state}`} {a.postal_code}<br />{countryName(a.country)}{a.phone && <><br />{a.phone}</>}</p></div>}
            {b && JSON.stringify(b) !== JSON.stringify(a) && <div className="mt-4 text-[13px]"><p className="label mb-1">Billing</p><p>{b.first_name} {b.last_name}<br />{b.line1}<br />{b.city}, {countryName(b.country)}</p></div>}
            {o.customer_note && <div className="mt-4 bg-panel p-3 text-[13px]"><p className="label">Customer note</p><p>{o.customer_note}</p></div>}
          </Card>
          <Card title="Payment">
            <ul className="space-y-2 text-[13px]">{(payments ?? []).map((p: any) => (
              <li key={p.id} className="flex justify-between gap-2"><span><span className="block font-mono text-[11px]">{p.reference}</span><span className="text-muted">{p.provider} · {p.channel ?? '—'}{p.fees ? ` · fee ${formatMoney(p.fees)}` : ''}</span></span><Badge tone={p.status === 'success' ? 'green' : p.status === 'failed' || p.status === 'mismatch' ? 'red' : 'gold'}>{p.status}</Badge></li>
            ))}</ul>
            {!paid && can('orders.edit') && <div className="mt-4 flex flex-wrap gap-2"><ActionButton action={verifyPaymentAction.bind(null, id)}>Check with Paystack</ActionButton></div>}
            {!paid && can('orders.refund') && o.status !== 'cancelled' && <OfflinePaymentForm orderId={id} />}
            {(refunds ?? []).length > 0 && <div className="mt-4 border-t border-line pt-3"><p className="label mb-2">Refunds</p><ul className="space-y-1 text-[13px]">{(refunds ?? []).map((r: any) => <li key={r.id} className="flex justify-between"><span>{formatMoney(r.amount)} · {r.method.replace('_', ' ')}</span><Badge tone={r.status === 'processed' ? 'green' : r.status === 'failed' ? 'red' : 'gold'}>{r.status}</Badge></li>)}</ul></div>}
          </Card>
          {(returns ?? []).length > 0 && <Card title="Returns"><ul className="space-y-2 text-[13px]">{(returns ?? []).map((r: any) => <li key={r.id}><Link href={`/admin/returns/${r.id}`} className="underline">{r.rma_number}</Link> · {titleCase(r.resolution)} · <Badge>{titleCase(r.status)}</Badge></li>)}</ul></Card>}
          {can('orders.refund') && paid && o.refunded_total < o.total && <Card title="Refund"><RefundForm orderId={id} max={o.total - o.refunded_total} items={((items ?? []) as OrderItem[]).map((i) => ({ id: i.id, name: `${i.product_name}${i.variant_title && i.variant_title !== 'Default' ? ' — ' + i.variant_title : ''}`, qty: i.quantity - i.returned_quantity }))} /></Card>}
          {can('orders.cancel') && !['cancelled', 'refunded', 'delivered'].includes(o.status) && <Card title="Cancel order"><CancelForm orderId={id} paid={paid} /></Card>}
          {o.utm && Object.keys(o.utm).length > 0 && <Card title="Attribution"><DefinitionList items={Object.entries(o.utm).map(([k, v]) => [k, v])} /></Card>}
        </div>
      </div>
    </>
  );
}
