'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, str, bool, refreshStore, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';
import { sendEmail, simpleEmail, orderLink } from '@/lib/email';

const MESSAGES: Record<string, [string, string]> = {
  approved: ['Your return is approved', 'Please send the item(s) back unworn with lace and wefts intact. Reply to this email for the return address and instructions.'],
  rejected: ['About your return request', 'Unfortunately we can’t accept this return under our Refund Policy. Reply to this email if you have any questions.'],
  received: ['We’ve received your return', 'Thank you — we’re inspecting your return now and will update you shortly.'],
  exchanged: ['Your exchange is on its way', 'Your replacement is being prepared. We’ll send tracking when it ships.'],
};

export async function updateReturn(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('returns.manage', async (staff) => {
    const id = str(fd, 'id'); const status = str(fd, 'status');
    if (!['approved', 'rejected', 'awaiting_item', 'received', 'exchanged', 'closed'].includes(status)) return { error: 'Invalid status' };
    const db = supabaseAdmin();
    const { data: rr } = await db.from('return_requests').select('*, orders(order_number, email, access_token)').eq('id', id).single();
    if (!rr) return { error: 'Return not found' };
    const patch: Record<string, unknown> = { status, admin_note: str(fd, 'admin_note') || rr.admin_note };
    if (status === 'received' && bool(fd, 'restock') && !rr.restocked) {
      await db.rpc('restock_order_items', { p_order: rr.order_id, p_items: rr.items, p_actor: staff.id });
      patch.restocked = true; refreshStore('catalog');
    }
    await db.from('return_requests').update(patch).eq('id', id);
    await db.from('order_events').insert({ order_id: rr.order_id, type: 'return', message: `Return ${rr.rma_number}: ${status.replace('_', ' ')}`, is_internal: false, actor_id: staff.id, actor_name: staff.email });
    const msg = MESSAGES[status];
    if (msg && bool(fd, 'notify')) await sendEmail({ to: rr.email, ...simpleEmail(`${msg[0]} (${rr.rma_number})`, msg[0], [msg[1]], { href: orderLink(rr.orders), label: 'View your order' }) });
    await audit(staff, { action: 'update', entityType: 'return', entityId: id, summary: `${rr.rma_number} → ${status}`, before: { status: rr.status }, after: { status } });
    return { ok: true, message: `Return ${status.replace('_', ' ')}` };
  });
}
