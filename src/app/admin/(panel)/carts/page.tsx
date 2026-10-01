import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Table, Td, StatCard, Badge, FilterBar, FilterSelect } from '@/components/admin/ui';
import { ActionButton, CopyText } from '@/components/admin/client';
import { formatMoney } from '@/lib/money';
import { formatDateTime, countryName } from '@/lib/utils';
import { env } from '@/lib/env';
import { sendRecoveryEmail } from './actions';

export default async function Carts({ searchParams }: PageProps<'/admin/carts'>) {
  const staff = await requireStaffPage('carts.view');
  const sp = await searchParams;
  const age = typeof sp.age === 'string' ? sp.age : '1h';
  const hours = { '1h': 1, '24h': 24, '7d': 168 }[age] ?? 1;
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  const db = supabaseAdmin();
  const [{ data: carts }, { count: recovered }] = await Promise.all([
    db.from('carts').select('id, email, phone, country, status, last_activity_at, created_at, recovery_token, recovered_at, user_id, cart_items (quantity, saved_for_later, product:product_id (name), variant:variant_id (price, title))')
      .in('status', ['active', 'abandoned']).lt('last_activity_at', cutoff).gt('last_activity_at', new Date(Date.now() - 60 * 86400_000).toISOString())
      .order('last_activity_at', { ascending: false }).limit(200),
    db.from('carts').select('id', { count: 'exact', head: true }).not('recovered_at', 'is', null).eq('status', 'converted'),
  ]);
  const rows = (carts ?? []).map((c: any) => {
    const items = (c.cart_items ?? []).filter((i: any) => !i.saved_for_later);
    return { ...c, items, value: items.reduce((a: number, i: any) => a + Number(i.variant?.price ?? 0) * i.quantity, 0) };
  }).filter((c) => c.items.length > 0);
  const withEmail = rows.filter((r) => r.email);
  return (
    <>
      <PageHeader title="Abandoned carts" description="Shoppers who added hair to their bag but did not check out. Send a gentle reminder with a link that restores their bag." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Abandoned carts" value={rows.length} sub="Last 60 days" />
        <StatCard label="Value left behind" value={formatMoney(rows.reduce((a, r) => a + r.value, 0))} />
        <StatCard label="Reachable by email" value={withEmail.length} />
        <StatCard label="Recovered & converted" value={recovered ?? 0} sub="All time" tone="up" />
      </div>
      <FilterBar><FilterSelect name="age" label="Inactive for at least" value={age} options={[['1h', '1 hour'], ['24h', '24 hours'], ['7d', '7 days']]} /><button className="btn btn-outline btn-sm">Filter</button></FilterBar>
      <Table head={['Customer', 'Items', 'Value', 'Country', 'Last active', 'Recovery']} empty="No abandoned carts — lovely.">
        {rows.map((c) => (
          <tr key={c.id}>
            <Td>{c.email ?? <span className="text-muted">Anonymous</span>}{c.phone && <span className="block text-[12px] text-muted">{c.phone}</span>}{c.user_id && <Badge tone="blue">Account</Badge>}</Td>
            <Td className="max-w-[280px] text-[12px]">{c.items.map((i: any, n: number) => <span key={n} className="block truncate">{i.quantity} × {i.product?.name} — {i.variant?.title}</span>)}</Td>
            <Td className="tabular-nums">{formatMoney(c.value)}</Td>
            <Td>{countryName(c.country)}</Td>
            <Td className="text-muted">{formatDateTime(c.last_activity_at)}</Td>
            <Td>
              <div className="flex flex-wrap items-center gap-3">
                {c.email && staff.permissions.has('carts.view') && <ActionButton action={sendRecoveryEmail.bind(null, c.id)}>Send reminder</ActionButton>}
                <CopyText label="Copy link" text={`${env.siteUrl}/cart/recover/${c.recovery_token}`} />
                {c.recovered_at && <Badge tone="green">Link opened</Badge>}
              </div>
            </Td>
          </tr>
        ))}
      </Table>
      <p className="mt-4 text-[12px] text-muted">Only email customers who gave you their address at checkout. Recovery links restore the bag on any device; account carts are only restored for that signed-in customer.</p>
    </>
  );
}
