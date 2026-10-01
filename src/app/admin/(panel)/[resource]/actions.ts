'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, refreshStore, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';
import { RESOURCES, type FieldDef } from '@/lib/admin/resources';
import { slugify } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';

function parseField(f: FieldDef, fd: FormData): unknown {
  const raw = fd.get(f.name);
  const s = raw == null ? '' : String(raw).trim();
  switch (f.type) {
    case 'number': return s === '' ? null : Number(s);
    case 'money': return s === '' ? null : Math.round(Number(s));
    case 'boolean': return raw === 'on' || raw === 'true';
    case 'date': return s || null;
    case 'datetime': { if (!s) return null; const d = new Date(s); return isNaN(+d) ? null : d.toISOString(); }
    case 'tags': case 'multiselect': case 'list': case 'json': { try { return s ? JSON.parse(s) : f.type === 'json' ? null : []; } catch { return []; } }
    case 'emails': return s.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+$/.test(e));
    case 'slug': return slugify(s || String(fd.get(f.slugFrom ?? '') ?? ''));
    case 'richtext': return sanitizeHtml(s);
    case 'color': return s && /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : null;
    case 'select': case 'mediaId': return s || null;
    case 'readonly': return undefined;
    default: return s || null;
  }
}

export async function saveResource(key: string, id: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const def = RESOURCES[key];
  if (!def || def.readonly) return { error: 'Unknown resource' };
  const isNew = id === 'new';
  const perm = isNew ? def.createPermission ?? def.permission : def.permission;
  return guarded(perm, async (staff) => {
    const data: Record<string, unknown> = {};
    for (const f of def.fields) {
      if (f.type === 'readonly' || f.name.startsWith('_')) continue;
      const v = parseField(f, fd);
      if (v !== undefined) data[f.name] = v;
      if (f.required && (v === null || v === '' || (Array.isArray(v) && !v.length))) return { error: `${f.label} is required` };
    }
    // Resource-specific mapping
    if (key === 'discounts') {
      const at = data.applies_to as string;
      data.target_ids = at === 'products' ? data.target_products : at === 'categories' ? data.target_categories : at === 'collections' ? data.target_collections : [];
      delete data.target_products; delete data.target_categories; delete data.target_collections;
      data.code = data.code ? String(data.code).toUpperCase().replace(/\s+/g, '') : null;
      if (data.kind === 'percentage' && (Number(data.value) <= 0 || Number(data.value) > 100)) return { error: 'Percentage must be between 1 and 100' };
      data.value = data.value ?? 0;
    }
    if (key === 'popups') { data.style = { layout: data.style_layout ?? 'split', background: data.style_background ?? 'ivory', animation: 'fade' }; delete data.style_layout; delete data.style_background; }
    if (key === 'shipping-zones' || key === 'discounts') for (const k of ['countries', 'currencies']) if (Array.isArray(data[k])) data[k] = (data[k] as string[]).map((c) => c.toUpperCase().trim());
    if (key === 'announcements' || key === 'popups') for (const k of ['devices', 'page_paths']) if (data[k] === undefined) delete data[k];
    if (key === 'social') data.media_id = null;

    const db = supabaseAdmin();
    let before: Record<string, unknown> | null = null;
    let rowId = id;
    if (isNew) {
      const { data: ins, error } = await db.from(def.table).insert(data).select('id').single();
      if (error) throw error; rowId = String((ins as { id: string }).id);
    } else {
      const { data: b } = await db.from(def.table).select('*').eq('id', id).single(); before = b;
      const { error } = await db.from(def.table).update(data).eq('id', id);
      if (error) throw error;
    }
    if (key === 'collections') {
      const products = (() => { try { return JSON.parse(String(fd.get('_products') || '[]')) as string[]; } catch { return []; } })();
      await db.from('collection_products').delete().eq('collection_id', rowId);
      if (products.length) await db.from('collection_products').insert(products.map((p, i) => ({ collection_id: rowId, product_id: p, sort: i })));
    }
    await audit(staff, { action: isNew ? 'create' : 'update', entityType: def.table, entityId: rowId, summary: `${isNew ? 'Created' : 'Updated'} ${def.singular}: ${String(data[def.titleField] ?? rowId).slice(0, 80)}`, before: before ?? undefined, after: before ? { ...before, ...data } : data });
    if (def.refresh) refreshStore(def.refresh);
    return { ok: true, message: `${def.singular[0].toUpperCase() + def.singular.slice(1)} saved`, redirect: isNew ? `/admin/${key}/${rowId}` : undefined };
  });
}

export async function deleteResource(key: string, id: string): Promise<ActionResult> {
  const def = RESOURCES[key];
  if (!def) return { error: 'Unknown resource' };
  return guarded(def.deletePermission ?? def.permission, async (staff) => {
    const db = supabaseAdmin();
    const { data: before } = await db.from(def.table).select('*').eq('id', id).single();
    const { error } = await db.from(def.table).delete().eq('id', id);
    if (error) return { error: /foreign key/.test(error.message) ? 'This item is in use elsewhere and can’t be deleted. Deactivate it instead.' : error.message };
    await audit(staff, { action: 'delete', entityType: def.table, entityId: id, summary: `Deleted ${def.singular}: ${String(before?.[def.titleField] ?? id).slice(0, 80)}`, before: before ?? undefined });
    if (def.refresh) refreshStore(def.refresh);
    return { ok: true, message: 'Deleted', redirect: `/admin/${key}` };
  });
}
