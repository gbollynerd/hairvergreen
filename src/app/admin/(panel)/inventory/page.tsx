import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card, FilterBar, FilterSelect, FilterInput } from '@/components/admin/ui';
import { InventoryTable } from './inventory-table';
import { formatDateTime } from '@/lib/utils';

export default async function Inventory({ searchParams }: PageProps<'/admin/inventory'>) {
  const staff = await requireStaffPage('inventory.view');
  const sp = await searchParams;
  const db = supabaseAdmin();
  const q = typeof sp.q === 'string' ? sp.q.trim().toLowerCase() : '';
  const [{ data }, { data: moves }] = await Promise.all([
    db.from('product_variants').select('id, sku, title, stock_on_hand, stock_reserved, low_stock_threshold, allow_backorder, restock_date, track_inventory, is_active, product:product_id (id, name, status, product_type)').eq('track_inventory', true).order('stock_on_hand').limit(2000),
    db.from('inventory_movements').select('id, delta_on_hand, delta_reserved, reason, note, created_at, order_id, variant:variant_id (title, product:product_id (name))').order('created_at', { ascending: false }).limit(40),
  ]);
  let rows = (data ?? []).filter((v: any) => v.is_active && v.product && v.product.status !== 'archived').map((v: any) => ({
    id: v.id, sku: v.sku, title: v.title, product: v.product.name, productId: v.product.id, status: v.product.status,
    onHand: v.stock_on_hand, reserved: v.stock_reserved, available: v.stock_on_hand - v.stock_reserved, threshold: v.low_stock_threshold, backorder: v.allow_backorder, restock: v.restock_date,
  }));
  if (q) rows = rows.filter((r) => `${r.product} ${r.title} ${r.sku}`.toLowerCase().includes(q));
  if (sp.filter === 'low') rows = rows.filter((r) => r.available <= r.threshold && r.available > 0);
  if (sp.filter === 'out') rows = rows.filter((r) => r.available <= 0);
  const totalUnits = rows.reduce((s, r) => s + Math.max(0, r.onHand), 0);
  return (
    <>
      <PageHeader title="Inventory" description={`${rows.length} variants · ${totalUnits.toLocaleString()} units on hand. Reserved units are held by orders awaiting payment.`}
        actions={<a href="/api/admin/export/inventory" className="btn btn-outline btn-sm">Export CSV</a>} />
      <FilterBar>
        <FilterInput name="q" label="Search" value={q} placeholder="Product, variant, SKU" />
        <FilterSelect name="filter" label="Stock" value={sp.filter as string} options={[['low', 'Low stock'], ['out', 'Out of stock']]} />
        <button className="btn btn-primary btn-sm">Filter</button><Link href="/admin/inventory" className="btn btn-outline btn-sm">Reset</Link>
      </FilterBar>
      <InventoryTable rows={rows} canEdit={staff.permissions.has('inventory.edit')} />
      <div className="mt-8"><Card title="Recent stock movements">
        <ul className="divide-y divide-line text-[13px]">{(moves ?? []).map((m: any) => (
          <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{m.variant?.product?.name} — {m.variant?.title}</span>
            <span className="text-muted">{m.reason.replace(/_/g, ' ')}{m.delta_on_hand ? ` · on hand ${m.delta_on_hand > 0 ? '+' : ''}${m.delta_on_hand}` : ''}{m.delta_reserved ? ` · reserved ${m.delta_reserved > 0 ? '+' : ''}${m.delta_reserved}` : ''}{m.note ? ` · ${m.note}` : ''} · {formatDateTime(m.created_at)}</span></li>
        ))}</ul>
      </Card></div>
    </>
  );
}
