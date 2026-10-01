import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Table, Td, Badge, FilterBar, FilterSelect, FilterInput, Pagination, StatCard } from '@/components/admin/ui';
import { formatMoney } from '@/lib/money';
import { formatDateTime, titleCase } from '@/lib/utils';

const PER = 40;
const TONE: Record<string, string> = { success: 'green', initialized: 'gray', pending: 'gold', failed: 'red', abandoned: 'gray', mismatch: 'red', reversed: 'purple' };

export default async function Payments({ searchParams }: PageProps<'/admin/payments'>) {
  await requireStaffPage('payments.view');
  const sp = await searchParams;
  const status = typeof sp.status === 'string' ? sp.status : '';
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 80) : '';
  const page = Math.max(1, Number(sp.page) || 1);
  const db = supabaseAdmin();
  let query = db.from('payments').select('id, provider, reference, amount, currency, status, channel, fees, customer_email, paid_at, created_at, order:order_id (id, order_number)', { count: 'exact' })
    .order('created_at', { ascending: false }).range((page - 1) * PER, page * PER - 1);
  if (status) query = query.eq('status', status);
  if (q) { const s = q.replace(/[%,()]/g, ' '); query = query.or(`reference.ilike.%${s}%,customer_email.ilike.%${s}%`); }
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [{ data, count }, { data: recent }, { count: webhookErrors }] = await Promise.all([
    query,
    db.from('payments').select('status, amount, fees').gte('created_at', since),
    db.from('webhook_events').select('id', { count: 'exact', head: true }).not('error', 'is', null).gte('received_at', since),
  ]);
  const ok = (recent ?? []).filter((p) => p.status === 'success');
  const attempts = (recent ?? []).filter((p) => p.status !== 'initialized').length;
  const href = (p: number) => `/admin/payments?${new URLSearchParams({ status, q, page: String(p) })}`;
  return (
    <>
      <PageHeader title="Payments" description="Every payment attempt, verified server-side with Paystack. Orders are only marked paid after verification." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Collected · 30 days" value={formatMoney(ok.reduce((a, p) => a + Number(p.amount), 0))} sub={`${ok.length} successful payments`} />
        <StatCard label="Processor fees · 30 days" value={formatMoney(ok.reduce((a, p) => a + Number(p.fees ?? 0), 0))} />
        <StatCard label="Success rate" value={attempts ? `${Math.round((ok.length / attempts) * 100)}%` : '—'} sub="Of completed attempts" />
        <StatCard label="Issues · 30 days" value={(recent ?? []).filter((p) => p.status === 'mismatch').length + (webhookErrors ?? 0)} sub="Amount mismatches & webhook errors" tone={(webhookErrors ?? 0) > 0 ? 'down' : 'neutral'} />
      </div>
      <FilterBar>
        <FilterInput name="q" label="Search" value={q} placeholder="Reference or email" />
        <FilterSelect name="status" label="Status" value={status} options={Object.keys(TONE).map((s) => [s, titleCase(s)])} />
        <button className="btn btn-outline btn-sm">Filter</button>
      </FilterBar>
      <Table head={['Reference', 'Order', 'Customer', 'Amount', 'Fees', 'Method', 'Status', 'Date']} empty="No payments yet.">
        {(data ?? []).map((p: any) => (
          <tr key={p.id}>
            <Td className="font-mono text-[12px]">{p.reference}</Td>
            <Td>{p.order ? <Link href={`/admin/orders/${p.order.id}`} className="underline">{p.order.order_number}</Link> : '—'}</Td>
            <Td>{p.customer_email ?? '—'}</Td>
            <Td className="tabular-nums">{formatMoney(p.amount)}</Td>
            <Td className="tabular-nums text-muted">{p.fees ? formatMoney(p.fees) : '—'}</Td>
            <Td>{titleCase(p.channel ?? p.provider)}</Td>
            <Td><Badge tone={TONE[p.status]}>{titleCase(p.status)}</Badge></Td>
            <Td className="text-muted">{formatDateTime(p.paid_at ?? p.created_at)}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} total={count ?? 0} perPage={PER} href={href} />
    </>
  );
}
