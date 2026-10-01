import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth';
import { slugify } from '@/lib/utils';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm', 'video/quicktime'];
const Body = z.object({ filename: z.string().max(200), contentType: z.string().refine((t) => ALLOWED.includes(t), 'Unsupported file type'), size: z.number().max(100 * 1024 * 1024, 'Files must be under 100MB') });

export async function POST(req: NextRequest) {
  try { await requirePermission('media.upload'); } catch { return NextResponse.json({ error: 'You do not have permission to upload media.' }, { status: 403 }); }
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? 'Invalid file' }, { status: 400 });
  const ext = (p.data.filename.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
  const base = slugify(p.data.filename.replace(/\.[^.]+$/, '')).slice(0, 60) || 'file';
  const d = new Date();
  const path = `library/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${base}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from('media').createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: 'Storage is unavailable' }, { status: 500 });
  return NextResponse.json({ path, token: data.token });
}
