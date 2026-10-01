import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { meta } from '@/lib/seo';

export const generateMetadata = () => meta({ title: 'Track your order', path: '/track-order' });

async function lookup(formData: FormData) {
  'use server';
  const rl = await rateLimit('track-order', 10, 10 * 60_000);
  if (!rl.ok) redirect('/track-order?error=rate');
  const number = String(formData.get('order_number') || '').trim().toUpperCase().replace(/^#/, '');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!number || !email) redirect('/track-order?error=missing');
  const { data } = await supabaseAdmin().from('orders').select('order_number, email, access_token').eq('order_number', number).maybeSingle();
  if (!data || data.email.toLowerCase() !== email) redirect('/track-order?error=notfound');
  redirect(`/orders/${data.order_number}?t=${data.access_token}`);
}

export default async function TrackOrder({ searchParams }: PageProps<'/track-order'>) {
  const { error } = await searchParams;
  const msg = { notfound: "We couldn't find an order with those details.", missing: 'Please enter your order number and email.', rate: 'Too many attempts — please try again in a few minutes.' }[String(error)] ?? null;
  return (
    <div className="container-x max-w-lg py-16 md:py-24">
      <p className="eyebrow">Orders</p>
      <h1 className="display-2 mt-3">Track your order</h1>
      <p className="lede mt-4">Enter the order number from your confirmation email.</p>
      <form action={lookup} className="mt-8 grid gap-5">
        <label className="field"><span className="label">Order number</span><input name="order_number" required className="input uppercase" placeholder="HG10001" /></label>
        <label className="field"><span className="label">Email used at checkout</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
        {msg && <p className="text-[13px] text-sale" role="alert">{msg}</p>}
        <button className="btn btn-primary">Find my order</button>
      </form>
    </div>
  );
}
