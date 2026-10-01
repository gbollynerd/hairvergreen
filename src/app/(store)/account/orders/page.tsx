import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { STATUS_LABEL } from '@/components/account/order-detail';

export default async function Orders() {
  const sb = await createSupabaseServer();
  const { data: orders } = await sb.from('orders').select('id, order_number, status, total, placed_at, tracking_number, order_items(count)').order('placed_at', { ascending: false }).limit(100);
  if (!orders?.length) return <div className="bg-panel p-10 text-center"><p className="font-display text-[24px]">No orders yet.</p><Link href="/shop" className="btn btn-primary mt-5">Explore the collection</Link></div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[14px]">
        <thead><tr className="border-b border-ink/40 text-[11px] uppercase tracking-[0.16em] text-muted"><th className="py-3">Order</th><th>Date</th><th>Items</th><th>Status</th><th className="text-right">Total</th></tr></thead>
        <tbody>{orders.map((o: any) => (
          <tr key={o.id} className="border-b border-line">
            <td className="py-4"><Link href={`/account/orders/${o.order_number}`} className="font-medium underline">{o.order_number}</Link></td>
            <td>{formatDate(o.placed_at)}</td><td>{o.order_items?.[0]?.count ?? '—'}</td>
            <td>{STATUS_LABEL[o.status] ?? o.status}{o.tracking_number && <span className="block text-[12px] text-muted">Tracking {o.tracking_number}</span>}</td>
            <td className="text-right tabular-nums">{formatMoney(o.total)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
