'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

// All account mutations run with the user's own session so row-level security applies.
const AddressSchema = z.object({
  id: z.string().optional(), label: z.string().max(40).optional(), first_name: z.string().trim().min(1).max(80), last_name: z.string().trim().min(1).max(80),
  phone: z.string().max(40).optional(), line1: z.string().trim().min(3).max(200), line2: z.string().max(200).optional(), city: z.string().trim().min(1).max(100),
  state: z.string().max(100).optional(), postal_code: z.string().max(20).optional(), country: z.string().regex(/^[A-Z]{2}$/),
  is_default_shipping: z.boolean().optional(), is_default_billing: z.boolean().optional(),
});

export async function saveAddress(_: unknown, fd: FormData) {
  const user = await getUser(); if (!user) return { error: 'Please sign in' };
  const raw = Object.fromEntries(fd) as Record<string, string>;
  const p = AddressSchema.safeParse({ ...raw, is_default_shipping: raw.is_default_shipping === 'on', is_default_billing: raw.is_default_billing === 'on' });
  if (!p.success) return { error: 'Please complete the required fields.' };
  const sb = await createSupabaseServer();
  const { id, ...data } = p.data;
  if (data.is_default_shipping) await sb.from('addresses').update({ is_default_shipping: false }).eq('user_id', user.id);
  if (data.is_default_billing) await sb.from('addresses').update({ is_default_billing: false }).eq('user_id', user.id);
  const row = { ...data, user_id: user.id, label: data.label || null, line2: data.line2 || null, state: data.state || null, postal_code: data.postal_code || null, phone: data.phone || null };
  const { error } = id ? await sb.from('addresses').update(row).eq('id', id) : await sb.from('addresses').insert(row);
  if (error) return { error: 'Could not save the address.' };
  revalidatePath('/account/addresses');
  return { ok: true };
}

export async function deleteAddress(id: string) {
  const sb = await createSupabaseServer();
  await sb.from('addresses').delete().eq('id', id);
  revalidatePath('/account/addresses');
}

export async function setDefaultAddress(id: string) {
  const user = await getUser(); if (!user) return;
  const sb = await createSupabaseServer();
  await sb.from('addresses').update({ is_default_shipping: false }).eq('user_id', user.id);
  await sb.from('addresses').update({ is_default_shipping: true }).eq('id', id);
  revalidatePath('/account/addresses');
}

export async function saveDetails(_: unknown, fd: FormData) {
  const user = await getUser(); if (!user) return { error: 'Please sign in' };
  const full_name = String(fd.get('full_name') || '').trim().slice(0, 120);
  const phone = String(fd.get('phone') || '').trim().slice(0, 40);
  const birthday = String(fd.get('birthday') || '') || null;
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return { error: 'Invalid date' };
  const sb = await createSupabaseServer();
  const { error } = await sb.from('profiles').update({ full_name, phone, birthday }).eq('id', user.id);
  await sb.auth.updateUser({ data: { full_name } });
  if (error) return { error: 'Could not save your details.' };
  revalidatePath('/account', 'layout');
  return { ok: true };
}

export async function savePreferences(_: unknown, fd: FormData) {
  const user = await getUser(); if (!user) return { error: 'Please sign in' };
  const sb = await createSupabaseServer();
  const prefs = {
    marketing_email: fd.get('marketing_email') === 'on', marketing_sms: fd.get('marketing_sms') === 'on',
    notify_order_updates: fd.get('notify_order_updates') === 'on', notify_promotions: fd.get('notify_promotions') === 'on', notify_restock: fd.get('notify_restock') === 'on',
  };
  const { error } = await sb.from('profiles').update(prefs).eq('id', user.id);
  if (error) return { error: 'Could not save your preferences.' };
  // Keep the marketing list in sync with the customer's choice
  const admin = supabaseAdmin();
  await admin.from('customers').update({ accepts_marketing: prefs.marketing_email }).eq('user_id', user.id);
  if (prefs.marketing_email) await admin.from('newsletter_subscribers').upsert({ email: user.email.toLowerCase(), source: 'account', unsubscribed_at: null }, { onConflict: 'email' });
  else await admin.from('newsletter_subscribers').update({ unsubscribed_at: new Date().toISOString() }).eq('email', user.email.toLowerCase());
  revalidatePath('/account/notifications');
  return { ok: true };
}
