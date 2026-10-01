import 'server-only';
import { cookies, headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getUser } from '@/lib/auth';
import { buildQuote, type CartInputLine, type Quote } from '@/lib/commerce/pricing';
import { isUuid } from '@/lib/utils';

export const CART_COOKIE = 'hg_cart';
export const COUNTRY_COOKIE = 'hg_country';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 60 };

export async function readCartId() {
  const v = (await cookies()).get(CART_COOKIE)?.value;
  return isUuid(v) ? v : null;
}

export async function detectCountry() {
  const c = (await cookies()).get(COUNTRY_COOKIE)?.value;
  if (c && /^[A-Z]{2}$/.test(c)) return c;
  const h = await headers();
  const geo = h.get('x-vercel-ip-country');
  return geo && /^[A-Z]{2}$/.test(geo) ? geo : 'NG';
}

type CartRow = { id: string; user_id: string | null; email: string | null; coupon_codes: string[]; country: string | null; status: string };

/** Loads the active cart for this browser/user. Creates one when `create` is true (route handlers / actions only). */
export async function getCart(create = false): Promise<CartRow | null> {
  const db = supabaseAdmin();
  const user = await getUser();
  const cookieId = await readCartId();
  let cart: CartRow | null = null;

  if (cookieId) {
    const { data } = await db.from('carts').select('id, user_id, email, coupon_codes, country, status').eq('id', cookieId).maybeSingle();
    if (data && data.status === 'active' && (!data.user_id || data.user_id === user?.id)) cart = data as CartRow;
  }
  if (user) {
    const { data: userCart } = await db.from('carts').select('id, user_id, email, coupon_codes, country, status')
      .eq('user_id', user.id).eq('status', 'active').order('last_activity_at', { ascending: false }).limit(1).maybeSingle();
    if (cart && !cart.user_id) {
      if (userCart && userCart.id !== cart.id) {
        await mergeCarts(cart.id, userCart.id);
        cart = userCart as CartRow;
      } else {
        await db.from('carts').update({ user_id: user.id, email: cart.email ?? user.email }).eq('id', cart.id);
        cart = { ...cart, user_id: user.id };
      }
    } else if (!cart && userCart) cart = userCart as CartRow;
  }
  if (!cart && create) {
    const { data } = await db.from('carts').insert({ user_id: user?.id ?? null, email: user?.email ?? null, country: await detectCountry() })
      .select('id, user_id, email, coupon_codes, country, status').single();
    cart = data as CartRow;
  }
  if (cart && create) {
    try { (await cookies()).set(CART_COOKIE, cart.id, COOKIE_OPTS); } catch { /* read-only context */ }
  }
  return cart;
}

async function mergeCarts(fromId: string, intoId: string) {
  const db = supabaseAdmin();
  const { data: items } = await db.from('cart_items').select('*').eq('cart_id', fromId);
  const { data: existing } = await db.from('cart_items').select('*').eq('cart_id', intoId);
  for (const it of items ?? []) {
    const same = (existing ?? []).find((e: any) => e.variant_id === it.variant_id && JSON.stringify(e.bundle_selection) === JSON.stringify(it.bundle_selection) && !e.customization && !it.customization);
    if (same) await db.from('cart_items').update({ quantity: Math.min(50, same.quantity + it.quantity) }).eq('id', same.id);
    else await db.from('cart_items').insert({ ...it, id: undefined, cart_id: intoId });
  }
  await db.from('carts').update({ status: 'merged' }).eq('id', fromId);
}

export async function cartLines(cartId: string): Promise<CartInputLine[]> {
  const { data } = await supabaseAdmin().from('cart_items').select('id, product_id, variant_id, quantity, bundle_selection, customization, saved_for_later')
    .eq('cart_id', cartId).order('created_at');
  return (data ?? []) as CartInputLine[];
}

export async function touchCart(cartId: string, patch: Record<string, unknown> = {}) {
  await supabaseAdmin().from('carts').update({ last_activity_at: new Date().toISOString(), ...patch }).eq('id', cartId);
}

export type CartView = Quote & { cart_id: string | null; codes: string[]; country: string };

export async function getCartView(opts: { create?: boolean; state?: string | null; shippingMethodId?: string | null; email?: string | null } = {}): Promise<CartView> {
  const cart = await getCart(opts.create);
  const user = await getUser();
  const country = cart?.country || (await detectCountry());
  const lines = cart ? await cartLines(cart.id) : [];
  const quote = await buildQuote(lines, {
    country, state: opts.state ?? null, email: opts.email ?? cart?.email ?? user?.email ?? null, userId: user?.id ?? null,
    codes: cart?.coupon_codes ?? [], shippingMethodId: opts.shippingMethodId ?? null,
  });
  return { ...quote, cart_id: cart?.id ?? null, codes: cart?.coupon_codes ?? [], country };
}
