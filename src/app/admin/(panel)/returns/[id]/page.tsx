import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card, Badge, DefinitionList } from '@/components/admin/ui';
import { formatDateTime, titleCase } from '@/lib/utils';
import { ReturnActions } from './return-actions';
import { RefundForm } from '../../orders/[id]/forms';

export default async function ReturnDetail({ params }: PageProps<'/admin/returns/[id]'>) {
  const staff = await requireStaffPage('returns.manage');
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: r } = await db.from('return_requests').select('*').eq('id', id).maybeSingle();
  if (!r) notFound();
  const [{ data: order }, { data: items }] = await Promise.all([
    db.from('orders').select('id, order_number, total, refunded_total, customer_name, email, paid_at').eq('id', r.order_id).single(),
    db.from('order_items').select('id, product_name, variant_title, quantity, returned_quantity, unit_price').eq('order_id', r.order_id),
  ]);
  const media = (await Promise.all(((r.media ?? []) as { bucket: string; path: string }[]).map(async (m) => (await db.storage.from(m.bucket).createSignedUrl(m.path, 3600)).data?.signedUrl))).filter(Boolean);
  const lines = (r.items as { order_item_id: string; quantity: number }[]).map((x) => ({ ...x, item: items?.find((i) => i.id === x.order_item_id) }));
  return (
    <>
      <PageHeader back={{ href: '/admin/returns', label: 'Returns' }} title={`Return ${r.rma_number}`} description={<>For order <Link href={`/admin/orders/${order?.id}`} className="underline">{order?.order_number}</Link> · requested {formatDateTime(r.created_at)} · <Badge>{titleCase(r.status)}</Badge></>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Items to return">
            <ul className="divide-y divide-line text-[14px]">{lines.map((l) => <li key={l.order_item_id} className="flex justify-between py-2"><span>{l.item?.product_name} <span className="text-muted">{l.item?.variant_title}</span></span><span>× {l.quantity}</span></li>)}</ul>
          </Card>
          <Card title="Request">
            <DefinitionList items={[['Customer', `${order?.customer_name ?? ''} <${r.email}>`], ['Resolution', titleCase(r.resolution)], ['Reason', r.reason], ['Details', r.customer_note], ['Restocked', r.restocked ? 'Yes' : 'No'], ['Refund', r.refund_amount ? `₦${(r.refund_amount / 100).toLocaleString('en-NG')}` : null]]} />
            {media.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{media.map((u, i) => <a key={i} href={u!} target="_blank" rel="noopener noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u!} alt={`Return photo ${i + 1}`} className="h-28 w-28 object-cover" /></a>)}</div>}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Update status"><ReturnActions id={r.id} status={r.status} note={r.admin_note} restocked={r.restocked} /></Card>
          {staff.permissions.has('orders.refund') && order?.paid_at && order.refunded_total < order.total && r.resolution === 'refund' && (
            <Card title="Refund this return">
              <RefundForm orderId={order.id} returnId={r.id} max={Math.min(order.total - order.refunded_total, lines.reduce((s, l) => s + (l.item?.unit_price ?? 0) * l.quantity, 0))}
                items={r.restocked ? [] : lines.map((l) => ({ id: l.order_item_id, name: l.item?.product_name ?? '', qty: l.quantity }))} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
