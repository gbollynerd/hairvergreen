import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail, adminAlertEmail } from '@/lib/email';
import { env } from '@/lib/env';

const Body = z.object({
  name: z.string().trim().min(1).max(100), email: z.email().max(200), phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(150).optional(), message: z.string().trim().min(5).max(4000), order_number: z.string().trim().max(30).optional(),
  website: z.string().max(0).optional(), // honeypot
});

export async function POST(req: NextRequest) {
  const rl = await rateLimit('contact', 5, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'Please wait a little before sending another message.' }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Please complete the required fields.' }, { status: 400 });
  const db = supabaseAdmin();
  const { website: _hp, ...data } = p.data;
  await db.from('contact_messages').insert({ ...data, email: data.email.toLowerCase() });
  const { data: store } = await db.from('settings').select('value').eq('key', 'store').maybeSingle();
  const to = (store?.value as { email?: string } | null)?.email;
  if (to) await sendEmail({ to, replyTo: data.email, ...adminAlertEmail(`New message: ${data.subject || 'Contact form'}`, [`From: ${data.name} <${data.email}>`, data.phone ? `Phone: ${data.phone}` : '', data.order_number ? `Order: ${data.order_number}` : '', data.message].filter(Boolean), `${env.siteUrl}/admin/messages`) });
  return NextResponse.json({ ok: true });
}
