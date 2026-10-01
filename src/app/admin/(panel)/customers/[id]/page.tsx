import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card, Table, Td, Badge, ORDER_TONE, StatCard } from '@/components/admin/ui';
import { ActionForm, Submit, Field, Toggle, TagsInput } from '@/components/admin/client';
import { formatMoney } from '@/lib/money';
import { formatDate, formatDateTime, titleCase, countryName, COUNTRIES } from '@/lib/utils';
import { saveCustomer } from '../actions';

export default async function Customer({ params }: PageProps<'/admin/customers/[id]'>) {
  const staff = await requireStaffPage('customers.view');
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: c } = await db.from('customers').select('*').eq('id', id).maybeSingle();
  if (!c) notFound();
  const [{ data: orders }, { data: stats }, addresses, wishlist, profile] = await Promise.all([
    db.from('orders').select('id, order_number, placed_at, status, total').or(`customer_id.eq.${id}${c.user_id ? `,user_id.eq.${c.user_id}` : ''}`).order('placed_at', { ascending: false }),
    db.from('customer_stats').select('*').eq('customer_id', id).maybeSingle(),
    c.user_id ? db.from('addresses').select('*').eq('user_id', c.user_id) : Promise.resolve({ data: [] as any[] }),
    c.user_id ? db.from('wishlist_items').select('created_at, products(name, slug)').eq('user_id', c.user_id) : Promise.resolve({ data: [] as any[] }),
    c.user_id ? db.from('profiles').select('birthday, marketing_email, marketing_sms, created_at').eq('id', c.user_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const s: any = stats ?? {};
  return (
    <>
      <PageHeader back={{ href: '/admin/customers', label: 'Customers' }} title={c.full_name || c.email} description={<>{c.email}{c.phone && ` · ${c.phone}`} · {c.user_id ? 'Registered account' : 'Guest'} · since {formatDate(c.created_at)}</>}
        actions={<><a href={`mailto:${c.email}`} className="btn btn-outline btn-sm">Email</a>{c.phone && <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">WhatsApp</a>}</>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Orders" value={s.orders_count ?? 0} /><StatCard label="Total spent" value={formatMoney(s.total_spent)} />
        <StatCard label="Average order" value={formatMoney(s.orders_count ? s.total_spent / s.orders_count : 0)} /><StatCard label="Last order" value={s.last_order_at ? formatDate(s.last_order_at) : '—'} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Orders" padded={false}>
            <Table head={['Order', 'Date', 'Status', 'Total']} className="border-0" empty="No orders yet.">
              {(orders ?? []).map((o) => <tr key={o.id}><Td><Link href={`/admin/orders/${o.id}`} className="underline">{o.order_number}</Link></Td><Td>{formatDateTime(o.placed_at)}</Td><Td><Badge tone={ORDER_TONE[o.status]}>{titleCase(o.status)}</Badge></Td><Td>{formatMoney(o.total)}</Td></tr>)}
            </Table>
          </Card>
          {(addresses.data ?? []).length > 0 && <Card title="Saved addresses"><ul className="grid gap-3 text-[13px] md:grid-cols-2">{(addresses.data ?? []).map((a: any) => <li key={a.id} className="bg-bg p-3">{a.first_name} {a.last_name}<br />{a.line1}<br />{a.city}{a.state && `, ${a.state}`}<br />{countryName(a.country)}{a.is_default_shipping && <Badge tone="green">Default</Badge>}</li>)}</ul></Card>}
          {(wishlist.data ?? []).length > 0 && <Card title="Wishlist"><ul className="space-y-1 text-[13px]">{(wishlist.data ?? []).map((w: any, i: number) => <li key={i}><Link href={`/products/${w.products?.slug}`} target="_blank" className="underline">{w.products?.name}</Link> <span className="text-muted">· saved {formatDate(w.created_at)}</span></li>)}</ul></Card>}
        </div>
        <Card title="Profile">
          {staff.permissions.has('customers.edit') ? (
            <ActionForm action={saveCustomer} className="grid gap-4">
              <input type="hidden" name="id" value={c.id} />
              <Field label="Name"><input name="full_name" defaultValue={c.full_name ?? ''} className="input" /></Field>
              <Field label="Phone"><input name="phone" defaultValue={c.phone ?? ''} className="input" /></Field>
              <Field label="Country"><select name="country" defaultValue={c.country ?? ''} className="input"><option value="">—</option>{COUNTRIES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></Field>
              <Field label="Tags"><TagsInput name="tags" defaultValue={c.tags ?? []} /></Field>
              <Field label="Internal notes"><textarea name="notes" defaultValue={c.notes ?? ''} className="input !min-h-[90px]" /></Field>
              <Toggle name="accepts_marketing" defaultChecked={c.accepts_marketing} label="Accepts marketing" />
              {profile.data?.birthday && <p className="text-[13px] text-muted">Birthday: {formatDate(profile.data.birthday, { day: 'numeric', month: 'long' })}</p>}
              <Submit>Save customer</Submit>
            </ActionForm>
          ) : <p className="text-[13px]">{c.notes || 'No notes.'}</p>}
        </Card>
      </div>
    </>
  );
}
