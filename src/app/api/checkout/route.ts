import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getCart, cartLines, touchCart } from '@/lib/commerce/cart';
import { buildQuote } from '@/lib/commerce/pricing';
import { newPaymentReference, confirmVerifiedPayment } from '@/lib/commerce/orders';
import { getProvider } from '@/lib/payments';
import { getUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/data/content';
import { isUuid } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const Addr = z.object({
  first_name: z.string().trim().min(1).max(80), last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().default(''), line1: z.string().trim().min(3).max(200), line2: z.string().trim().max(200).optional().default(''),
  city: z.string().trim().min(1).max(100), state: z.string().trim().max(100).optional().default(''), postal_code: z.string().trim().max(20).optional().default(''),
  country: z.string().regex(/^[A-Z]{2}$/),
});

const Body = z.object({
  email: z.email().max(200), phone: z.string().trim().max(40).optional().default(''),
  shipping: Addr, billing_same: z.boolean().default(true), billing: Addr.optional(),
  shipping_method_id: z.uuid(), note: z.string().max(1000).optional().default(''),
  marketing: z.boolean().optional().default(false), save_address: z.boolean().optional().default(false),
  display_currency: z.string().max(3).optional(), utm: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimit('checkout', 12);
  if (!rl.ok) return NextResponse.json({ error: 'Too many attempts — please wait a moment and try again.' }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Please check your details and try again.', issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  const settings = await getSettings();
  if (settings.checkout.require_phone && !(b.phone || b.shipping.phone)) return NextResponse.json({ error: 'Please add a phone number for delivery.' }, { status: 400 });

  const user = await getUser();
  if (!settings.checkout.guest_checkout && !user) return NextResponse.json({ error: 'Please sign in to check out.' }, { status: 401 });
  const cart = await getCart(false);
  if (!cart) return NextResponse.json({ error: 'Your bag is empty.' }, { status: 400 });
  const lines = await cartLines(cart.id);
  if (!lines.filter((l) => !l.saved_for_later).length) return NextResponse.json({ error: 'Your bag is empty.' }, { status: 400 });

  const quote = await buildQuote(lines, {
    country: b.shipping.country, state: b.shipping.state || null, email: b.email, userId: user?.id ?? null,
    codes: cart.coupon_codes ?? [], shippingMethodId: b.shipping_method_id,
  });
  if (quote.has_errors) return NextResponse.json({ error: 'Some items in your bag need attention.', quote }, { status: 409 });
  if (quote.code_errors.length) {
    await touchCart(cart.id, { coupon_codes: (cart.coupon_codes ?? []).filter((c) => !quote.code_errors.some((e) => e.code === c)) });
    return NextResponse.json({ error: quote.code_errors[0].message, quote }, { status: 409 });
  }
  if (!quote.selected_shipping || quote.selected_shipping.id !== b.shipping_method_id)
    return NextResponse.json({ error: 'Please choose a delivery option for your address.', quote }, { status: 409 });

  const db = supabaseAdmin();
  const customerName = `${b.shipping.first_name} ${b.shipping.last_name}`.trim();
  const shippingAddress = { ...b.shipping, phone: b.shipping.phone || b.phone };
  const payload = {
    user_id: user?.id ?? null, email: b.email.toLowerCase(), phone: b.phone || b.shipping.phone, customer_name: customerName,
    currency: 'NGN', subtotal: quote.subtotal, discount_total: quote.discount_total, shipping_total: quote.shipping_total,
    tax_total: quote.tax_total, total: quote.total, cost_total: quote.cost_total,
    display_currency: b.display_currency ?? null, fx_rate: null,
    discount_codes: quote.discounts.filter((d) => d.code).map((d) => d.code), discount_ids: quote.discounts.map((d) => d.id).filter(isUuid),
    discount_breakdown: quote.discounts.map((d) => ({ label: d.label, amount: d.amount, code: d.code, free_shipping: !!d.free_shipping })),
    shipping_method: quote.selected_shipping, shipping_address: shippingAddress,
    billing_address: b.billing_same ? shippingAddress : b.billing, shipping_country: b.shipping.country,
    customer_note: b.note || null, requires_review: quote.requires_review, cart_id: cart.id,
    hold_minutes: settings.checkout.hold_minutes ?? 60, utm: b.utm ?? null,
    items: quote.lines.map((l) => ({
      product_id: l.product_id, variant_id: l.variant_id, product_name: l.name, variant_title: l.variant_title, sku: l.sku,
      image_url: l.image, options: l.options, unit_price: l.unit_price, compare_at_price: l.compare_at_price, quantity: l.quantity,
      line_discount: l.line_discount, line_total: l.line_total, unit_cost: l.unit_cost, bundle_components: l.bundle_components,
      customization: l.customization, stock_allocations: l.stock_allocations,
    })),
  };

  const { data: placed, error } = await db.rpc('place_order', { p: payload });
  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('INSUFFICIENT_STOCK') || msg.includes('VARIANT_UNAVAILABLE'))
      return NextResponse.json({ error: 'Sorry — part of your order just sold out. Please review your bag.' }, { status: 409 });
    console.error('[checkout] place_order', error);
    return NextResponse.json({ error: 'We could not place your order. Please try again.' }, { status: 500 });
  }
  const { id: orderId, order_number: orderNumber } = placed as { id: string; order_number: string };

  // Side effects that must not block checkout
  await Promise.allSettled([
    touchCart(cart.id, { email: b.email.toLowerCase(), phone: b.phone || b.shipping.phone }),
    b.marketing ? db.from('newsletter_subscribers').upsert({ email: b.email.toLowerCase(), source: 'checkout' }, { onConflict: 'email', ignoreDuplicates: true }) : null,
    b.marketing ? db.from('customers').update({ accepts_marketing: true }).eq('email', b.email.toLowerCase()) : null,
    user && b.save_address ? db.from('addresses').insert({ user_id: user.id, ...shippingAddress, line2: shippingAddress.line2 || null }) : null,
    db.from('analytics_events').insert({ session_id: cart.id, user_id: user?.id ?? null, name: 'begin_checkout', value: quote.total }),
  ]);

  const { data: tokenRow } = await db.from('orders').select('access_token').eq('id', orderId).single();
  const orderUrl = `${env.siteUrl}/orders/${orderNumber}?t=${tokenRow?.access_token}&new=1`;

  // Fully discounted orders need no payment
  if (quote.total === 0) {
    await confirmVerifiedPayment('manual', { reference: `FREE-${orderNumber}`, status: 'success', amount: 0, currency: 'NGN', channel: 'discount', fees: 0, paidAt: new Date().toISOString(), providerTransactionId: null, customerEmail: b.email, raw: {}, orderId });
    return NextResponse.json({ redirect: orderUrl, order_number: orderNumber });
  }

  const provider = getProvider('paystack');
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: 'Online payment is not configured yet. Please contact us to complete your order.', order_number: orderNumber }, { status: 503 });
  }
  const reference = newPaymentReference(orderNumber);
  await db.from('payments').insert({ order_id: orderId, provider: provider.id, reference, amount: quote.total, currency: 'NGN', status: 'initialized', customer_email: b.email });
  try {
    const init = await provider.initialize({
      orderId, orderNumber, reference, email: b.email, amount: quote.total, currency: 'NGN', customerName, phone: b.phone,
      callbackUrl: `${env.siteUrl}/checkout/complete?order=${orderNumber}`,
    });
    await db.from('payments').update({ authorization_url: init.authorizationUrl, status: 'pending' }).eq('reference', reference);
    return NextResponse.json({ redirect: init.authorizationUrl, order_number: orderNumber, reference });
  } catch (e) {
    console.error('[checkout] payment init', e);
    await db.rpc('mark_order_payment_failed', { p_order: orderId, p_provider: provider.id, p_reference: reference, p_raw: { error: String(e) } });
    return NextResponse.json({ error: 'We could not start the payment. Please try again in a moment.' }, { status: 502 });
  }
}
