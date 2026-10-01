import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type CustomerRow = { id: string; email: string; full_name: string | null; phone: string | null; country: string | null; accepts_marketing: boolean; tags: string[]; created_at: string; user_id: string | null;
  orders_count: number; total_spent: number; last_order_at: string | null; first_order_at: string | null };

export async function customersWithStats() {
  const db = supabaseAdmin();
  const [{ data: cs }, { data: stats }] = await Promise.all([
    db.from('customers').select('id, email, full_name, phone, country, accepts_marketing, tags, created_at, user_id').order('created_at', { ascending: false }).limit(10000),
    db.from('customer_stats').select('*').limit(10000),
  ]);
  const m = new Map((stats ?? []).map((s: any) => [s.customer_id, s]));
  return (cs ?? []).map((c: any) => { const s: any = m.get(c.id) ?? {}; return { ...c, orders_count: Number(s.orders_count ?? 0), total_spent: Number(s.total_spent ?? 0), last_order_at: s.last_order_at ?? null, first_order_at: s.first_order_at ?? null } as CustomerRow; });
}

export async function applySegment(rows: CustomerRow[], sp: Record<string, string | string[] | undefined>) {
  const db = supabaseAdmin();
  const now = Date.now(); const day = 86400_000;
  let r = rows;
  const q = typeof sp.q === 'string' ? sp.q.toLowerCase().trim() : '';
  if (q) r = r.filter((c) => `${c.email} ${c.full_name ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(q));
  switch (sp.segment) {
    case 'new': r = r.filter((c) => c.first_order_at && now - +new Date(c.first_order_at) < 30 * day); break;
    case 'returning': r = r.filter((c) => c.orders_count > 1); break;
    case 'high_value': r = r.filter((c) => c.total_spent >= (Number(sp.min_spent) || 1_000_000) * 100); break;
    case 'lapsed': r = r.filter((c) => c.last_order_at && now - +new Date(c.last_order_at) > 90 * day); break;
    case 'no_orders': r = r.filter((c) => c.orders_count === 0); break;
    case 'subscribers': r = r.filter((c) => c.accepts_marketing); break;
    case 'wishlist': {
      const { data } = await db.from('wishlist_items').select('user_id');
      const ids = new Set((data ?? []).map((w) => w.user_id));
      r = r.filter((c) => c.user_id && ids.has(c.user_id)); break;
    }
  }
  if (typeof sp.country === 'string' && sp.country) r = r.filter((c) => c.country === sp.country);
  if (sp.min_spent && sp.segment !== 'high_value') r = r.filter((c) => c.total_spent >= Number(sp.min_spent) * 100);
  if (sp.min_orders) r = r.filter((c) => c.orders_count >= Number(sp.min_orders));
  if (typeof sp.last_before === 'string' && sp.last_before) r = r.filter((c) => c.last_order_at && c.last_order_at < sp.last_before!);
  if (typeof sp.last_after === 'string' && sp.last_after) r = r.filter((c) => c.last_order_at && c.last_order_at >= sp.last_after!);
  if (typeof sp.product === 'string' && sp.product) {
    const { data } = await db.from('order_items').select('orders!inner(customer_id, payment_status)').eq('product_id', sp.product).in('orders.payment_status', ['paid', 'partially_refunded', 'refunded']);
    const ids = new Set((data ?? []).map((x: any) => x.orders?.customer_id));
    r = r.filter((c) => ids.has(c.id));
  }
  const sort = sp.sort;
  if (sort === 'spent') r = [...r].sort((a, b) => b.total_spent - a.total_spent);
  if (sort === 'orders') r = [...r].sort((a, b) => b.orders_count - a.orders_count);
  if (sort === 'recent') r = [...r].sort((a, b) => (b.last_order_at ?? '').localeCompare(a.last_order_at ?? ''));
  return r;
}
