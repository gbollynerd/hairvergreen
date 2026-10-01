import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Table, Td, Badge, FilterBar, FilterSelect } from '@/components/admin/ui';
import { formatDateTime, titleCase } from '@/lib/utils';
import { formatMoney } from '@/lib/money';

export default async function Returns({ searchParams }: PageProps<'/admin/returns'>) {
  await requireStaffPage('returns.manage');
  const sp = await searchParams;
  const db = supabaseAdmin();
  let q = db.from('return_requests').select('*, orders(order_number, customer_name, total)').order('created_at', { ascending: false }).limit(200);
  if (typeof sp.status === 'string' && sp.status) q = q.eq('status', sp.status);
  const [{ data }, { data: refunds }] = await Promise.all([q, db.from('refunds').select('id, amount, status, method, created_at, orders(id, order_number)').order('created_at', { ascending: false }).limit(30)]);
  return (
    <>
      <PageHeader title="Returns & refunds" description="Review return requests, restock returned items and issue refunds." />
      <FilterBar><FilterSelect name="status" label="Status" value={sp.status as string} options={['requested', 'approved', 'awaiting_item', 'received', 'refunded', 'exchanged', 'rejected', 'closed'].map((s) => [s, titleCase(s)])} /><button className="btn btn-primary btn-sm">Filter</button></FilterBar>
      <Table head={['RMA', 'Order', 'Customer', 'Resolution', 'Reason', 'Status', 'Requested']} empty="No return requests.">
        {(data ?? []).map((r: any) => (
          <tr key={r.id}><Td><Link href={`/admin/returns/${r.id}`} className="font-medium underline">{r.rma_number}</Link></Td><Td>{r.orders?.order_number}</Td><Td>{r.orders?.customer_name ?? r.email}</Td>
            <Td>{titleCase(r.resolution)}</Td><Td className="max-w-[220px] truncate">{r.reason}</Td><Td><Badge tone={r.status === 'requested' ? 'gold' : r.status === 'rejected' ? 'red' : r.status === 'refunded' || r.status === 'closed' ? 'gray' : 'blue'}>{titleCase(r.status)}</Badge></Td><Td>{formatDateTime(r.created_at)}</Td></tr>
        ))}
      </Table>
      <h2 className="mb-3 mt-10 font-display text-[24px]">Recent refunds</h2>
      <Table head={['Order', 'Amount', 'Method', 'Status', 'Date']} empty="No refunds yet.">
        {(refunds ?? []).map((r: any) => <tr key={r.id}><Td><Link href={`/admin/orders/${r.orders?.id}`} className="underline">{r.orders?.order_number}</Link></Td><Td>{formatMoney(r.amount)}</Td><Td>{titleCase(r.method)}</Td><Td><Badge tone={r.status === 'processed' ? 'green' : r.status === 'failed' ? 'red' : 'gold'}>{r.status}</Badge></Td><Td>{formatDateTime(r.created_at)}</Td></tr>)}
      </Table>
    </>
  );
}
