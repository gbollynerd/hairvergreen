import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAnyPermission, requirePermission, PermissionError } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try { await requireAnyPermission('media.upload', 'products.edit', 'content.edit', 'blog.create'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 80);
  const kind = req.nextUrl.searchParams.get('kind');
  let query = supabaseAdmin().from('media').select('id, url, alt, kind, title, filename, metadata').order('created_at', { ascending: false }).limit(200);
  if (q) query = query.or(`alt.ilike.%${q.replace(/[%,()]/g, '')}%,title.ilike.%${q.replace(/[%,()]/g, '')}%,filename.ilike.%${q.replace(/[%,()]/g, '')}%`);
  if (kind === 'image' || kind === 'video') query = query.eq('kind', kind);
  const { data } = await query;
  return NextResponse.json({ items: data ?? [] });
}

const Body = z.object({
  path: z.string().startsWith('library/').max(300), filename: z.string().max(200), mime_type: z.string().max(100), size_bytes: z.number().int().nonnegative(),
  width: z.number().int().optional(), height: z.number().int().optional(), folder_id: z.uuid().nullable().optional(),
  poster_path: z.string().startsWith('library/').max(300).refine((v) => !v.includes('..')).optional(), duration_seconds: z.number().nonnegative().max(36000).optional(),
});

export async function POST(req: NextRequest) {
  let staff;
  try { staff = await requirePermission('media.upload'); } catch (e) { return NextResponse.json({ error: e instanceof PermissionError ? e.message : 'Forbidden' }, { status: 403 }); }
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Invalid upload' }, { status: 400 });
  const db = supabaseAdmin();
  const url = db.storage.from('media').getPublicUrl(p.data.path).data.publicUrl;
  const kind = p.data.mime_type.startsWith('video/') ? 'video' : p.data.mime_type.startsWith('image/') ? 'image' : 'file';
  const poster = p.data.poster_path ? db.storage.from('media').getPublicUrl(p.data.poster_path).data.publicUrl : null;
  const alt = p.data.filename.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
  const { data, error } = await db.from('media').insert({ bucket: 'media', path: p.data.path, url, kind, mime_type: p.data.mime_type, filename: p.data.filename,
    title: alt, alt, size_bytes: p.data.size_bytes, width: p.data.width ?? null, height: p.data.height ?? null, folder_id: p.data.folder_id ?? null, created_by: staff.id,
    duration_seconds: p.data.duration_seconds ?? null, metadata: poster ? { poster, poster_path: p.data.poster_path } : {} })
    .select('id, url, alt, kind, metadata').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(staff, { action: 'create', entityType: 'media', entityId: data.id, summary: `Uploaded ${p.data.filename}` });
  return NextResponse.json({ item: data });
}
