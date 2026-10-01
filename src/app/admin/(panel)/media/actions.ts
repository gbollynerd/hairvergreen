'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, refreshStore, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';
import { isUuid } from '@/lib/utils';
import { requireAnyPermission } from '@/lib/auth';

const REFS: [table: string, col: string, label: string][] = [
  ['product_media', 'media_id', 'product gallery'], ['products', 'og_image_id', 'product share image'], ['product_variants', 'image_id', 'variant image'],
  ['categories', 'image_id', 'category'], ['attribute_values', 'image_id', 'attribute'], ['collections', 'image_id', 'collection'],
  ['campaigns', 'banner_id', 'campaign'], ['pages', 'og_image_id', 'page share image'], ['blog_posts', 'featured_image_id', 'journal post'],
  ['popups', 'image_id', 'popup'], ['social_posts', 'media_id', 'social post'],
];

/** Where a media item is used (by id, plus URL mentions in page sections and menus). */
export async function mediaUsage(id: string): Promise<{ label: string; count: number }[]> {
  try { await requireAnyPermission('media.upload', 'media.delete'); } catch { return []; }
  if (!isUuid(id)) return [];
  const db = supabaseAdmin();
  const { data: m } = await db.from('media').select('url').eq('id', id).single();
  const res = await Promise.all(REFS.map(async ([t, c, label]) => ({ label, count: (await db.from(t).select(c, { count: 'exact', head: true }).eq(c, id)).count ?? 0 })));
  if (m?.url) {
    const [{ data: secs }, { data: menus }, { data: posts }] = await Promise.all([
      db.from('page_sections').select('settings'), db.from('menus').select('items'), db.from('blog_posts').select('body').ilike('body', `%${m.url}%`),
    ]);
    res.push({ label: 'page section', count: (secs ?? []).filter((s) => JSON.stringify(s.settings).includes(m.url)).length });
    res.push({ label: 'menu', count: (menus ?? []).filter((s) => JSON.stringify(s.items).includes(m.url)).length });
    res.push({ label: 'journal body', count: (posts ?? []).length });
  }
  return res.filter((r) => r.count > 0);
}

export async function updateMedia(id: string, patch: { alt?: string; title?: string; tags?: string[]; folder_id?: string | null }): Promise<ActionResult> {
  return guarded('media.upload', async (staff) => {
    if (!isUuid(id)) return { error: 'Invalid media' };
    const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof patch.alt === 'string') clean.alt = patch.alt.slice(0, 300);
    if (typeof patch.title === 'string') clean.title = patch.title.slice(0, 200);
    if (Array.isArray(patch.tags)) clean.tags = patch.tags.map((t) => String(t).toLowerCase().slice(0, 40)).slice(0, 20);
    if (patch.folder_id !== undefined) clean.folder_id = patch.folder_id && isUuid(patch.folder_id) ? patch.folder_id : null;
    const { error } = await supabaseAdmin().from('media').update(clean).eq('id', id);
    if (error) throw error;
    await audit(staff, { action: 'update', entityType: 'media', entityId: id, summary: 'Updated media details', after: clean });
    refreshStore('all');
    return { ok: true, message: 'Saved' };
  });
}

export async function moveMedia(ids: string[], folderId: string | null): Promise<ActionResult> {
  return guarded('media.upload', async (staff) => {
    const valid = ids.filter(isUuid);
    if (!valid.length) return { error: 'Nothing selected' };
    await supabaseAdmin().from('media').update({ folder_id: folderId && isUuid(folderId) ? folderId : null }).in('id', valid);
    await audit(staff, { action: 'move', entityType: 'media', summary: `Moved ${valid.length} files`, after: { ids: valid, folderId } });
    return { ok: true, message: `Moved ${valid.length} file${valid.length > 1 ? 's' : ''}` };
  });
}

export async function deleteMedia(ids: string[], force = false): Promise<ActionResult> {
  return guarded('media.delete', async (staff) => {
    const valid = ids.filter(isUuid);
    if (!valid.length) return { error: 'Nothing selected' };
    const db = supabaseAdmin();
    if (!force) {
      for (const id of valid) {
        const used = await mediaUsage(id);
        if (used.length) return { error: `In use (${used.map((u) => `${u.count} ${u.label}`).join(', ')}). Replace or remove it there first, or delete anyway.` };
      }
    }
    const { data: rows } = await db.from('media').select('id, bucket, path, filename, metadata').in('id', valid);
    const paths = (rows ?? []).filter((r) => r.bucket === 'media').flatMap((r) => [r.path, (r.metadata as { poster_path?: string } | null)?.poster_path]).filter((x): x is string => !!x);
    if (paths.length) await db.storage.from('media').remove(paths);
    await db.from('media').delete().in('id', valid);
    await audit(staff, { action: 'delete', entityType: 'media', summary: `Deleted ${valid.length} file(s)`, before: rows });
    refreshStore('all');
    return { ok: true, message: `Deleted ${valid.length} file${valid.length > 1 ? 's' : ''}` };
  });
}

/** Swap the file behind a media item. Everything that references it by id updates automatically; URL mentions in sections, menus and journal bodies are rewritten. */
export async function replaceMediaFile(id: string, file: { path: string; mime_type: string; size_bytes: number; filename: string; width?: number; height?: number; poster_path?: string; duration_seconds?: number }): Promise<ActionResult> {
  return guarded('media.upload', async (staff) => {
    if (!isUuid(id) || !file.path.startsWith('library/') || file.path.includes('..')) return { error: 'Invalid upload' };
    const db = supabaseAdmin();
    const { data: before } = await db.from('media').select('*').eq('id', id).single();
    if (!before) return { error: 'Media not found' };
    const url = db.storage.from('media').getPublicUrl(file.path).data.publicUrl;
    const kind = file.mime_type.startsWith('video/') ? 'video' : file.mime_type.startsWith('image/') ? 'image' : 'file';
    const posterPath = file.poster_path && file.poster_path.startsWith('library/') && !file.poster_path.includes('..') ? file.poster_path : null;
    const metadata = { ...((before.metadata as Record<string, unknown>) ?? {}), poster: posterPath ? db.storage.from('media').getPublicUrl(posterPath).data.publicUrl : null, poster_path: posterPath };
    await db.from('media').update({ path: file.path, url, kind, mime_type: file.mime_type, filename: file.filename.slice(0, 200), size_bytes: file.size_bytes, width: file.width ?? null, height: file.height ?? null, duration_seconds: file.duration_seconds ?? null, metadata, updated_at: new Date().toISOString() }).eq('id', id);
    const oldPoster = (before.metadata as { poster_path?: string } | null)?.poster_path;
    if (oldPoster && oldPoster !== posterPath) await db.storage.from('media').remove([oldPoster]);
    // Rewrite URL mentions
    const oldUrl = before.url as string;
    const swap = (v: unknown) => JSON.parse(JSON.stringify(v).split(JSON.stringify(oldUrl).slice(1, -1)).join(JSON.stringify(url).slice(1, -1)));
    const [{ data: secs }, { data: menus }, { data: posts }] = await Promise.all([
      db.from('page_sections').select('id, settings'), db.from('menus').select('key, items'), db.from('blog_posts').select('id, body').ilike('body', `%${oldUrl}%`),
    ]);
    for (const s of secs ?? []) if (JSON.stringify(s.settings).includes(oldUrl)) await db.from('page_sections').update({ settings: swap(s.settings) }).eq('id', s.id);
    for (const m of menus ?? []) if (JSON.stringify(m.items).includes(oldUrl)) await db.from('menus').update({ items: swap(m.items) }).eq('key', m.key);
    for (const p of posts ?? []) await db.from('blog_posts').update({ body: p.body.split(oldUrl).join(url) }).eq('id', p.id);
    if (before.path && before.bucket === 'media') await db.storage.from('media').remove([before.path]);
    await audit(staff, { action: 'replace', entityType: 'media', entityId: id, summary: `Replaced ${before.filename} with ${file.filename}`, before: { url: oldUrl }, after: { url } });
    refreshStore('all');
    return { ok: true, message: 'File replaced everywhere it is used' };
  });
}

export async function createFolder(name: string, parentId?: string | null): Promise<ActionResult> {
  return guarded('media.upload', async (staff) => {
    const n = name.trim().slice(0, 80);
    if (!n) return { error: 'Name the folder' };
    const { data, error } = await supabaseAdmin().from('media_folders').insert({ name: n, parent_id: parentId && isUuid(parentId) ? parentId : null }).select('id').single();
    if (error) throw error;
    await audit(staff, { action: 'create', entityType: 'media_folder', entityId: data.id, summary: `Created folder ${n}` });
    return { ok: true, message: 'Folder created', id: data.id };
  });
}

export async function renameFolder(id: string, name: string): Promise<ActionResult> {
  return guarded('media.upload', async (staff) => {
    if (!isUuid(id) || !name.trim()) return { error: 'Invalid folder' };
    await supabaseAdmin().from('media_folders').update({ name: name.trim().slice(0, 80) }).eq('id', id);
    await audit(staff, { action: 'update', entityType: 'media_folder', entityId: id, summary: `Renamed folder to ${name}` });
    return { ok: true, message: 'Folder renamed' };
  });
}

export async function deleteFolder(id: string): Promise<ActionResult> {
  return guarded('media.delete', async (staff) => {
    if (!isUuid(id)) return { error: 'Invalid folder' };
    // Files are kept and moved to “All files” (folder_id set null by FK)
    await supabaseAdmin().from('media_folders').delete().eq('id', id);
    await audit(staff, { action: 'delete', entityType: 'media_folder', entityId: id, summary: 'Deleted folder (files kept)' });
    return { ok: true, message: 'Folder deleted — its files are kept', redirect: '/admin/media' };
  });
}

/** Attach (or replace) the thumbnail image shown for a video before it plays. */
export async function setVideoPoster(id: string, posterPath: string, info?: { width?: number; height?: number; duration_seconds?: number }): Promise<ActionResult> {
  return guarded('media.upload', async (staff) => {
    if (!isUuid(id) || !posterPath.startsWith('library/') || posterPath.includes('..')) return { error: 'Invalid thumbnail' };
    const db = supabaseAdmin();
    const { data: m } = await db.from('media').select('id, kind, metadata').eq('id', id).single();
    if (!m || m.kind !== 'video') return { error: 'Thumbnails can only be set on videos' };
    const meta = (m.metadata as Record<string, unknown>) ?? {};
    const old = meta.poster_path as string | undefined;
    const poster = db.storage.from('media').getPublicUrl(posterPath).data.publicUrl;
    const patch: Record<string, unknown> = { metadata: { ...meta, poster, poster_path: posterPath }, updated_at: new Date().toISOString() };
    if (info?.width) patch.width = info.width;
    if (info?.height) patch.height = info.height;
    if (info?.duration_seconds) patch.duration_seconds = info.duration_seconds;
    await db.from('media').update(patch).eq('id', id);
    if (old && old !== posterPath) await db.storage.from('media').remove([old]);
    await audit(staff, { action: 'update', entityType: 'media', entityId: id, summary: 'Set video thumbnail' });
    refreshStore('all');
    return { ok: true, message: 'Thumbnail saved' };
  });
}
