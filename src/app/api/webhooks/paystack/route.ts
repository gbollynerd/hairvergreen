import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getProvider } from '@/lib/payments';
import { confirmVerifiedPayment } from '@/lib/commerce/orders';

export const dynamic = 'force-dynamic';

// Paystack webhook. Signature (HMAC-SHA512 with the secret key) is verified before anything else.
// Each event is stored once (unique provider+event hash) so retries are idempotent.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const provider = getProvider('paystack');
  const evt = await provider.parseWebhook(raw, req.headers);
  if (!evt) return NextResponse.json({ error: 'invalid signature' }, { status: 401 });

  const db = supabaseAdmin();
  const name = evt.type === 'ignored' ? evt.name : evt.type;
  const { data: inserted } = await db.from('webhook_events')
    .upsert({ provider: provider.id, event_key: evt.eventKey, event_type: name, payload: evt.raw as object }, { onConflict: 'provider,event_key', ignoreDuplicates: true })
    .select('id').maybeSingle();
  if (!inserted) {
    const { data: prior } = await db.from('webhook_events').select('status').eq('provider', provider.id).eq('event_key', evt.eventKey).maybeSingle();
    if (prior?.status === 'processed' || prior?.status === 'ignored') return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    let status: 'processed' | 'ignored' = 'processed';
    if (evt.type === 'charge.success') {
      // Re-verify with the API so amount/currency/status come from Paystack directly.
      const tx = await provider.verify(evt.transaction.reference);
      await confirmVerifiedPayment(provider.id, tx);
    } else if (evt.type === 'charge.failed') {
      const tx = await provider.verify(evt.reference).catch(() => null);
      if (tx) await confirmVerifiedPayment(provider.id, tx);
    } else if (evt.type.startsWith('refund.')) {
      const e = evt as Extract<typeof evt, { providerRefundId: string | null }>;
      const newStatus = e.type === 'refund.processed' ? 'processed' : e.type === 'refund.failed' ? 'failed' : 'processing';
      const { data: pay } = await db.from('payments').select('order_id').eq('reference', e.reference).maybeSingle();
      let q = db.from('refunds').update({ status: newStatus, processed_at: newStatus === 'processed' ? new Date().toISOString() : null });
      q = e.providerRefundId ? q.eq('provider_refund_id', e.providerRefundId) : q.eq('order_id', pay?.order_id ?? '00000000-0000-0000-0000-000000000000').neq('status', 'processed');
      await q;
      if (pay?.order_id) {
        await db.rpc('apply_refund_totals', { p_order: pay.order_id });
        await db.from('order_events').insert({ order_id: pay.order_id, type: 'refund', message: `Paystack refund ${newStatus}`, is_internal: true });
      }
    } else {
      status = 'ignored';
    }
    await db.from('webhook_events').update({ status, processed_at: new Date().toISOString() }).eq('provider', provider.id).eq('event_key', evt.eventKey);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[webhook] paystack', e);
    await db.from('webhook_events').update({ status: 'failed', error: String(e) }).eq('provider', provider.id).eq('event_key', evt.eventKey);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
