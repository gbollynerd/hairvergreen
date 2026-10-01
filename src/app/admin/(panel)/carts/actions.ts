'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';
import { sendEmail, simpleEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { isUuid } from '@/lib/utils';

export async function sendRecoveryEmail(cartId: string): Promise<ActionResult> {
  return guarded('carts.view', async (staff) => {
    if (!isUuid(cartId)) return { error: 'Invalid cart' };
    const db = supabaseAdmin();
    const { data: cart } = await db.from('carts').select('id, email, recovery_token, status').eq('id', cartId).single();
    if (!cart?.email) return { error: 'This cart has no email address' };
    if (!['active', 'abandoned'].includes(cart.status)) return { error: 'This cart has already been checked out' };
    const { data: sub } = await db.from('newsletter_subscribers').select('unsubscribed_at').eq('email', cart.email).maybeSingle();
    if (sub?.unsubscribed_at) return { error: 'This customer has unsubscribed from marketing emails' };
    const link = `${env.siteUrl}/cart/recover/${cart.recovery_token}`;
    const mail = simpleEmail('You left something beautiful behind', 'Your bag is waiting', [
      'You left a few pieces in your Hairver Green bag. We have saved them for you — stock is limited, so complete your order while your selection is still available.',
      'Need help choosing? Reply to this email or message us on WhatsApp.',
    ], { href: link, label: 'Return to your bag' });
    const r = await sendEmail({ to: cart.email, ...mail });
    if ('ok' in r && !r.ok) return { error: 'The email could not be sent. Check your Resend settings.' };
    await audit(staff, { action: 'recovery_email', entityType: 'cart', entityId: cart.id, summary: `Sent recovery email to ${cart.email}` });
    return 'skipped' in r ? { ok: true, message: 'Email service not configured — copy the recovery link instead' } : { ok: true, message: 'Recovery email sent' };
  });
}
