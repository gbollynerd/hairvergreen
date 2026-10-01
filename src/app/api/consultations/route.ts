import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail, simpleEmail, adminAlertEmail } from '@/lib/email';
import { env } from '@/lib/env';

const Body = z.object({
  kind: z.enum(['consultation', 'custom_unit', 'service']).default('consultation'),
  name: z.string().trim().min(1).max(100), email: z.email().max(200), phone: z.string().max(40).optional(),
  contact_method: z.enum(['email', 'phone', 'whatsapp', 'instagram']).optional(), desired_look: z.string().max(2000).optional(),
  texture: z.string().max(40).optional(), length: z.string().max(10).optional(), budget: z.string().max(60).optional(),
  preferred_at: z.string().max(40).optional(), configuration: z.record(z.string(), z.unknown()).optional(),
  reference_media: z.array(z.object({ bucket: z.string(), path: z.string().max(300), name: z.string().max(200).optional() })).max(6).optional(),
  website: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimit('consultations', 4, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'Please wait a little before sending another request.' }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Please complete the required fields.' }, { status: 400 });
  const user = await getUser();
  const { website: _hp, reference_media, preferred_at, ...d } = p.data;
  const pref = preferred_at ? new Date(preferred_at) : null;
  const db = supabaseAdmin();
  const { error } = await db.from('consultations').insert({
    ...d, email: d.email.toLowerCase(), user_id: user?.id ?? null, preferred_at: pref && !isNaN(+pref) ? pref.toISOString() : null,
    reference_media: (reference_media ?? []).filter((m) => m.bucket === 'customer-uploads' && m.path.startsWith('consultations/')),
  });
  if (error) return NextResponse.json({ error: 'Could not submit your request' }, { status: 500 });
  await sendEmail({ to: d.email, ...simpleEmail('We’ve received your consultation request', 'Thank you — we’ll be in touch.', ['A member of the Hairver Green team will contact you shortly to confirm a time.']) });
  const { data: notif } = await db.from('settings').select('value').eq('key', 'notifications').maybeSingle();
  const to = (notif?.value as { order_alert_emails?: string[] } | null)?.order_alert_emails;
  if (to?.length) await sendEmail({ to, ...adminAlertEmail(`New ${d.kind.replace('_', ' ')} request`, [`${d.name} <${d.email}>`, d.desired_look ?? ''], `${env.siteUrl}/admin/consultations`) });
  return NextResponse.json({ ok: true });
}
