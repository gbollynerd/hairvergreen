import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { getUser } from '@/lib/auth';

const Body = z.object({ email: z.email().max(200), product_id: z.uuid(), variant_id: z.uuid().optional() });

export async function POST(req: NextRequest) {
  const rl = await rateLimit('bis', 10);
  if (!rl.ok) return NextResponse.json({ error: 'Please try again shortly.' }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const user = await getUser();
  await supabaseAdmin().from('back_in_stock_requests').upsert(
    { email: p.data.email.toLowerCase(), product_id: p.data.product_id, variant_id: p.data.variant_id ?? null, user_id: user?.id ?? null, notified_at: null },
    { onConflict: 'email,product_id,variant_id' });
  return NextResponse.json({ ok: true });
}
