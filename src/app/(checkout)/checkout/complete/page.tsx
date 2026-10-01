import Link from 'next/link';
import { redirect } from 'next/navigation';
import { verifyAndConfirm } from '@/lib/commerce/orders';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const metadata = { title: 'Confirming payment', robots: { index: false } };
export const dynamic = 'force-dynamic';

// Paystack redirects here with ?reference=… The payment is verified server-side with Paystack
// before the order is marked paid (the webhook does the same independently; both are idempotent).
export default async function Complete({ searchParams }: PageProps<'/checkout/complete'>) {
  const sp = await searchParams;
  const reference = String(sp.reference || sp.trxref || '');
  if (!reference) redirect('/');
  let outcome: string = 'error';
  let orderId: string | null = null;
  try {
    const r = await verifyAndConfirm(reference);
    outcome = r.result; orderId = r.orderId;
  } catch (e) {
    console.error('[checkout/complete]', e);
  }
  if (orderId && (outcome === 'paid' || outcome === 'already_paid' || outcome === 'duplicate_payment')) {
    const { data } = await supabaseAdmin().from('orders').select('order_number, access_token').eq('id', orderId).single();
    if (data) redirect(`/orders/${data.order_number}?t=${data.access_token}&new=1`);
  }
  const pending = outcome === 'pending';
  return (
    <div className="container-x max-w-xl py-24 text-center">
      <h1 className="display-2">{pending ? 'Payment processing' : 'Payment not completed'}</h1>
      <p className="lede mt-4">
        {pending ? 'Your bank is still confirming this payment. We’ll email you as soon as it clears — there’s no need to pay again.'
          : outcome === 'amount_mismatch' ? 'There was a problem matching your payment to your order. Our team has been alerted and will contact you.'
          : 'Your payment was cancelled or declined, and you have not been charged. Your bag is saved — you can try again.'}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/checkout" className="btn btn-primary">Return to checkout</Link>
        <Link href="/contact" className="btn btn-outline">Contact us</Link>
      </div>
      <p className="mt-6 text-[12px] text-muted">Reference: {reference}</p>
    </div>
  );
}
