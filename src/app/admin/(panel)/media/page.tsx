import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/admin/ui';
import { MediaLibrary } from './media-library';

const PER = 60;

export default async function MediaPage({ searchParams }: PageProps<'/admin/media'>) {
  const staff = await requireStaffPage('media.upload');
  const sp = await searchParams;
  const folder = typeof sp.folder === 'string' ? sp.folder : '';
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 80) : '';
  const kind = typeof sp.kind === 'string' ? sp.kind : '';
  const tag = typeof sp.tag === 'string' ? sp.tag : '';
  const page = Math.max(1, Number(sp.page) || 1);
  const db = supabaseAdmin();
  let query = db.from('media').select('id, url, alt, title, filename, kind, mime_type, width, height, size_bytes, tags, folder_id, created_at', { count: 'exact' })
    .order('created_at', { ascending: false }).range((page - 1) * PER, page * PER - 1);
  if (folder === 'none') query = query.is('folder_id', null);
  else if (folder) query = query.eq('folder_id', folder);
  if (kind === 'image' || kind === 'video' || kind === 'file') query = query.eq('kind', kind);
  if (tag) query = query.contains('tags', [tag]);
  if (q) { const s = q.replace(/[%,()]/g, ' '); query = query.or(`alt.ilike.%${s}%,title.ilike.%${s}%,filename.ilike.%${s}%`); }
  const [{ data: items, count }, { data: folders }, { data: allTags }] = await Promise.all([
    query, db.from('media_folders').select('id, name, parent_id').order('name'), db.from('media').select('tags').limit(2000),
  ]);
  const tags = [...new Set((allTags ?? []).flatMap((m) => m.tags ?? []))].sort();
  return (
    <>
      <PageHeader title="Media library" description="Every image and video used across the store. Keep alt text descriptive — it helps accessibility and search." />
      <MediaLibrary items={items ?? []} total={count ?? 0} page={page} perPage={PER} folders={folders ?? []} tags={tags}
        filters={{ folder, q, kind, tag }} canDelete={staff.permissions.has('media.delete')} />
    </>
  );
}
