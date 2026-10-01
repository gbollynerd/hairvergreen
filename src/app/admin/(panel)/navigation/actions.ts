'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, refreshStore, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';

type Item = { label: string; href: string; children?: Item[]; feature?: { title?: string; href?: string; image?: string } | null; auto?: string | null; highlight?: boolean };

const safeHref = (h: unknown) => {
  const s = String(h ?? '').trim().slice(0, 300);
  if (!s) return '#';
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (/^https:\/\//i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s)) return s;
  return '/' + s.replace(/^\/+/, '').replace(/^[a-z]+:/i, '');
};

function clean(items: unknown, depth = 0): Item[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 30).flatMap((raw) => {
    const it = raw as Record<string, unknown>;
    const label = String(it?.label ?? '').trim().slice(0, 60);
    if (!label) return [];
    const out: Item = { label, href: safeHref(it.href) };
    if (depth === 0 && Array.isArray(it.children) && it.children.length) out.children = clean(it.children, 1);
    const f = it.feature as Record<string, unknown> | undefined;
    if (depth === 0 && f && (f.title || f.image)) out.feature = { title: String(f.title ?? '').slice(0, 80), href: safeHref(f.href), image: String(f.image ?? '').slice(0, 500) };
    if (depth === 0 && (it.auto === 'texture' || it.auto === 'length')) out.auto = it.auto;
    if (it.highlight) out.highlight = true;
    return [out];
  });
}

export async function saveMenu(key: string, items: unknown): Promise<ActionResult> {
  return guarded('navigation.manage', async (staff) => {
    if (!/^[a-z_]{2,40}$/.test(key)) return { error: 'Invalid menu' };
    const db = supabaseAdmin();
    const { data: before } = await db.from('menus').select('*').eq('key', key).maybeSingle();
    if (!before) return { error: 'Menu not found' };
    const next = clean(items);
    const { error } = await db.from('menus').update({ items: next, updated_at: new Date().toISOString() }).eq('key', key);
    if (error) throw error;
    await audit(staff, { action: 'update', entityType: 'menu', entityId: key, summary: `Updated ${before.name}`, before: { items: before.items }, after: { items: next } });
    refreshStore('content');
    return { ok: true, message: 'Menu saved' };
  });
}
