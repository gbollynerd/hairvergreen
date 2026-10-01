import { notFound } from 'next/navigation';
import { getOrderForViewer } from '@/lib/commerce/orders';
import { getUser, getStaff } from '@/lib/auth';
import { Invoice } from '@/components/account/invoice';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const metadata = { title: 'Invoice', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function InvoicePage({ params, searchParams }: PageProps<'/orders/[number]/invoice'>) {
  const { number } = await params;
  const sp = await searchParams;
  const user = await getUser();
  let data = await getOrderForViewer(number.toUpperCase(), { token: typeof sp.t === 'string' ? sp.t : null, userId: user?.id ?? null });
  if (!data) {
    const staff = await getStaff();
    if (staff?.permissions.has('orders.view')) {
      const { data: o } = await supabaseAdmin().from('orders').select('user_id, access_token').eq('order_number', number.toUpperCase()).maybeSingle();
      if (o) data = await getOrderForViewer(number.toUpperCase(), { token: o.access_token });
    }
  }
  if (!data) notFound();
  const { data: store } = await supabaseAdmin().from('settings').select('value').eq('key', 'store').maybeSingle();
  return <Invoice order={data.order} items={data.items} store={(store?.value ?? {}) as Record<string, string>} packing={sp.packing === '1'} />;
}
