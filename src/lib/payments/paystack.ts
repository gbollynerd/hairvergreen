import 'server-only';
import crypto from 'node:crypto';
import { serverEnv } from '@/lib/env';
import type { PaymentProvider, VerifiedTransaction, WebhookEvent } from './types';

const API = 'https://api.paystack.co';

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = serverEnv().paystackSecretKey;
  if (!key) throw new Error('Paystack is not configured (PAYSTACK_SECRET_KEY missing)');
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: unknown };
  if (!res.ok || json.status === false) throw new Error(`Paystack: ${json.message || res.statusText}`);
  return json.data as T;
}

function toVerified(d: any): VerifiedTransaction {
  const status = d.status === 'success' ? 'success' : d.status === 'failed' ? 'failed' : d.status === 'abandoned' ? 'abandoned' : 'pending';
  return {
    reference: d.reference, status, amount: Number(d.amount), currency: String(d.currency || 'NGN').toUpperCase(),
    channel: d.channel ?? null, fees: d.fees != null ? Number(d.fees) : null, paidAt: d.paid_at ?? d.paidAt ?? null,
    providerTransactionId: d.id != null ? String(d.id) : null, customerEmail: d.customer?.email ?? null, raw: d,
    orderId: d.metadata?.order_id ?? null,
  };
}

export const paystack: PaymentProvider = {
  id: 'paystack',
  label: 'Paystack',
  isConfigured: () => Boolean(serverEnv().paystackSecretKey),

  async initialize(i) {
    // Channels are intentionally not restricted: Paystack shows every channel enabled on the account
    // (card, bank, bank transfer, USSD, OPay, PalmPay, etc.).
    const d = await call<{ authorization_url: string; access_code: string; reference: string }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: i.email, amount: i.amount, currency: i.currency, reference: i.reference, callback_url: i.callbackUrl,
        metadata: {
          order_id: i.orderId, order_number: i.orderNumber, ...(i.metadata || {}),
          custom_fields: [
            { display_name: 'Order', variable_name: 'order_number', value: i.orderNumber },
            ...(i.customerName ? [{ display_name: 'Customer', variable_name: 'customer_name', value: i.customerName }] : []),
          ],
        },
      }),
    });
    return { authorizationUrl: d.authorization_url, reference: d.reference, accessCode: d.access_code };
  },

  async verify(reference) {
    const d = await call<any>(`/transaction/verify/${encodeURIComponent(reference)}`);
    return toVerified(d);
  },

  async refund(r) {
    const d = await call<any>('/refund', {
      method: 'POST',
      body: JSON.stringify({ transaction: r.reference, amount: r.amount, currency: r.currency, merchant_note: r.reason?.slice(0, 200) }),
    });
    const status = d.status === 'processed' ? 'processed' : d.status === 'failed' ? 'failed' : d.status === 'processing' ? 'processing' : 'pending';
    return { status, providerRefundId: d.id != null ? String(d.id) : null, raw: d };
  },

  async parseWebhook(rawBody, headers) {
    const key = serverEnv().paystackSecretKey;
    const sig = headers.get('x-paystack-signature') || '';
    if (!key || !sig) return null;
    const expected = crypto.createHmac('sha512', key).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'hex'); const b = Buffer.from(sig, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const evt = JSON.parse(rawBody) as { event: string; data: any };
    const eventKey = crypto.createHash('sha256').update(rawBody).digest('hex');
    switch (evt.event) {
      case 'charge.success':
        return { type: 'charge.success', transaction: toVerified(evt.data), eventKey, raw: evt } satisfies WebhookEvent;
      case 'charge.failed':
        return { type: 'charge.failed', reference: evt.data?.reference, orderId: evt.data?.metadata?.order_id ?? null, eventKey, raw: evt };
      case 'refund.processed':
      case 'refund.failed':
      case 'refund.pending':
        return { type: evt.event, reference: evt.data?.transaction_reference ?? evt.data?.transaction?.reference ?? '',
          providerRefundId: evt.data?.id != null ? String(evt.data.id) : null, amount: Number(evt.data?.amount ?? 0), eventKey, raw: evt };
      default:
        return { type: 'ignored', name: evt.event, eventKey, raw: evt };
    }
  },
};
