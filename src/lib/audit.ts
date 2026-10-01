import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requestMeta, type StaffContext } from '@/lib/auth';

type AuditInput = {
  action: string; entityType: string; entityId?: string | null; summary?: string;
  before?: unknown; after?: unknown;
};

/** Records who changed what. Only changed keys are stored when before/after objects are given. */
export async function audit(actor: Pick<StaffContext, 'id' | 'email'> | null, input: AuditInput) {
  try {
    let before = input.before as Record<string, unknown> | undefined;
    let after = input.after as Record<string, unknown> | undefined;
    if (before && after && typeof before === 'object' && typeof after === 'object') {
      const b: Record<string, unknown> = {}; const a: Record<string, unknown> = {};
      for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (k === 'updated_at') continue;
        if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) { b[k] = before[k]; a[k] = after[k]; }
      }
      before = b; after = a;
      if (!Object.keys(a).length && input.action === 'update') return;
    }
    const meta = await requestMeta().catch(() => ({ ip: null, userAgent: null }));
    await supabaseAdmin().from('audit_logs').insert({
      actor_id: actor?.id ?? null, actor_email: actor?.email ?? 'system', action: input.action,
      entity_type: input.entityType, entity_id: input.entityId ?? null, summary: input.summary ?? null,
      before: before ?? null, after: after ?? null, ip: meta.ip, user_agent: meta.userAgent,
    });
  } catch (e) {
    console.error('[audit] failed', e);
  }
}
