import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

// Customer uploads (review photos, consultation references, return photos) go straight from the
// browser to Storage using a short-lived signed URL. Review photos live in the public `media`
// bucket (shown only once a review is approved); everything else is private.
const Body = z.object({
  purpose: z.enum(['review', 'consultation', 'return']),
  filename: z.string().max(200),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimit('upload-sign', 20);
  if (!rl.ok) return NextResponse.json({ error: 'Too many uploads — please wait a moment.' }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  const user = await getUser();
  if (p.data.purpose !== 'consultation' && !user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  const ext = (p.data.filename.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
  const bucket = p.data.purpose === 'review' ? 'media' : 'customer-uploads';
  const path = `${p.data.purpose}s/${user?.id ?? 'guest'}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: 'Upload is unavailable right now' }, { status: 500 });
  const publicUrl = bucket === 'media' ? supabaseAdmin().storage.from(bucket).getPublicUrl(path).data.publicUrl : null;
  return NextResponse.json({ bucket, path, token: data.token, signedUrl: data.signedUrl, publicUrl });
}
