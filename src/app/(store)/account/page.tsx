import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireUserPage } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { STATUS_LABEL } from '@/components/account/order-detail';

export default async function AccountHome() {
  const user = await requireUserPage();
  const sb = await createSupabaseServer();
  const [{ data: orders }, { count: wl }, { count: addr }, { data: profile }] = await Promise.all([
    sb.from('orders').select('order_number, status, total, placed_at').order('placed_at', { ascending: false }).limit(3),
    sb.from('wishlist_items').select('id', { count: 'exact', head: true }),
    sb.from('addresses').select('id', { count: 'exact', head: true }),
    sb.from('profiles').select('full_name, phone, marketing_email').eq('id', user.id).maybeSingle(),
  ]);
  const recent = orders?.[0];
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="border border-line bg-surface p-6 md:col-span-2">
        <div className="flex items-center justify-between"><h2 className="font-display text-[24px]">Recent order</h2><Link href="/account/orders" className="text-[13px] underline">All orders</Link></div>
        {recent ? (
          <Link href={`/account/orders/${recent.order_number}`} className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-panel px-5 py-4 text-[14px]">
            <span className="font-medium">{recent.order_number}</span><span>{formatDate(recent.placed_at)}</span><span>{STATUS_LABEL[recent.status] ?? recent.status}</span><span className="tabular-nums">{formatMoney(recent.total)}</span>
          </Link>
        ) : <p className="mt-3 text-muted">No orders yet. <Link href="/shop" className="underline">Start shopping</Link></p>}
      </section>
      <Card title="Wishlist" href="/account/wishlist" value={`${wl ?? 0} saved piece${wl === 1 ? '' : 's'}`} />
      <Card title="Addresses" href="/account/addresses" value={`${addr ?? 0} saved address${addr === 1 ? '' : 'es'}`} />
      <Card title="Account details" href="/account/details" value={<>{profile?.full_name || '—'}<br />{user.email}{profile?.phone && <><br />{profile.phone}</>}</>} />
      <Card title="Notifications" href="/account/notifications" value={profile?.marketing_email ? 'Subscribed to news & offers' : 'Order updates only'} />
    </div>
  );
}

function Card({ title, href, value }: { title: string; href: string; value: React.ReactNode }) {
  return (
    <Link href={href} className="group border border-line bg-surface p-6 transition-colors hover:border-primary">
      <h2 className="font-display text-[22px]">{title}</h2><p className="mt-2 text-[14px] text-muted">{value}</p>
      <p className="mt-4 caps text-[11px] group-hover:underline">Manage</p>
    </Link>
  );
}
