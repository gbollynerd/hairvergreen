'use server';
import { revalidateTag } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, str, bool, refreshStore, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';
import { sanitizeHtml } from '@/lib/sanitize';
import { SECTION_SCHEMA } from '@/lib/admin/section-schema';
import { isUuid, slugify } from '@/lib/utils';

const ALIASES = ['split', 'testimonials', 'text', 'promo_banner', 'collection'];
const VALID_TYPES = new Set([...Object.keys(SECTION_SCHEMA), ...ALIASES]);
const RESERVED = new Set(['admin', 'api', 'account', 'cart', 'checkout', 'products', 'collections', 'journal', 'search', 'shop', 'wishlist', 'orders', 'login', 'register', 'auth', 'services', 'policies', 'contact', 'track-order', 'forgot-password', 'reset-password', 'wigs', 'hair']);

async function slugClash(slug: string, kind: string) {
  if (kind === 'policy') return null;
  if (RESERVED.has(slug)) return `“${slug}” is used by the store. Choose another URL.`;
  const { data } = await supabaseAdmin().from('categories').select('id').eq('slug', slug).is('parent_id', null).maybeSingle();
  return data ? `“${slug}” is already a category URL. Choose another.` : null;
}

function bust(slug: string) {
  refreshStore('content');
  try { revalidateTag(`page:${slug}`, 'max'); } catch { /* ignore */ }
}

export async function createPage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('content.create', async (staff) => {
    const title = str(fd, 'title');
    const kind = ['page', 'policy', 'landing'].includes(str(fd, 'kind')) ? str(fd, 'kind') : 'page';
    const slug = slugify(str(fd, 'slug') || title);
    if (!title || !slug) return { error: 'Give the page a title' };
    const clash = await slugClash(slug, kind); if (clash) return { error: clash };
    const { data, error } = await supabaseAdmin().from('pages').insert({ title, slug, kind, status: 'draft', updated_by: staff.id }).select('id').single();
    if (error) throw error;
    await audit(staff, { action: 'create', entityType: 'page', entityId: data.id, summary: `Created page ${title}` });
    return { ok: true, message: 'Page created', redirect: `/admin/pages/${data.id}` };
  });
}

export async function savePageMeta(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('content.edit', async (staff) => {
    const id = str(fd, 'id');
    if (!isUuid(id)) return { error: 'Invalid page' };
    const db = supabaseAdmin();
    const { data: before } = await db.from('pages').select('*').eq('id', id).single();
    if (!before) return { error: 'Page not found' };
    const status = str(fd, 'status') === 'published' ? 'published' : 'draft';
    if (status !== before.status && !staff.permissions.has('content.publish')) return { error: 'You do not have permission to publish or unpublish pages' };
    let slug = before.slug;
    if (before.kind !== 'home') {
      slug = slugify(str(fd, 'slug') || before.slug);
      if (slug !== before.slug) { const clash = await slugClash(slug, before.kind); if (clash) return { error: clash }; }
    }
    const bodyRaw = str(fd, 'body');
    const patch = {
      title: str(fd, 'title') || before.title, slug, status,
      body: bodyRaw ? sanitizeHtml(bodyRaw) : null,
      seo_title: str(fd, 'seo_title') || null, seo_description: str(fd, 'seo_description') || null,
      og_image_id: isUuid(str(fd, 'og_image_id')) ? str(fd, 'og_image_id') : null,
      noindex: bool(fd, 'noindex'),
      published_at: status === 'published' ? before.published_at ?? new Date().toISOString() : before.published_at,
      updated_by: staff.id, updated_at: new Date().toISOString(),
    };
    const { error } = await db.from('pages').update(patch).eq('id', id);
    if (error) throw error;
    await audit(staff, { action: status !== before.status ? (status === 'published' ? 'publish' : 'unpublish') : 'update', entityType: 'page', entityId: id, summary: `Page ${patch.title}`, before, after: { ...before, ...patch } });
    bust(before.slug); if (slug !== before.slug) bust(slug);
    return { ok: true, message: 'Page saved' };
  });
}

type InSection = { id?: string; type: string; name?: string; is_visible?: boolean; settings?: Record<string, unknown> };

function cleanSettings(type: string, s: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...s };
  if (typeof out.html === 'string') out.html = sanitizeHtml(out.html);
  if (typeof out.overlay === 'string') out.overlay = Number(out.overlay);
  if (out.overlay != null) out.overlay = Math.min(0.8, Math.max(0, Number(out.overlay) || 0));
  if (out.limit != null) out.limit = Math.min(24, Math.max(1, Math.round(Number(out.limit) || 8)));
  // drop empty strings to keep settings tidy
  for (const k of Object.keys(out)) if (out[k] === '' || out[k] === null) delete out[k];
  void type;
  return out;
}

export async function savePageSections(pageId: string, sections: InSection[]): Promise<ActionResult> {
  return guarded('content.edit', async (staff) => {
    if (!isUuid(pageId)) return { error: 'Invalid page' };
    if (!Array.isArray(sections) || sections.length > 60) return { error: 'Too many sections' };
    const db = supabaseAdmin();
    const { data: page } = await db.from('pages').select('id, slug, title').eq('id', pageId).single();
    if (!page) return { error: 'Page not found' };
    const { data: existing } = await db.from('page_sections').select('*').eq('page_id', pageId);
    const keepIds = new Set<string>();
    const now = new Date().toISOString();
    const rows = sections.map((s, i) => {
      if (!VALID_TYPES.has(s.type)) throw new Error(`Unknown section type: ${s.type}`);
      const settings = cleanSettings(s.type, s.settings && typeof s.settings === 'object' ? s.settings : {});
      if (JSON.stringify(settings).length > 100_000) throw new Error('A section is too large');
      const id = s.id && isUuid(s.id) && (existing ?? []).some((e) => e.id === s.id) ? s.id : undefined;
      if (id) keepIds.add(id);
      return { ...(id ? { id } : {}), page_id: pageId, type: s.type, name: (s.name ?? '').slice(0, 120) || null, sort: i, is_visible: s.is_visible !== false, settings, updated_at: now };
    });
    const remove = (existing ?? []).filter((e) => !keepIds.has(e.id)).map((e) => e.id);
    if (remove.length) { const { error } = await db.from('page_sections').delete().in('id', remove); if (error) throw error; }
    const updates = rows.filter((r) => 'id' in r);
    const inserts = rows.filter((r) => !('id' in r));
    if (updates.length) { const { error } = await db.from('page_sections').upsert(updates); if (error) throw error; }
    if (inserts.length) { const { error } = await db.from('page_sections').insert(inserts); if (error) throw error; }
    await db.from('pages').update({ updated_at: now, updated_by: staff.id }).eq('id', pageId);
    await audit(staff, { action: 'update', entityType: 'page_sections', entityId: pageId, summary: `Saved ${rows.length} sections on ${page.title}`, before: { sections: (existing ?? []).sort((x, y) => x.sort - y.sort).map((e) => ({ type: e.type, name: e.name, is_visible: e.is_visible, settings: e.settings })) }, after: { sections: rows.map((r) => ({ type: r.type, name: r.name, is_visible: r.is_visible, settings: r.settings })) } });
    bust(page.slug);
    return { ok: true, message: 'Sections saved' };
  });
}

export async function deletePage(id: string): Promise<ActionResult> {
  return guarded('content.publish', async (staff) => {
    if (!isUuid(id)) return { error: 'Invalid page' };
    const db = supabaseAdmin();
    const { data: page } = await db.from('pages').select('*').eq('id', id).single();
    if (!page) return { error: 'Page not found' };
    if (page.kind === 'home') return { error: 'The homepage cannot be deleted' };
    await db.from('pages').delete().eq('id', id);
    await audit(staff, { action: 'delete', entityType: 'page', entityId: id, summary: `Deleted page ${page.title}`, before: page });
    bust(page.slug);
    return { ok: true, message: 'Page deleted', redirect: '/admin/pages' };
  });
}

export async function duplicatePage(id: string): Promise<ActionResult> {
  return guarded('content.create', async (staff) => {
    if (!isUuid(id)) return { error: 'Invalid page' };
    const db = supabaseAdmin();
    const { data: page } = await db.from('pages').select('*').eq('id', id).single();
    if (!page) return { error: 'Page not found' };
    const slug = `${page.kind === 'home' ? 'home' : page.slug}-copy-${Math.random().toString(36).slice(2, 6)}`;
    const { data: copy, error } = await db.from('pages').insert({ title: `${page.title} (copy)`, slug, kind: page.kind === 'home' ? 'landing' : page.kind, status: 'draft', body: page.body, seo_title: page.seo_title, seo_description: page.seo_description, updated_by: staff.id }).select('id').single();
    if (error) throw error;
    const { data: secs } = await db.from('page_sections').select('type, name, sort, is_visible, settings').eq('page_id', id);
    if (secs?.length) await db.from('page_sections').insert(secs.map((s) => ({ ...s, page_id: copy.id })));
    await audit(staff, { action: 'create', entityType: 'page', entityId: copy.id, summary: `Duplicated ${page.title}` });
    return { ok: true, message: 'Page duplicated', redirect: `/admin/pages/${copy.id}` };
  });
}
