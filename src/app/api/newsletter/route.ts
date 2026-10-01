import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

const Body = z.object({ email: z.email().max(200), source: z.string().max(40).optional(), website: z.string().max(0).optional() });

export async function POST(req: NextRequest) {
  const rl = await rateLimit('newsletter', 8);
  if (!rl.ok) return NextResponse.json({ error: 'Please try again shortly.' }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  const db = supabaseAdmin();
  const email = p.data.email.toLowerCase();
  await db.from('newsletter_subscribers').upsert({ email, source: p.data.source ?? 'footer', unsubscribed_at: null }, { onConflict: 'email' });
  await db.from('customers').update({ accepts_marketing: true }).eq('email', email);
  return NextResponse.json({ ok: true });
}
