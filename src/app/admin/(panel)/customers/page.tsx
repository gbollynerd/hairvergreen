import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Table, Td, Badge, FilterBar, FilterSelect, FilterInput, StatCard } from '@/components/admin/ui';
import { formatMoney } from '@/lib/money';
import { formatDate, countryName, COUNTRIES } from '@/lib/utils';
import { customersWithStats, applySegment } from './data';

export default async function Customers({ searchParams }: PageProps<'/admin/customers'>) {
  const staff = await requireStaffPage('customers.view');
  const sp = await searchParams;
  const [all, { data: products }] = await Promise.all([customersWithStats(), supabaseAdmin().from('products').select('id, name').order('name')]);
  const rows = await applySegment(all, sp);
  const buyers = all.filter((c) => c.orders_count > 0);
  const repeat = buyers.filter((c) => c.orders_count > 1).length;
  const ltv = buyers.length ? buyers.reduce((s, c) => s + c.total_spent, 0) / buyers.length : 0;
  return (
    <>
      <PageHeader title="Customers" description="Every buyer and account holder, with segments you can use for targeted campaigns."
        actions={staff.permissions.has('customers.export') && <a href="/api/admin/export/customers" className="btn btn-outline btn-sm">Export CSV</a>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Customers" value={all.length.toLocaleString()} />
        <StatCard label="Have purchased" value={buyers.length.toLocaleString()} />
        <StatCard label="Repeat rate" value={`${buyers.length ? Math.round((repeat / buyers.length) * 100) : 0}%`} />
        <StatCard label="Avg lifetime value" value={formatMoney(ltv)} />
      </div>
      <FilterBar>
        <FilterInput name="q" label="Search" value={sp.q as string} placeholder="Name, email, phone" />
        <FilterSelect name="segment" label="Segment" value={sp.segment as string} options={[['new', 'New (first order < 30 days)'], ['returning', 'Returning (2+ orders)'], ['high_value', 'High value'], ['lapsed', 'Lapsed (> 90 days)'], ['no_orders', 'No orders yet'], ['subscribers', 'Marketing subscribers'], ['wishlist', 'Has wishlist']]} />
        <FilterSelect name="country" label="Location" value={sp.country as string} options={COUNTRIES} />
        <FilterInput name="min_spent" label="Min spend ₦" value={sp.min_spent as string} type="number" />
        <FilterInput name="min_orders" label="Min orders" value={sp.min_orders as string} type="number" />
        <FilterSelect name="product" label="Purchased" value={sp.product as string} options={(products ?? []).map((p) => [p.id, p.name])} />
        <FilterInput name="last_after" label="Last order after" value={sp.last_after as string} type="date" />
        <FilterSelect name="sort" label="Sort" value={sp.sort as string} options={[['spent', 'Total spend'], ['orders', 'Orders'], ['recent', 'Last order']]} />
        <button className="btn btn-primary btn-sm">Apply</button><Link href="/admin/customers" className="btn btn-outline btn-sm">Reset</Link>
      </FilterBar>
      <p className="mb-2 text-[13px] text-muted">{rows.length} customer{rows.length === 1 ? '' : 's'} in this segment</p>
      <Table head={['Customer', 'Location', 'Orders', 'Total spent', 'Last order', 'Marketing', 'Account']} empty="No customers match.">
        {rows.slice(0, 300).map((c) => (
          <tr key={c.id} className="hover:bg-bg/50">
            <Td><Link href={`/admin/customers/${c.id}`} className="font-medium underline">{c.full_name || c.email}</Link><span className="block text-muted">{c.email}</span></Td>
            <Td>{countryName(c.country) || '—'}</Td><Td>{c.orders_count}</Td><Td className="tabular-nums">{formatMoney(c.total_spent)}</Td>
            <Td>{c.last_order_at ? formatDate(c.last_order_at) : '—'}</Td>
            <Td>{c.accepts_marketing ? <Badge tone="green">Subscribed</Badge> : <Badge>No</Badge>}</Td><Td>{c.user_id ? 'Registered' : 'Guest'}</Td>
          </tr>
        ))}
      </Table>
      {rows.length > 300 && <p className="mt-2 text-[12px] text-muted">Showing the first 300 — export to see all.</p>}
    </>
  );
}
