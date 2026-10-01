import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Table, Td, Badge, ORDER_TONE, Pagination, FilterBar, FilterSelect, FilterInput } from '@/components/admin/ui';
import { formatMoney } from '@/lib/money';
import { formatDateTime, titleCase, countryName } from '@/lib/utils';

const PER = 30;
const STATUSES = ['pending_payment', 'paid', 'processing', 'ready_for_shipment', 'shipped', 'delivered', 'cancelled', 'payment_failed', 'refunded', 'partially_refunded'];

export default async function Orders({ searchParams }: PageProps<'/admin/orders'>) {
  const staff = await requireStaffPage('orders.view');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = typeof sp.q === 'string' ? sp.q.trim().replace(/[%,()]/g, '') : '';
  let query = supabaseAdmin().from('orders').select('id, order_number, customer_name, email, total, status, payment_status, fulfillment_status, placed_at, shipping_country, requires_review, review_status, payment_channel, order_items(count)', { count: 'exact' })
    .order('placed_at', { ascending: false }).range((page - 1) * PER, page * PER - 1);
  if (q) query = query.or(`order_number.ilike.%${q}%,email.ilike.%${q}%,customer_name.ilike.%${q}%,phone.ilike.%${q}%`);
  if (typeof sp.status === 'string' && sp.status) query = query.eq('status', sp.status);
  if (typeof sp.payment === 'string' && sp.payment) query = query.eq('payment_status', sp.payment);
  if (sp.review === 'pending') query = query.eq('requires_review', true).eq('review_status', 'pending');
  if (typeof sp.from === 'string' && sp.from) query = query.gte('placed_at', sp.from);
  if (typeof sp.to === 'string' && sp.to) query = query.lte('placed_at', sp.to + 'T23:59:59');
  const { data, count } = await query;
  const params = new URLSearchParams(Object.entries(sp).filter(([k, v]) => typeof v === 'string' && k !== 'page') as [string, string][]);
  return (
    <>
      <PageHeader title="Orders" description="Search, filter and fulfil orders." actions={staff.permissions.has('orders.export') && <a href={`/api/admin/export/orders?${params.toString()}`} className="btn btn-outline btn-sm">Export CSV</a>} />
      <FilterBar>
        <FilterInput name="q" label="Search" value={q} placeholder="Order #, email, name, phone" />
        <FilterSelect name="status" label="Status" value={sp.status as string} options={STATUSES.map((s) => [s, titleCase(s)])} />
        <FilterSelect name="payment" label="Payment" value={sp.payment as string} options={[['pending', 'Pending'], ['paid', 'Paid'], ['failed', 'Failed'], ['refunded', 'Refunded'], ['partially_refunded', 'Partially refunded']]} />
        <FilterInput name="from" label="From" type="date" value={sp.from as string} />
        <FilterInput name="to" label="To" type="date" value={sp.to as string} />
        <button className="btn btn-primary btn-sm">Filter</button>
        <Link href="/admin/orders" className="btn btn-outline btn-sm">Reset</Link>
      </FilterBar>
      <Table head={['Order', 'Date', 'Customer', 'Items', 'Payment', 'Status', 'Destination', 'Total']} empty="No orders match these filters.">
        {(data ?? []).map((o: any) => (
          <tr key={o.id} className="hover:bg-bg/50">
            <Td><Link href={`/admin/orders/${o.id}`} className="font-medium underline">{o.order_number}</Link> {o.requires_review && o.review_status === 'pending' && <Badge tone="purple">Review</Badge>}</Td>
            <Td className="whitespace-nowrap">{formatDateTime(o.placed_at)}</Td>
            <Td><span className="block">{o.customer_name}</span><span className="text-muted">{o.email}</span></Td>
            <Td>{o.order_items?.[0]?.count ?? 0}</Td>
            <Td><Badge tone={o.payment_status === 'paid' ? 'green' : o.payment_status === 'failed' ? 'red' : 'gold'}>{titleCase(o.payment_status)}</Badge>{o.payment_channel && <span className="ml-1 text-[11px] text-muted">{o.payment_channel}</span>}</Td>
            <Td><Badge tone={ORDER_TONE[o.status]}>{titleCase(o.status)}</Badge></Td>
            <Td>{countryName(o.shipping_country)}</Td>
            <Td className="tabular-nums">{formatMoney(o.total)}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} total={count ?? 0} perPage={PER} href={(p) => `/admin/orders?${new URLSearchParams({ ...Object.fromEntries(params), page: String(p) })}`} />
    </>
  );
}
