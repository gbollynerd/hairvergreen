import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getCart, getCartView, touchCart, COUNTRY_COOKIE, cartLines } from '@/lib/commerce/cart';
import { rateLimit } from '@/lib/rate-limit';
import { isConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

const empty = { lines: [], saved: [], item_count: 0, subtotal: 0, discount_total: 0, shipping_total: 0, tax_total: 0, total: 0, discounts: [], code_errors: [], shipping_options: [], selected_shipping: null, free_shipping: null, codes: [], country: 'NG', cart_id: null };

export async function GET() {
  if (!isConfigured()) return NextResponse.json(empty);
  const view = await getCartView();
  return NextResponse.json(view, { headers: { 'cache-control': 'no-store' } });
}

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add'), product_id: z.uuid(), variant_id: z.uuid(), quantity: z.number().int().min(1).max(20).default(1),
    bundle_selection: z.record(z.string(), z.string()).nullish(), customization: z.record(z.string(), z.unknown()).nullish() }),
  z.object({ action: z.literal('update'), line_id: z.uuid(), quantity: z.number().int().min(0).max(50) }),
  z.object({ action: z.literal('remove'), line_id: z.uuid() }),
  z.object({ action: z.literal('save_for_later'), line_id: z.uuid(), saved: z.boolean() }),
  z.object({ action: z.literal('apply_code'), code: z.string().trim().min(2).max(40) }),
  z.object({ action: z.literal('remove_code'), code: z.string().trim().max(40) }),
  z.object({ action: z.literal('set_country'), country: z.string().regex(/^[A-Z]{2}$/) }),
  z.object({ action: z.literal('set_email'), email: z.email().max(200) }),
]);

export async function POST(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: 'Store is not configured' }, { status: 503 });
  const rl = await rateLimit('cart', 90);
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests — please slow down.' }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const b = parsed.data;
  const db = supabaseAdmin();
  const cart = await getCart(true);
  if (!cart) return NextResponse.json({ error: 'Could not create a bag' }, { status: 500 });
  let message: string | null = null;

  switch (b.action) {
    case 'add': {
      const { data: v } = await db.from('product_variants').select('id, product_id, is_active, products!inner(status, product_type)')
        .eq('id', b.variant_id).maybeSingle();
      const prod: any = v?.products;
      if (!v || v.product_id !== b.product_id || !v.is_active || prod?.status !== 'active')
        return NextResponse.json({ error: 'This item is not available' }, { status: 400 });
      const lines = await cartLines(cart.id);
      const same = lines.find((l) => l.variant_id === b.variant_id && !l.saved_for_later && !l.customization && !b.customization
        && JSON.stringify(l.bundle_selection ?? null) === JSON.stringify(b.bundle_selection ?? null));
      if (same) await db.from('cart_items').update({ quantity: Math.min(50, same.quantity + b.quantity) }).eq('id', same.id);
      else await db.from('cart_items').insert({ cart_id: cart.id, product_id: b.product_id, variant_id: b.variant_id, quantity: b.quantity,
        bundle_selection: b.bundle_selection ?? null, customization: b.customization ?? null });
      message = 'Added to your bag';
      break;
    }
    case 'update':
      if (b.quantity === 0) await db.from('cart_items').delete().eq('id', b.line_id).eq('cart_id', cart.id);
      else await db.from('cart_items').update({ quantity: b.quantity }).eq('id', b.line_id).eq('cart_id', cart.id);
      break;
    case 'remove':
      await db.from('cart_items').delete().eq('id', b.line_id).eq('cart_id', cart.id);
      break;
    case 'save_for_later':
      await db.from('cart_items').update({ saved_for_later: b.saved }).eq('id', b.line_id).eq('cart_id', cart.id);
      break;
    case 'apply_code': {
      const code = b.code.toUpperCase();
      const codes = [...new Set([...(cart.coupon_codes ?? []), code])].slice(-3);
      await touchCart(cart.id, { coupon_codes: codes });
      const view = await getCartView();
      const err = view.code_errors.find((e) => e.code === code);
      if (err) {
        await touchCart(cart.id, { coupon_codes: codes.filter((c) => c !== code) });
        return NextResponse.json({ ...(await getCartView()), error: err.message });
      }
      return NextResponse.json({ ...view, message: 'Code applied' });
    }
    case 'remove_code':
      await touchCart(cart.id, { coupon_codes: (cart.coupon_codes ?? []).filter((c) => c !== b.code.toUpperCase()) });
      break;
    case 'set_country':
      await touchCart(cart.id, { country: b.country });
      (await cookies()).set(COUNTRY_COOKIE, b.country, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
      break;
    case 'set_email':
      await touchCart(cart.id, { email: b.email });
      break;
  }
  if (b.action !== 'set_country' && b.action !== 'remove_code') await touchCart(cart.id);
  const view = await getCartView();
  return NextResponse.json({ ...view, message });
}
