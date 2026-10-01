'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, str, int, bool, refreshStore, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';
import { getProvider } from '@/lib/payments';
import { confirmVerifiedPayment } from '@/lib/commerce/orders';
import { sendEmail, orderShippedEmail, orderStatusEmail, orderConfirmationEmail, refundEmail } from '@/lib/email';
import type { Order, OrderItem } from '@/lib/types';

const FLOW: Record<string, { fulfillment: string; stamp?: string; message: string; email?: [string, string] }> = {
  processing: { fulfillment: 'processing', message: 'Order is being prepared' },
  ready_for_shipment: { fulfillment: 'ready', message: 'Order is packed and ready to ship' },
  shipped: { fulfillment: 'shipped', stamp: 'shipped_at', message: 'Order shipped' },
  delivered: { fulfillment: 'delivered', stamp: 'delivered_at', message: 'Order delivered', email: ['Delivered', 'Your Hairver Green order has been delivered. We hope you love it — we’d be grateful for a review.'] },
};

async function loadOrder(id: string) {
  const { data } = await supabaseAdmin().from('orders').select('*').eq('id', id).single();
  if (!data) throw new Error('Order not found');
  return data as Order & { access_token: string };
}

export async function updateOrderStatus(orderId: string, status: string, notify = true): Promise<ActionResult> {
  return guarded('orders.edit', async (staff) => {
    const f = FLOW[status]; if (!f) return { error: 'Invalid status' };
    const o = await loadOrder(orderId);
    if (!o.paid_at) return { error: 'This order has not been paid yet.' };
    if (o.requires_review && o.review_status === 'pending' && status !== 'processing') return { error: 'Approve the customization review first.' };
    const db = supabaseAdmin();
    await db.from('orders').update({ status, fulfillment_status: f.fulfillment, ...(f.stamp ? { [f.stamp]: new Date().toISOString() } : {}) }).eq('id', orderId);
    await db.from('order_events').insert({ order_id: orderId, type: 'status_changed', message: f.message, is_internal: false, actor_id: staff.id, actor_name: staff.email });
    if (notify) {
      if (status === 'shipped') await sendEmail({ to: o.email, ...orderShippedEmail({ ...o, status }) });
      else if (f.email) await sendEmail({ to: o.email, ...orderStatusEmail(o, f.email[0], f.email[1]) });
    }
    await audit(staff, { action: 'update', entityType: 'order', entityId: orderId, summary: `${o.order_number}: ${o.status} → ${status}`, before: { status: o.status }, after: { status } });
    return { ok: true, message: `Marked ${status.replace(/_/g, ' ')}` };
  });
}

export async function saveTracking(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('orders.edit', async (staff) => {
    const id = str(fd, 'order_id'); const o = await loadOrder(id);
    const patch = { carrier: str(fd, 'carrier') || null, tracking_number: str(fd, 'tracking_number') || null, tracking_url: str(fd, 'tracking_url') || null };
    if (patch.tracking_url && !/^https?:\/\//.test(patch.tracking_url)) return { error: 'Tracking URL must start with https://' };
    const db = supabaseAdmin();
    const markShipped = bool(fd, 'mark_shipped') && o.paid_at && !['shipped', 'delivered'].includes(o.status);
    await db.from('orders').update({ ...patch, ...(markShipped ? { status: 'shipped', fulfillment_status: 'shipped', shipped_at: new Date().toISOString() } : {}) }).eq('id', id);
    await db.from('order_events').insert({ order_id: id, type: 'tracking', message: `Tracking added: ${patch.carrier ?? ''} ${patch.tracking_number ?? ''}`.trim(), is_internal: false, actor_id: staff.id, actor_name: staff.email });
    if (bool(fd, 'notify') && (markShipped || o.status === 'shipped')) await sendEmail({ to: o.email, ...orderShippedEmail({ ...o, ...patch }) });
    await audit(staff, { action: 'update', entityType: 'order', entityId: id, summary: `${o.order_number}: tracking updated`, before: { carrier: o.carrier, tracking_number: o.tracking_number }, after: patch });
    return { ok: true, message: markShipped ? 'Tracking saved and order marked shipped' : 'Tracking saved' };
  });
}

export async function addOrderNote(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('orders.edit', async (staff) => {
    const id = str(fd, 'order_id'); const msg = str(fd, 'message').slice(0, 2000);
    if (!msg) return { error: 'Write a note first' };
    const visible = bool(fd, 'visible');
    await supabaseAdmin().from('order_events').insert({ order_id: id, type: visible ? 'customer_note' : 'note', message: msg, is_internal: !visible, actor_id: staff.id, actor_name: staff.email });
    if (visible && bool(fd, 'email')) { const o = await loadOrder(id); await sendEmail({ to: o.email, ...orderStatusEmail(o, 'An update on your order', msg) }); }
    return { ok: true, message: 'Note added' };
  });
}

export async function reviewCustomization(orderId: string, decision: 'approved' | 'changes_requested'): Promise<ActionResult> {
  return guarded('orders.edit', async (staff) => {
    const o = await loadOrder(orderId);
    const db = supabaseAdmin();
    await db.from('orders').update({ review_status: decision, ...(decision === 'approved' && o.status === 'paid' ? { status: 'processing', fulfillment_status: 'processing' } : {}) }).eq('id', orderId);
    await db.from('order_events').insert({ order_id: orderId, type: 'review', message: decision === 'approved' ? 'Customization approved — production has started' : 'We need to confirm some details of your custom piece', is_internal: false, actor_id: staff.id, actor_name: staff.email });
    if (decision === 'approved') await sendEmail({ to: o.email, ...orderStatusEmail(o, 'Your custom piece is in production', 'Our team has confirmed your configuration and production has begun. We’ll update you when it ships.') });
    await audit(staff, { action: 'update', entityType: 'order', entityId: orderId, summary: `${o.order_number}: customization ${decision}` });
    return { ok: true, message: decision === 'approved' ? 'Approved — moved to processing' : 'Marked as needing changes' };
  });
}

export async function resendConfirmation(orderId: string): Promise<ActionResult> {
  return guarded('orders.edit', async (staff) => {
    const o = await loadOrder(orderId);
    const { data: items } = await supabaseAdmin().from('order_items').select('*').eq('order_id', orderId);
    await sendEmail({ to: o.email, ...orderConfirmationEmail(o, (items ?? []) as OrderItem[]) });
    await supabaseAdmin().from('order_events').insert({ order_id: orderId, type: 'email_sent', message: 'Order confirmation re-sent', actor_id: staff.id, actor_name: staff.email });
    return { ok: true, message: 'Confirmation email sent' };
  });
}

export async function cancelOrderAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('orders.cancel', async (staff) => {
    const id = str(fd, 'order_id'); const o = await loadOrder(id);
    const { data, error } = await supabaseAdmin().rpc('cancel_order', { p_order: id, p_restock: bool(fd, 'restock'), p_actor: staff.id, p_actor_name: staff.email, p_reason: str(fd, 'reason') || null });
    if (error) throw error;
    if (bool(fd, 'notify')) await sendEmail({ to: o.email, ...orderStatusEmail(o, 'Your order has been cancelled', o.paid_at ? 'Your order has been cancelled. Any refund due will be issued to your original payment method.' : 'Your order has been cancelled.') });
    await audit(staff, { action: 'cancel', entityType: 'order', entityId: id, summary: `${o.order_number} cancelled (${data})` });
    refreshStore('catalog');
    return { ok: true, message: o.paid_at ? 'Order cancelled — remember to issue a refund' : 'Order cancelled' };
  });
}

export async function refundOrderAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('orders.refund', async (staff) => {
    const id = str(fd, 'order_id'); const o = await loadOrder(id);
    const amount = int(fd, 'amount');
    const method = str(fd, 'method') as 'original_payment' | 'manual' | 'store_credit';
    if (!o.paid_at) return { error: 'This order has no payment to refund.' };
    const remaining = o.total - o.refunded_total;
    if (amount <= 0 || amount > remaining) return { error: `Refund must be between ₦1 and ${(remaining / 100).toLocaleString('en-NG')}` };
    const db = supabaseAdmin();
    const restockItems = (() => { try { return JSON.parse(str(fd, 'restock_items') || '[]') as { order_item_id: string; quantity: number }[]; } catch { return []; } })().filter((r) => r.quantity > 0);
    let status: 'pending' | 'processing' | 'processed' | 'failed' = 'processed';
    let providerRefundId: string | null = null; let raw: unknown = null;
    const { data: pay } = await db.from('payments').select('id, reference, provider').eq('order_id', id).eq('status', 'success').order('paid_at', { ascending: false }).limit(1).maybeSingle();
    if (method === 'original_payment') {
      if (!pay || pay.provider === 'manual') return { error: 'No online payment found — use “Manual refund” and pay the customer directly.' };
      const r = await getProvider(pay.provider).refund({ reference: pay.reference, amount, currency: o.currency, reason: str(fd, 'reason') });
      status = r.status; providerRefundId = r.providerRefundId; raw = r.raw;
      if (status === 'failed') return { error: 'The payment provider rejected the refund.' };
    }
    const { data: refund, error } = await db.from('refunds').insert({
      order_id: id, return_id: str(fd, 'return_id') || null, payment_id: pay?.id ?? null, provider: method === 'original_payment' ? pay?.provider : null,
      provider_refund_id: providerRefundId, amount, currency: o.currency, reason: str(fd, 'reason') || null, method, status,
      restock: restockItems.length > 0, raw: raw as object, created_by: staff.id, processed_at: status === 'processed' ? new Date().toISOString() : null,
    }).select('id').single();
    if (error) throw error;
    if (restockItems.length) { await db.rpc('restock_order_items', { p_order: id, p_items: restockItems, p_actor: staff.id }); refreshStore('catalog'); }
    await db.rpc('apply_refund_totals', { p_order: id });
    await db.from('order_events').insert({ order_id: id, type: 'refund', message: `Refund of ₦${(amount / 100).toLocaleString('en-NG')} ${status === 'processed' ? 'issued' : 'initiated'} (${method.replace('_', ' ')})`, is_internal: false, actor_id: staff.id, actor_name: staff.email, data: { refund_id: refund.id } });
    if (str(fd, 'return_id')) await db.from('return_requests').update({ status: 'refunded', refund_amount: amount, restocked: restockItems.length > 0 }).eq('id', str(fd, 'return_id'));
    if (bool(fd, 'notify')) await sendEmail({ to: o.email, ...refundEmail(o, amount) });
    await audit(staff, { action: 'refund', entityType: 'order', entityId: id, summary: `${o.order_number}: refund ₦${(amount / 100).toLocaleString('en-NG')} (${method}, ${status})` });
    return { ok: true, message: status === 'processed' ? 'Refund issued' : 'Refund initiated — Paystack will confirm shortly' };
  });
}

export async function verifyPaymentAction(orderId: string): Promise<ActionResult> {
  return guarded('orders.edit', async (staff) => {
    const { data: pays } = await supabaseAdmin().from('payments').select('reference, provider').eq('order_id', orderId).neq('provider', 'manual').order('created_at', { ascending: false });
    if (!pays?.length) return { error: 'No payment attempts recorded for this order.' };
    const results: string[] = [];
    for (const p of pays) {
      try { const tx = await getProvider(p.provider).verify(p.reference); const r = await confirmVerifiedPayment(p.provider, tx); results.push(`${p.reference}: ${r.result}`); }
      catch (e) { results.push(`${p.reference}: ${e instanceof Error ? e.message : 'error'}`); }
    }
    await audit(staff, { action: 'verify_payment', entityType: 'order', entityId: orderId, summary: results.join('; ') });
    refreshStore('catalog');
    return { ok: true, message: results.join(' · ') };
  });
}

export async function recordOfflinePayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded(['orders.refund'], async (staff) => {
    const id = str(fd, 'order_id'); const o = await loadOrder(id);
    const ref = `MANUAL-${o.order_number}-${Date.now().toString(36).toUpperCase()}`;
    const note = str(fd, 'note').slice(0, 300);
    if (!note) return { error: 'Add a note describing how the payment was received.' };
    const r = await confirmVerifiedPayment('manual', { reference: ref, status: 'success', amount: o.total, currency: o.currency, channel: str(fd, 'channel') || 'bank_transfer', fees: 0, paidAt: new Date().toISOString(), providerTransactionId: null, customerEmail: o.email, raw: { note, recorded_by: staff.email }, orderId: id });
    await supabaseAdmin().from('order_events').insert({ order_id: id, type: 'note', message: `Offline payment recorded by ${staff.email}: ${note}`, actor_id: staff.id, actor_name: staff.email });
    await audit(staff, { action: 'record_payment', entityType: 'order', entityId: id, summary: `${o.order_number}: offline payment recorded (${r.result})` });
    refreshStore('catalog');
    return r.result === 'paid' ? { ok: true, message: 'Payment recorded' } : { error: `Could not record payment: ${r.result}` };
  });
}
