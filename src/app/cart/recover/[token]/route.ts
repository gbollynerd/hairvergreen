import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { CART_COOKIE } from '@/lib/commerce/cart';
import { isUuid } from '@/lib/utils';

// Restores a saved cart from a recovery email link, then sends the shopper to checkout.
export async function GET(req: NextRequest, ctx: RouteContext<'/cart/recover/[token]'>) {
  const { token } = await ctx.params;
  const home = new URL('/', req.url);
  if (!isUuid(token)) return NextResponse.redirect(home);
  const db = supabaseAdmin();
  const { data: cart } = await db.from('carts').select('id, status, user_id').eq('recovery_token', token).maybeSingle();
  if (!cart || !['active', 'abandoned'].includes(cart.status)) return NextResponse.redirect(home);
  await db.from('carts').update({ status: 'active', recovered_at: new Date().toISOString(), last_activity_at: new Date().toISOString() }).eq('id', cart.id);
  const res = NextResponse.redirect(new URL('/checkout?recovered=1', req.url));
  // Carts that belong to an account are only restored for that account (getCart enforces ownership).
  res.cookies.set(CART_COOKIE, cart.id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 60 });
  return res;
}
