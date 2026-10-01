import 'server-only';
import crypto from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getProvider } from '@/lib/payments';
import type { VerifiedTransaction } from '@/lib/payments/types';
import { sendEmail, orderConfirmationEmail, adminAlertEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { CATALOG_TAG } from '@/lib/data/catalog';
import type { Order, OrderItem } from '@/lib/types';

export const newPaymentReference = (orderNumber: string) =>
  `${orderNumber}-${crypto.randomBytes(5).toString('hex')}`.toUpperCase();

/**
 * Single entry point for confirming a payment, used by BOTH the redirect/verify flow and the webhook.
 * The transaction must already be verified with the provider server-side. Idempotent.
 */
export async function confirmVerifiedPayment(providerId: string, tx: VerifiedTransaction) {
  const db = supabaseAdmin();
  // Resolve the order from our own payment record first (never trust metadata alone)
  const { data: pay } = await db.from('payments').select('order_id').eq('reference', tx.reference).maybeSingle();
  const orderId = pay?.order_id ?? tx.orderId;
  if (!orderId) return { result: 'unknown_order' as const, orderId: null };

  if (tx.status !== 'success') {
    if (tx.status === 'failed') {
      await db.rpc('mark_order_payment_failed', { p_order: orderId, p_provider: providerId, p_reference: tx.reference, p_raw: tx.raw as object });
    }
    return { result: tx.status, orderId };
  }

  const { data: result, error } = await db.rpc('mark_order_paid', {
    p_order: orderId, p_provider: providerId, p_reference: tx.reference, p_amount: tx.amount, p_currency: tx.currency,
    p_channel: tx.channel, p_fees: tx.fees, p_raw: tx.raw as object, p_provider_txn: tx.providerTransactionId,
  });
  if (error) throw error;

  if (result === 'paid') {
    await afterPaid(orderId).catch((e) => console.error('[orders] afterPaid', e));
  }
  return { result: result as string, orderId };
}

async function afterPaid(orderId: string) {
  const db = supabaseAdmin();
  const { data: order } = await db.from('orders').select('*').eq('id', orderId).single();
  const { data: items } = await db.from('order_items').select('*').eq('order_id', orderId);
  if (!order) return;
  try { revalidateTag(CATALOG_TAG, 'max'); } catch { /* outside request scope */ }

  await db.from('analytics_events').insert({ session_id: order.cart_id ?? order.id, user_id: order.user_id, name: 'purchase', value: order.total, properties: { order_number: order.order_number } });

  const mail = orderConfirmationEmail(order as Order & { access_token: string }, (items ?? []) as OrderItem[]);
  await sendEmail({ to: order.email, ...mail });

  // Staff alerts: new order + low stock
  const { data: notif } = await db.from('settings').select('value').eq('key', 'notifications').maybeSingle();
  const cfg = (notif?.value ?? {}) as { order_alert_emails?: string[]; low_stock_emails?: string[] };
  if (cfg.order_alert_emails?.length) {
    await sendEmail({ to: cfg.order_alert_emails, ...adminAlertEmail(`New order ${order.order_number}`, [
      `${order.customer_name ?? order.email} — ${(order.total / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}`,
      ...(items ?? []).map((i: any) => `${i.quantity} × ${i.product_name} ${i.variant_title ? '(' + i.variant_title + ')' : ''}`),
      order.requires_review ? 'Customization review required' : '',
    ].filter(Boolean), `${env.siteUrl}/admin/orders/${order.id}`) });
  }
  if (cfg.low_stock_emails?.length) {
    const variantIds = (items ?? []).flatMap((i: any) => (i.stock_allocations ?? []).map((a: any) => a.variant_id));
    if (variantIds.length) {
      const { data: low } = await db.from('product_variants').select('title, stock_on_hand, stock_reserved, low_stock_threshold, product:product_id (name)')
        .in('id', variantIds).eq('track_inventory', true);
      const alerts = (low ?? []).filter((v: any) => v.stock_on_hand - v.stock_reserved <= v.low_stock_threshold)
        .map((v: any) => `${v.product?.name} — ${v.title}: ${Math.max(0, v.stock_on_hand - v.stock_reserved)} remaining`);
      if (alerts.length) await sendEmail({ to: cfg.low_stock_emails, ...adminAlertEmail('Low stock alert', alerts, `${env.siteUrl}/admin/inventory?filter=low`) });
    }
  }
}

/** Verify a reference with the provider and confirm it. Used by the checkout return page. */
export async function verifyAndConfirm(reference: string, providerId = 'paystack') {
  const provider = getProvider(providerId);
  const tx = await provider.verify(reference);
  return confirmVerifiedPayment(providerId, tx);
}

export async function getOrderForViewer(orderNumber: string, opts: { token?: string | null; userId?: string | null; email?: string | null }) {
  const db = supabaseAdmin();
  const { data: order } = await db.from('orders').select('*').eq('order_number', orderNumber).maybeSingle();
  if (!order) return null;
  const ok = (opts.token && order.access_token === opts.token) || (opts.userId && order.user_id === opts.userId)
    || (opts.email && order.email?.toLowerCase() === opts.email.toLowerCase());
  if (!ok) return null;
  const [{ data: items }, { data: events }, { data: returns }] = await Promise.all([
    db.from('order_items').select('*').eq('order_id', order.id).order('created_at'),
    db.from('order_events').select('id, type, message, created_at').eq('order_id', order.id).eq('is_internal', false).order('created_at'),
    db.from('return_requests').select('id, rma_number, status, resolution, created_at').eq('order_id', order.id).order('created_at'),
  ]);
  return { order: order as Order & { access_token: string }, items: (items ?? []) as OrderItem[], events: events ?? [], returns: returns ?? [] };
}
