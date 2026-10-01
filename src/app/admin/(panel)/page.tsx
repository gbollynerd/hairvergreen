import Link from 'next/link';
import { Suspense } from 'react';
import { requireStaffPage } from '@/lib/auth';
import { getReport, parsePeriod, delta } from '@/lib/admin/reports';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card, StatCard, Table, Td, Badge, ORDER_TONE } from '@/components/admin/ui';
import { TimeChart, BarList } from '@/components/admin/charts';
import { PeriodPicker } from '@/components/admin/period-picker';
import { formatMoney } from '@/lib/money';
import { formatDateTime, countryName, titleCase } from '@/lib/utils';

export default async function Dashboard({ searchParams }: PageProps<'/admin'>) {
  const staff = await requireStaffPage('dashboard.view');
  const period = parsePeriod(await searchParams);
  const canSales = staff.permissions.has('analytics.view') || staff.permissions.has('orders.view');
  const canFinance = staff.permissions.has('finance.view');
  const db = supabaseAdmin();
  const [report, { data: recent }, { data: low }] = await Promise.all([
    canSales ? getReport(period) : Promise.resolve(null),
    staff.permissions.has('orders.view') ? db.from('orders').select('id, order_number, customer_name, email, total, status, placed_at, requires_review, review_status').order('placed_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    staff.permissions.has('inventory.view') ? db.from('product_variants').select('id, title, sku, stock_on_hand, stock_reserved, low_stock_threshold, track_inventory, product:product_id (name, status)').eq('track_inventory', true).eq('is_active', true).order('stock_on_hand').limit(60) : Promise.resolve({ data: [] }),
  ]);
  const lowList = (low ?? []).filter((v: any) => v.product?.status === 'active' && v.stock_on_hand - v.stock_reserved <= v.low_stock_threshold).slice(0, 8);
  const s = report?.summary ?? {}; const p = report?.prev ?? {};
  const m = (k: string) => formatMoney(Number(s[k] ?? 0));

  return (
    <>
      <PageHeader title={`Good ${new Date().getUTCHours() + 1 < 12 ? 'morning' : new Date().getUTCHours() + 1 < 17 ? 'afternoon' : 'evening'}${staff.name ? `, ${staff.name.split(' ')[0]}` : ''}`}
        description={`Here's how Hairver Green is doing · ${period.label}`} actions={<Suspense><PeriodPicker /></Suspense>} />

      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Revenue" value={m('revenue')} sub={delta(s.revenue, p.revenue).text} tone={delta(s.revenue, p.revenue).tone} />
            <StatCard label="Orders" value={Number(s.orders ?? 0).toLocaleString()} sub={delta(s.orders, p.orders).text} tone={delta(s.orders, p.orders).tone} />
            <StatCard label="Average order" value={m('aov')} sub={delta(s.aov, p.aov).text} tone={delta(s.aov, p.aov).tone} />
            <StatCard label="Conversion" value={`${Number(s.conversion_pct ?? 0).toFixed(2)}%`} sub={`${Number(s.sessions ?? 0).toLocaleString()} sessions`} />
            {canFinance && <>
              <StatCard label="Gross profit" value={m('gross_profit')} sub={`After cost of goods & fees`} />
              <StatCard label="Net profit" value={m('net_profit')} sub={`${Number(s.margin_pct ?? 0)}% margin after expenses`} tone={Number(s.net_profit) >= 0 ? 'up' : 'down'} />
            </>}
            <StatCard label="Customers" value={Number(s.customers ?? 0).toLocaleString()} sub={`${s.new_customers ?? 0} new`} />
            <StatCard label="Refunds" value={m('refunds')} sub={`${s.refund_count ?? 0} processed`} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Link href="/admin/orders?status=paid" className="border border-line bg-surface p-4 text-[13px] hover:border-primary"><span className="font-display text-[26px]">{s.pending_fulfilment ?? 0}</span><br />Orders to fulfil</Link>
            <Link href="/admin/orders?review=pending" className="border border-line bg-surface p-4 text-[13px] hover:border-primary"><span className="font-display text-[26px]">{s.review_required ?? 0}</span><br />Custom reviews pending</Link>
            <Link href="/admin/returns" className="border border-line bg-surface p-4 text-[13px] hover:border-primary"><span className="font-display text-[26px]">{s.open_returns ?? 0}</span><br />Open returns</Link>
            <Link href="/admin/inventory?filter=low" className="border border-line bg-surface p-4 text-[13px] hover:border-primary"><span className="font-display text-[26px]">{s.low_stock ?? 0}</span><br />Low-stock variants</Link>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card title="Revenue over time"><TimeChart data={report.series} dataKey="revenue" label="Revenue over time" /></Card>
            <Card title="Orders over time"><TimeChart data={report.series} dataKey="orders" money={false} kind="bar" label="Orders over time" /></Card>
            {canFinance && <Card title="Profit over time" actions={<Link href="/admin/analytics" className="text-[12px] underline">Full report</Link>}><TimeChart data={report.series} dataKey="profit" label="Profit over time" /></Card>}
            <Card title="New customers"><TimeChart data={report.series} dataKey="new_customers" money={false} kind="bar" label="New customers over time" /></Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card title="Top products"><BarList rows={report.top.map((t) => ({ label: t.name, value: t.revenue, sub: `${t.units} sold` }))} /></Card>
            <Card title="Top categories"><BarList rows={report.byCategory.slice(0, 8).map((c) => ({ label: c.label, value: c.revenue }))} /></Card>
            <Card title="Sales by country"><BarList rows={report.byCountry.slice(0, 8).map((c) => ({ label: countryName(c.label), value: c.revenue, sub: `${c.orders} orders` }))} /></Card>
            <Card title="Sales by payment method"><BarList rows={report.byChannel.map((c) => ({ label: titleCase(c.label), value: c.revenue, sub: `${c.orders}` }))} /></Card>
            <Card title="Shopping funnel"><BarList money={false} rows={report.funnel.map((f) => ({ label: titleCase(f.step), value: Number(f.sessions) }))} /></Card>
            <Card title="Low stock" actions={<Link href="/admin/inventory?filter=low" className="text-[12px] underline">Inventory</Link>}>
              {lowList.length ? <ul className="space-y-2 text-[13px]">{lowList.map((v: any) => <li key={v.id} className="flex justify-between gap-3"><span className="truncate">{v.product?.name} — {v.title}</span><Badge tone={v.stock_on_hand - v.stock_reserved <= 0 ? 'red' : 'gold'}>{Math.max(0, v.stock_on_hand - v.stock_reserved)} left</Badge></li>)}</ul> : <p className="text-[13px] text-muted">All stock levels are healthy.</p>}
            </Card>
          </div>
        </>
      )}

      {(recent ?? []).length > 0 && (
        <div className="mt-6">
          <Card title="Recent orders" actions={<Link href="/admin/orders" className="text-[12px] underline">All orders</Link>} padded={false}>
            <Table head={['Order', 'Customer', 'Date', 'Status', 'Total']} className="border-0">
              {(recent ?? []).map((o: any) => (
                <tr key={o.id} className="hover:bg-bg/50">
                  <Td><Link href={`/admin/orders/${o.id}`} className="font-medium underline">{o.order_number}</Link>{o.requires_review && o.review_status === 'pending' && <Badge tone="purple">Review</Badge>}</Td>
                  <Td>{o.customer_name || o.email}</Td><Td>{formatDateTime(o.placed_at)}</Td>
                  <Td><Badge tone={ORDER_TONE[o.status]}>{titleCase(o.status)}</Badge></Td><Td className="tabular-nums">{formatMoney(o.total)}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}
