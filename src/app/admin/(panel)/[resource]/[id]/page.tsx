import { notFound } from 'next/navigation';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { RESOURCES } from '@/lib/admin/resources';
import { PageHeader } from '@/components/admin/ui';
import { ActionButton } from '@/components/admin/client';
import { ResourceForm } from './resource-form';
import { saveResource, deleteResource } from '../actions';
import { loadOptions } from '../options';

export default async function ResourceEdit({ params }: PageProps<'/admin/[resource]/[id]'>) {
  const { resource, id } = await params;
  const def = RESOURCES[resource];
  if (!def) notFound();
  const staff = await requireStaffPage();
  const perms = Array.isArray(def.permission) ? def.permission : [def.permission];
  if (!perms.some((p) => staff.permissions.has(p))) notFound();
  const db = supabaseAdmin();
  let row: Record<string, any> = {};
  if (id !== 'new') {
    const { data } = await db.from(def.table).select('*').eq('id', id).maybeSingle();
    if (!data) notFound();
    row = data;
    if (resource === 'discounts') { const k = row.applies_to === 'products' ? 'target_products' : row.applies_to === 'categories' ? 'target_categories' : 'target_collections'; row[k] = row.target_ids ?? []; row.customer_emails = (row.customer_emails ?? []).join(', '); }
    if (resource === 'popups') { row.style_layout = row.style?.layout; row.style_background = row.style?.background; }
    if (resource === 'collections') { const { data: cp } = await db.from('collection_products').select('product_id').eq('collection_id', id).order('sort'); row._products = (cp ?? []).map((x) => x.product_id); }
    if (resource === 'consultations' && Array.isArray(row.reference_media)) {
      row._reference_urls = (await Promise.all(row.reference_media.map(async (m: { bucket: string; path: string }) => (await db.storage.from(m.bucket).createSignedUrl(m.path, 3600)).data?.signedUrl))).filter(Boolean);
    }
  } else {
    if (def.noCreate) notFound();
    for (const f of def.fields) if (f.default !== undefined) row[f.name] = f.default;
    if (resource === 'expenses') row.spent_on = new Date().toISOString().slice(0, 10);
  }
  const mediaIds = def.fields.filter((f) => f.type === 'mediaId').map((f) => row[f.name]).filter(Boolean);
  const { data: media } = mediaIds.length ? await db.from('media').select('id, url').in('id', mediaIds) : { data: [] };
  const options = await loadOptions(def);
  const canDelete = id !== 'new' && staff.permissions.has(def.deletePermission ?? perms[0]);
  const title = id === 'new' ? `New ${def.singular}` : String(row[def.titleField] ?? def.singular);
  return (
    <>
      <PageHeader back={{ href: `/admin/${resource}`, label: def.title }} title={title}
        actions={canDelete && <ActionButton variant="danger" confirm={`Delete this ${def.singular}?`} action={deleteResource.bind(null, resource, id)}>Delete</ActionButton>} />
      {resource === 'messages' && row.email && <p className="mb-4"><a href={`mailto:${row.email}?subject=${encodeURIComponent('Re: ' + (row.subject || 'Your message to Hairver Green'))}`} className="btn btn-primary btn-sm">Reply by email</a></p>}
      {resource === 'consultations' && row.email && <p className="mb-4 flex gap-2"><a href={`mailto:${row.email}`} className="btn btn-primary btn-sm">Email</a>{row.phone && <a href={`https://wa.me/${String(row.phone).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">WhatsApp</a>}</p>}
      <ResourceForm def={def} row={row} options={options} media={Object.fromEntries((media ?? []).map((m) => [m.id, m.url]))} action={saveResource.bind(null, resource, id)} />
      {row._reference_urls?.length > 0 && <div className="mt-6"><p className="label mb-2">Reference photos</p><div className="flex flex-wrap gap-2">{row._reference_urls.map((u: string, i: number) => <a key={i} href={u} target="_blank" rel="noopener noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt={`Reference ${i + 1}`} className="h-32 w-32 object-cover" /></a>)}</div></div>}
    </>
  );
}
