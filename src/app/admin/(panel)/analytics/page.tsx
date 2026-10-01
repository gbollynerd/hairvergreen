import Link from 'next/link';
import { Suspense } from 'react';
import { requireStaffPage } from '@/lib/auth';
import { getReport, parsePeriod, delta } from '@/lib/admin/reports';
import { PageHeader, Card, StatCard, Table, Td } from '@/components/admin/ui';
import { TimeChart, BarList } from '@/components/admin/charts';
import { PeriodPicker } from '@/components/admin/period-picker';
import { formatMoney } from '@/lib/money';
import { countryName, titleCase } from '@/lib/utils';

export default async function Analytics({ searchParams }: PageProps<'/admin/analytics'>) {
  const staff = await requireStaffPage('analytics.view');
  const period = parsePeriod(await searchParams);
  const canFinance = staff.permissions.has('finance.view');
  const r = await getReport(period);
  const s = r.summary; const p = r.prev;
  const n = (k: string) => Number(s[k] ?? 0);
  const m = (k: string) => formatMoney(n(k));
  const d = (k: string) => delta(n(k), Number(p[k] ?? 0));

  const pl: [string, number, string?][] = [
    ['Gross sales', n('gross_sales'), 'Product revenue before discounts'],
    ['Discounts', -n('discounts')],
    ['Refunds', -n('refunds')],
    ['Net sales', n('net_sales'), 'Gross sales − discounts − refunds'],
    ['Shipping collected', n('shipping')],
    ['Tax collected', n('tax')],
    ['Total revenue', n('revenue'), 'What customers paid (after refunds)'],
  ];
  const profit: [string, number, string?][] = [
    ['Net sales', n('net_sales')],
    ['Cost of goods', -n('cogs'), 'From variant cost prices at time of sale'],
    ['Payment fees', -n('fees'), 'Recorded processor fees'],
    ['Gross profit', n('gross_profit')],
    ['Operating expenses', -n('expenses'), 'From the Expenses log'],
    ['Net profit', n('net_profit')],
  ];

  return (
    <>
      <PageHeader title="Sales & profit" description={`How Hairver Green is performing · ${period.label}. All figures in Naira.`}
        actions={<><Suspense><PeriodPicker /></Suspense>{staff.permissions.has('orders.export') && <a href="/api/admin/export/orders" className="btn btn-outline btn-sm">Export orders CSV</a>}</>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue" value={m('revenue')} sub={d('revenue').text} tone={d('revenue').tone} />
        <StatCard label="Net sales" value={m('net_sales')} sub={d('net_sales').text} tone={d('net_sales').tone} />
        <StatCard label="Orders" value={n('orders').toLocaleString()} sub={d('orders').text} tone={d('orders').tone} />
        <StatCard label="Average order" value={m('aov')} sub={`${n('units').toLocaleString()} units sold`} />
        {canFinance && <>
          <StatCard label="Gross profit" value={m('gross_profit')} sub={d('gross_profit').text} tone={d('gross_profit').tone} />
          <StatCard label="Net profit" value={m('net_profit')} sub={`${n('margin_pct')}% net margin`} tone={n('net_profit') >= 0 ? 'up' : 'down'} />
          <StatCard label="Expenses" value={m('expenses')} sub={<Link href="/admin/expenses" className="underline">Manage expenses</Link>} />
        </>}
        <StatCard label="Conversion" value={`${n('conversion_pct').toFixed(2)}%`} sub={`${n('sessions').toLocaleString()} sessions`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Revenue"><TimeChart data={r.series} dataKey="revenue" label="Revenue over time" /></Card>
        {canFinance ? <Card title="Profit (after cost of goods)"><TimeChart data={r.series} dataKey="profit" label="Profit over time" /></Card> : <Card title="Orders"><TimeChart data={r.series} dataKey="orders" money={false} kind="bar" label="Orders over time" /></Card>}
        <Card title="Refunds"><TimeChart data={r.series} dataKey="refunds" kind="bar" label="Refunds over time" /></Card>
        <Card title="New customers"><TimeChart data={r.series} dataKey="new_customers" money={false} kind="bar" label="New customers over time" /></Card>
      </div>

      {canFinance && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title="Sales statement" padded={false}><Statement rows={pl} totals={['Net sales', 'Total revenue']} /></Card>
          <Card title="Profit statement" padded={false}><Statement rows={profit} totals={['Gross profit', 'Net profit']} /></Card>
        </div>
      )}

      <div className="mt-6">
        <Card title="Product performance" padded={false}>
          <Table head={canFinance ? ['Product', 'Units', 'Revenue', 'Profit', 'Margin'] : ['Product', 'Units', 'Revenue']} className="border-0" empty="No sales in this period.">
            {r.top.map((t) => (
              <tr key={t.product_id}>
                <Td><Link href={`/admin/products/${t.product_id}`} className="underline">{t.name}</Link></Td>
                <Td className="tabular-nums">{Number(t.units).toLocaleString()}</Td><Td className="tabular-nums">{formatMoney(t.revenue)}</Td>
                {canFinance && <><Td className="tabular-nums">{formatMoney(t.profit)}</Td><Td className="tabular-nums">{t.revenue ? `${Math.round((Number(t.profit) / Number(t.revenue)) * 100)}%` : '—'}</Td></>}
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="By category"><BarList rows={r.byCategory.map((c) => ({ label: c.label, value: Number(c.revenue), sub: `${c.orders} orders` }))} /></Card>
        <Card title="By country"><BarList rows={r.byCountry.map((c) => ({ label: countryName(c.label), value: Number(c.revenue), sub: `${c.orders} orders` }))} /></Card>
        <Card title="By payment method"><BarList rows={r.byChannel.map((c) => ({ label: titleCase(c.label), value: Number(c.revenue), sub: `${c.orders} orders` }))} /></Card>
        {canFinance && <Card title="Expenses by category" actions={<Link href="/admin/expenses" className="text-[12px] underline">Expenses</Link>}><BarList rows={r.byExpense.map((c) => ({ label: titleCase(c.label), value: Number(c.revenue) }))} /></Card>}
        <Card title="Shopping funnel"><BarList money={false} rows={r.funnel.map((f) => ({ label: titleCase(f.step), value: Number(f.sessions) }))} /></Card>
      </div>
      <p className="mt-6 text-[12px] text-muted">Profit uses the cost price on each variant at the time of sale. Add cost prices to products and log expenses (rent, salaries, ads, packaging) to keep net profit accurate.</p>
    </>
  );
}

function Statement({ rows, totals }: { rows: [string, number, string?][]; totals: string[] }) {
  return (
    <table className="w-full text-[14px]">
      <tbody className="divide-y divide-line">
        {rows.map(([label, v, hint]) => {
          const total = totals.includes(label);
          return (
            <tr key={label} className={total ? 'bg-bg/60 font-medium' : ''}>
              <td className="px-5 py-3">{label}{hint && <span className="block text-[12px] font-normal text-muted">{hint}</span>}</td>
              <td className={`px-5 py-3 text-right tabular-nums ${v < 0 ? 'text-sale' : ''}`}>{v < 0 ? `(${formatMoney(-v)})` : formatMoney(v)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
