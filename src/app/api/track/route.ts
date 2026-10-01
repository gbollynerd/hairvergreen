import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { isUuid } from '@/lib/utils';

const ALLOWED = new Set(['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'add_to_wishlist', 'search', 'select_variant', 'apply_coupon', 'newsletter_signup', 'view_cart', 'quick_view']);
const Body = z.object({
  name: z.string().max(40), session_id: z.string().max(64), path: z.string().max(300).optional(), product_id: z.string().optional(),
  value: z.number().optional(), properties: z.record(z.string(), z.unknown()).optional(), referrer: z.string().max(500).nullish(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimit('track', 240);
  if (!rl.ok) return new NextResponse(null, { status: 204 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success || !ALLOWED.has(p.data.name)) return new NextResponse(null, { status: 204 });
  const ua = req.headers.get('user-agent') || '';
  if (/bot|crawl|spider|slurp|preview/i.test(ua)) return new NextResponse(null, { status: 204 });
  const props = JSON.stringify(p.data.properties ?? {}).length < 2000 ? p.data.properties : undefined;
  await supabaseAdmin().from('analytics_events').insert({
    session_id: p.data.session_id, name: p.data.name, path: p.data.path, product_id: isUuid(p.data.product_id) ? p.data.product_id : null,
    value: p.data.value != null ? Math.round(p.data.value) : null, properties: props ?? null, referrer: p.data.referrer ?? null,
    country: req.headers.get('x-vercel-ip-country'), device: /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop',
  });
  return new NextResponse(null, { status: 204 });
}
