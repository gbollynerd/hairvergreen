import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { serverEnv, env } from '@/lib/env';
import { sendEmail, simpleEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Scheduled housekeeping (see vercel.json). Protected by CRON_SECRET.
//  • releases stock held by unpaid orders past their hold window
//  • emails back-in-stock subscribers when a variant is available again
export async function GET(req: NextRequest) {
  const secret = serverEnv().cronSecret;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = supabaseAdmin();
  const { data: released } = await db.rpc('release_expired_reservations');

  const { data: reqs } = await db.from('back_in_stock_requests').select('id, email, product_id, variant_id, products:product_id (name, slug, status)').is('notified_at', null).limit(300);
  let notified = 0;
  for (const r of (reqs ?? []) as any[]) {
    if (r.products?.status !== 'active') continue;
    let q = db.from('product_variants').select('id, stock_on_hand, stock_reserved, track_inventory, allow_backorder').eq('product_id', r.product_id).eq('is_active', true);
    if (r.variant_id) q = q.eq('id', r.variant_id);
    const { data: vs } = await q;
    const back = (vs ?? []).some((v: any) => !v.track_inventory || v.allow_backorder || v.stock_on_hand - v.stock_reserved > 0);
    if (!back) continue;
    await sendEmail({ to: r.email, ...simpleEmail(`${r.products.name} is back`, 'It’s back in stock.', [`${r.products.name} is available again — pieces like this tend to go quickly.`], { href: `${env.siteUrl}/products/${r.products.slug}`, label: 'Shop now' }) });
    await db.from('back_in_stock_requests').update({ notified_at: new Date().toISOString() }).eq('id', r.id);
    notified++;
  }
  return NextResponse.json({ ok: true, released, notified });
}
