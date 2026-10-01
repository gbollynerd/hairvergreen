'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, str, bool, refreshStore, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';
import { isUuid } from '@/lib/utils';

const STATUSES = ['pending', 'approved', 'rejected', 'hidden'] as const;

export async function moderateReview(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('reviews.moderate', async (staff) => {
    const id = str(fd, 'id');
    if (!isUuid(id)) return { error: 'Invalid review' };
    const db = supabaseAdmin();
    const { data: before } = await db.from('reviews').select('*').eq('id', id).single();
    if (!before) return { error: 'Review not found' };
    const patch: Record<string, unknown> = {};
    const status = str(fd, 'status');
    if (status && (STATUSES as readonly string[]).includes(status)) patch.status = status;
    if (fd.has('admin_response')) {
      const r = str(fd, 'admin_response').slice(0, 2000);
      patch.admin_response = r || null;
      patch.responded_at = r ? new Date().toISOString() : null;
    }
    if (fd.has('is_featured_present')) patch.is_featured = bool(fd, 'is_featured');
    if (fd.has('is_verified_present')) patch.is_verified = bool(fd, 'is_verified');
    if (!Object.keys(patch).length) return { ok: true, message: 'No changes' };
    const { error } = await db.from('reviews').update(patch).eq('id', id);
    if (error) throw error;
    await audit(staff, { action: 'moderate', entityType: 'review', entityId: id, summary: `Review by ${before.author_name}${patch.status ? ` → ${patch.status}` : ''}`, before, after: { ...before, ...patch } });
    refreshStore('catalog');
    return { ok: true, message: patch.status ? `Review ${patch.status}` : 'Review updated' };
  });
}

export async function bulkModerate(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('reviews.moderate', async (staff) => {
    const ids = fd.getAll('ids').map(String).filter(isUuid);
    const status = str(fd, 'status');
    if (!ids.length) return { error: 'Select at least one review' };
    if (status === 'delete') {
      await supabaseAdmin().from('reviews').delete().in('id', ids);
    } else {
      if (!(STATUSES as readonly string[]).includes(status)) return { error: 'Choose an action' };
      await supabaseAdmin().from('reviews').update({ status }).in('id', ids);
    }
    await audit(staff, { action: status === 'delete' ? 'delete' : 'moderate', entityType: 'review', summary: `${ids.length} reviews → ${status}`, after: { ids } });
    refreshStore('catalog');
    return { ok: true, message: `${ids.length} review${ids.length > 1 ? 's' : ''} updated` };
  });
}
