import { type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getStaff } from '@/lib/auth';
import { audit } from '@/lib/audit';

const PERMS: Record<string, string> = { orders: 'orders.export', customers: 'customers.export', subscribers: 'newsletter.view', inventory: 'inventory.view', expenses: 'finance.view' };

function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // prevent spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
const naira = (k: number | null | undefined) => ((k ?? 0) / 100).toFixed(2);

export async function GET(req: NextRequest, ctx: RouteContext<'/api/admin/export/[kind]'>) {
  const { kind } = await ctx.params;
  const staff = await getStaff();
  if (!PERMS[kind] || !staff?.permissions.has(PERMS[kind])) return new Response('Forbidden', { status: 403 });
  const db = supabaseAdmin(); const sp = req.nextUrl.searchParams;
  let rows: Record<string, unknown>[] = [];
  if (kind === 'orders') {
    let q = db.from('orders').select('order_number, placed_at, paid_at, status, payment_status, fulfillment_status, customer_name, email, phone, shipping_country, subtotal, discount_total, shipping_total, tax_total, total, refunded_total, cost_total, payment_fees, payment_channel, discount_codes, carrier, tracking_number').order('placed_at', { ascending: false }).limit(10000);
    if (sp.get('status')) q = q.eq('status', sp.get('status')!);
    if (sp.get('payment')) q = q.eq('payment_status', sp.get('payment')!);
    if (sp.get('from')) q = q.gte('placed_at', sp.get('from')!);
    if (sp.get('to')) q = q.lte('placed_at', sp.get('to')! + 'T23:59:59');
    const { data } = await q;
    rows = (data ?? []).map((o: any) => ({ ...o, subtotal: naira(o.subtotal), discount_total: naira(o.discount_total), shipping_total: naira(o.shipping_total), tax_total: naira(o.tax_total), total: naira(o.total), refunded_total: naira(o.refunded_total), cost_total: naira(o.cost_total), payment_fees: naira(o.payment_fees), discount_codes: (o.discount_codes ?? []).join(' ') }));
  } else if (kind === 'customers') {
    const { data } = await db.from('customers').select('id, email, full_name, phone, country, accepts_marketing, tags, created_at').order('created_at', { ascending: false }).limit(20000);
    const { data: stats } = await db.from('customer_stats').select('*').limit(20000);
    const m = new Map((stats ?? []).map((s: any) => [s.customer_id, s]));
    rows = (data ?? []).map((c: any) => { const s: any = m.get(c.id) ?? {}; return { email: c.email, name: c.full_name, phone: c.phone, country: c.country, accepts_marketing: c.accepts_marketing, tags: (c.tags ?? []).join(' '), orders: s.orders_count ?? 0, total_spent: naira(s.total_spent), last_order: s.last_order_at ?? '', created_at: c.created_at }; });
  } else if (kind === 'subscribers') {
    const { data } = await db.from('newsletter_subscribers').select('email, source, consent_at, unsubscribed_at').is('unsubscribed_at', null).order('created_at', { ascending: false }).limit(50000);
    rows = data ?? [];
  } else if (kind === 'inventory') {
    const { data } = await db.from('product_variants').select('sku, title, stock_on_hand, stock_reserved, low_stock_threshold, price, cost_price, track_inventory, product:product_id (name, status)').order('sku').limit(20000);
    rows = (data ?? []).map((v: any) => ({ product: v.product?.name, status: v.product?.status, variant: v.title, sku: v.sku, on_hand: v.stock_on_hand, reserved: v.stock_reserved, available: v.stock_on_hand - v.stock_reserved, low_stock_threshold: v.low_stock_threshold, price: naira(v.price), cost: naira(v.cost_price), tracked: v.track_inventory }));
  } else if (kind === 'expenses') {
    const { data } = await db.from('expenses').select('spent_on, category, description, amount').order('spent_on', { ascending: false }).limit(20000);
    rows = (data ?? []).map((e: any) => ({ ...e, amount: naira(e.amount) }));
  }
  await audit(staff, { action: 'export', entityType: kind, summary: `Exported ${rows.length} ${kind}` });
  return new Response(csv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="hairvergreen-${kind}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
