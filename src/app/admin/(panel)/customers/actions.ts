'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, str, bool, json, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';

export async function saveCustomer(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('customers.edit', async (staff) => {
    const id = str(fd, 'id');
    const db = supabaseAdmin();
    const { data: before } = await db.from('customers').select('*').eq('id', id).single();
    const patch = { full_name: str(fd, 'full_name') || null, phone: str(fd, 'phone') || null, country: str(fd, 'country') || null, notes: str(fd, 'notes') || null, tags: json<string[]>(fd, 'tags', []), accepts_marketing: bool(fd, 'accepts_marketing') };
    await db.from('customers').update(patch).eq('id', id);
    if (before && before.accepts_marketing !== patch.accepts_marketing) {
      if (patch.accepts_marketing) await db.from('newsletter_subscribers').upsert({ email: before.email, source: 'admin', unsubscribed_at: null }, { onConflict: 'email' });
      else await db.from('newsletter_subscribers').update({ unsubscribed_at: new Date().toISOString() }).eq('email', before.email);
    }
    await audit(staff, { action: 'update', entityType: 'customer', entityId: id, summary: `Updated customer ${before?.email}`, before: before ?? undefined, after: { ...before, ...patch } });
    return { ok: true, message: 'Customer saved' };
  });
}
