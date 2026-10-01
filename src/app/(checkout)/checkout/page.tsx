import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getCartView } from '@/lib/commerce/cart';
import { getSettings } from '@/lib/data/content';
import { CheckoutClient } from '@/components/checkout/checkout-client';
import type { Address } from '@/lib/types';

export const metadata = { title: 'Checkout', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function Checkout() {
  const [cart, user, settings] = await Promise.all([getCartView(), getUser(), getSettings()]);
  if (!cart.lines.length) redirect('/?bag=empty');
  if (!settings.checkout.guest_checkout && !user) redirect('/login?next=/checkout');
  let addresses: Address[] = [];
  let profile: { full_name: string | null; phone: string | null } | null = null;
  if (user) {
    const sb = await createSupabaseServer();
    const [{ data: a }, { data: p }] = await Promise.all([
      sb.from('addresses').select('*').order('is_default_shipping', { ascending: false }).order('created_at', { ascending: false }),
      sb.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
    ]);
    addresses = (a ?? []) as Address[]; profile = p;
  }
  return (
    <CheckoutClient initialCart={cart} user={user} addresses={addresses} profile={profile}
      requirePhone={settings.checkout.require_phone} termsPage={settings.checkout.terms_page} allowNote={settings.checkout.order_note} />
  );
}
