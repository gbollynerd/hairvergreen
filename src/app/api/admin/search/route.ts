import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getStaff } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { formatDate, titleCase } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export type SearchHit = { group: string; title: string; sub?: string; href: string };

/**
 * Admin-wide search. Each area is searched only if the signed-in staff member can open it,
 * so results never reveal records a person isn't allowed to see.
 */
export async function GET(req: NextRequest) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const raw = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 80);
  // Strip characters that have meaning inside PostgREST filters
  const q = raw.replace(/[%_,()\\*:"']/g, ' ').replace(/\s+/g, ' ').trim();
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const can = (...p: string[]) => p.some((x) => staff.permissions.has(x));
  const db = supabaseAdmin();
  const like = `%${q}%`;
  const L = 6;
  const jobs: Promise<SearchHit[]>[] = [];

  if (can('orders.view')) jobs.push((async () => {
    const { data } = await db.from('orders').select('id, order_number, customer_name, email, total, status, placed_at')
      .or(`order_number.ilike.${like},email.ilike.${like},customer_name.ilike.${like},phone.ilike.${like},tracking_number.ilike.${like},payment_reference.ilike.${like}`)
      .order('placed_at', { ascending: false }).limit(L);
    return (data ?? []).map((o) => ({ group: 'Orders', title: `${o.order_number} · ${o.customer_name || o.email}`, sub: `${formatMoney(o.total)} · ${titleCase(o.status)} · ${formatDate(o.placed_at)}`, href: `/admin/orders/${o.id}` }));
  })());

  if (can('products.view')) jobs.push((async () => {
    const [{ data: byName }, { data: bySku }] = await Promise.all([
      db.from('products').select('id, name, status, product_type').or(`name.ilike.${like},slug.ilike.${like}`).order('name').limit(L),
      db.from('product_variants').select('sku, title, product:product_id (id, name, status, product_type)').ilike('sku', like).limit(L),
    ]);
    const hits: SearchHit[] = (byName ?? []).map((p) => ({ group: 'Products', title: p.name, sub: `${titleCase(p.product_type)} · ${titleCase(p.status)}`, href: `/admin/products/${p.id}` }));
    for (const v of (bySku ?? []) as any[]) {
      if (!v.product || hits.some((h) => h.href.endsWith(v.product.id))) continue;
      hits.push({ group: 'Products', title: v.product.name, sub: `SKU ${v.sku} · ${v.title}`, href: `/admin/products/${v.product.id}` });
    }
    return hits.slice(0, L);
  })());

  if (can('customers.view')) jobs.push((async () => {
    const { data } = await db.from('customers').select('id, full_name, email, phone, country')
      .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`).order('created_at', { ascending: false }).limit(L);
    return (data ?? []).map((c) => ({ group: 'Customers', title: c.full_name || c.email, sub: [c.full_name ? c.email : null, c.phone].filter(Boolean).join(' · '), href: `/admin/customers/${c.id}` }));
  })());

  if (can('returns.manage')) jobs.push((async () => {
    const { data } = await db.from('return_requests').select('id, rma_number, email, status').or(`rma_number.ilike.${like},email.ilike.${like}`).order('created_at', { ascending: false }).limit(L);
    return (data ?? []).map((r) => ({ group: 'Returns', title: `${r.rma_number} · ${r.email}`, sub: titleCase(r.status), href: `/admin/returns/${r.id}` }));
  })());

  if (can('coupons.edit', 'coupons.create')) jobs.push((async () => {
    const { data } = await db.from('discounts').select('id, name, code, is_active').or(`name.ilike.${like},code.ilike.${like}`).limit(L);
    return (data ?? []).map((d) => ({ group: 'Discounts', title: d.code ? `${d.code} · ${d.name}` : d.name, sub: d.is_active ? 'Active' : 'Inactive', href: `/admin/discounts/${d.id}` }));
  })());

  if (can('collections.manage')) jobs.push((async () => {
    const { data } = await db.from('collections').select('id, name').ilike('name', like).limit(L);
    return (data ?? []).map((c) => ({ group: 'Collections', title: c.name, href: `/admin/collections/${c.id}` }));
  })());

  if (can('categories.manage')) jobs.push((async () => {
    const { data } = await db.from('categories').select('id, name').ilike('name', like).limit(L);
    return (data ?? []).map((c) => ({ group: 'Categories', title: c.name, href: `/admin/categories/${c.id}` }));
  })());

  if (can('content.edit')) jobs.push((async () => {
    const { data } = await db.from('pages').select('id, title, slug').or(`title.ilike.${like},slug.ilike.${like}`).limit(L);
    return (data ?? []).map((p) => ({ group: 'Pages', title: p.title, sub: p.slug === 'home' ? 'Homepage' : `/${p.slug}`, href: `/admin/pages/${p.id}` }));
  })());

  if (can('blog.edit_any', 'blog.edit_own')) jobs.push((async () => {
    let query = db.from('blog_posts').select('id, title, status').ilike('title', like).limit(L);
    if (!staff.permissions.has('blog.edit_any')) query = query.eq('author_id', staff.id);
    const { data } = await query;
    return (data ?? []).map((p) => ({ group: 'Hair Journal', title: p.title, sub: titleCase(p.status), href: `/admin/journal/${p.id}` }));
  })());

  if (can('shipping.manage')) jobs.push((async () => {
    const [{ data: methods }, { data: zones }] = await Promise.all([
      db.from('shipping_methods').select('id, name, carrier, shipping_zones(name)').or(`name.ilike.${like},carrier.ilike.${like}`).limit(L),
      db.from('shipping_zones').select('id, name').ilike('name', like).limit(L),
    ]);
    return [
      ...((methods ?? []) as any[]).map((m) => ({ group: 'Delivery', title: m.name, sub: [m.shipping_zones?.name, m.carrier].filter(Boolean).join(' · '), href: `/admin/shipping-methods/${m.id}` })),
      ...(zones ?? []).map((z) => ({ group: 'Delivery', title: `${z.name} (zone)`, href: `/admin/shipping-zones/${z.id}` })),
    ];
  })());

  if (can('consultations.manage')) jobs.push((async () => {
    const { data } = await db.from('consultations').select('id, name, email, kind, status').or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`).order('created_at', { ascending: false }).limit(L);
    return (data ?? []).map((c) => ({ group: 'Consultations', title: c.name || c.email, sub: `${titleCase(c.kind)} · ${titleCase(c.status)}`, href: `/admin/consultations/${c.id}` }));
  })());

  if (can('messages.view')) jobs.push((async () => {
    const { data } = await db.from('contact_messages').select('id, name, email, subject').or(`name.ilike.${like},email.ilike.${like},subject.ilike.${like},order_number.ilike.${like}`).order('created_at', { ascending: false }).limit(L);
    return (data ?? []).map((m) => ({ group: 'Messages', title: m.subject || m.name || m.email, sub: [m.name, m.email].filter(Boolean).join(' · '), href: `/admin/messages/${m.id}` }));
  })());

  const settled = await Promise.allSettled(jobs);
  const hits = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return NextResponse.json({ hits }, { headers: { 'cache-control': 'no-store' } });
}
