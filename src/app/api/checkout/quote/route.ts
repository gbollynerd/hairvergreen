import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCart, cartLines } from '@/lib/commerce/cart';
import { buildQuote } from '@/lib/commerce/pricing';
import { getUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const Body = z.object({
  country: z.string().regex(/^[A-Z]{2}$/), state: z.string().max(100).optional().nullable(),
  email: z.string().max(200).optional().nullable(), shipping_method_id: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const cart = await getCart(false);
  const user = await getUser();
  const lines = cart ? await cartLines(cart.id) : [];
  const email = p.data.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.data.email) ? p.data.email : cart?.email ?? user?.email ?? null;
  const quote = await buildQuote(lines, { country: p.data.country, state: p.data.state ?? null, email, userId: user?.id ?? null, codes: cart?.coupon_codes ?? [], shippingMethodId: p.data.shipping_method_id ?? null });
  return NextResponse.json({ ...quote, codes: cart?.coupon_codes ?? [] }, { headers: { 'cache-control': 'no-store' } });
}
