import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const Body = z.object({
  product_id: z.uuid(), rating: z.number().int().min(1).max(5), title: z.string().trim().max(120).optional().default(''),
  body: z.string().trim().min(10).max(3000), author_name: z.string().trim().min(1).max(80), author_location: z.string().trim().max(80).optional(),
  media: z.array(z.object({ url: z.url(), kind: z.enum(['image', 'video']) })).max(6).optional().default([]),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimit('reviews', 5, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'Please try again later.' }, { status: 429 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to leave a review.' }, { status: 401 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Please complete the rating and write at least a sentence.' }, { status: 400 });
  const db = supabaseAdmin();
  const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
  const media = p.data.media.filter((m) => new URL(m.url).host === supabaseHost);

  // Verified purchase: a paid order by this customer containing the product
  const base = () => db.from('order_items').select('order_id, orders!inner(user_id, email, payment_status)')
    .eq('product_id', p.data.product_id).in('orders.payment_status', ['paid', 'partially_refunded']).limit(1);
  const [{ data: byUser }, { data: byEmail }] = await Promise.all([base().eq('orders.user_id', user.id), base().eq('orders.email', user.email)]);
  const bought = byUser?.length ? byUser : byEmail;
  if (!bought?.length) return NextResponse.json({ error: 'Reviews are open to customers who have purchased this piece.' }, { status: 403 });
  const { data: existing } = await db.from('reviews').select('id').eq('product_id', p.data.product_id).eq('user_id', user.id).maybeSingle();
  if (existing) return NextResponse.json({ error: 'You have already reviewed this piece — thank you!' }, { status: 409 });

  await db.from('reviews').insert({
    product_id: p.data.product_id, user_id: user.id, order_id: bought[0].order_id, author_name: p.data.author_name,
    author_location: p.data.author_location ?? null, rating: p.data.rating, title: p.data.title || null, body: p.data.body,
    media, is_verified: true, status: 'pending',
  });
  return NextResponse.json({ ok: true });
}
