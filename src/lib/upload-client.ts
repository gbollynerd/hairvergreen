'use client';
import { supabaseBrowser } from '@/lib/supabase/client';

/** Uploads a file directly to Supabase Storage via a server-issued signed URL. */
export async function uploadFile(purpose: 'review' | 'consultation' | 'return', file: File) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Files must be under 20MB');
  const r = await fetch('/api/uploads/sign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ purpose, filename: file.name, contentType: file.type }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Upload failed');
  const { error } = await supabaseBrowser().storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return { bucket: d.bucket as string, path: d.path as string, publicUrl: d.publicUrl as string | null };
}
