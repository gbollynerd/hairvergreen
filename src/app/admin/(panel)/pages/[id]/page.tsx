import { notFound } from 'next/navigation';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card, Badge } from '@/components/admin/ui';
import { ActionForm, Submit, Field, Toggle, MediaField, ActionButton } from '@/components/admin/client';
import { RichText } from '@/components/admin/rich-text';
import { pageUrl } from '@/lib/admin/section-schema';
import { PageBuilder } from './page-builder';
import { savePageMeta, deletePage, duplicatePage } from '../actions';

export default async function EditPage({ params }: PageProps<'/admin/pages/[id]'>) {
  const staff = await requireStaffPage('content.edit');
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: page } = await db.from('pages').select('*, og:og_image_id (id, url)').eq('id', id).maybeSingle();
  if (!page) notFound();
  const [{ data: sections }, { data: cols }, { data: cats }] = await Promise.all([
    db.from('page_sections').select('id, type, name, is_visible, settings').eq('page_id', id).order('sort'),
    db.from('collections').select('slug, name').order('sort'),
    db.from('categories').select('slug, name, parent_id').order('sort'),
  ]);
  const canPublish = staff.permissions.has('content.publish');
  const url = pageUrl(page);
  const og = page.og as { id: string; url: string } | null;

  return (
    <>
      <PageHeader back={{ href: '/admin/pages', label: 'Pages' }} title={page.title}
        description={<>{url} · <Badge tone={page.status === 'published' ? 'green' : 'gold'}>{page.status}</Badge></>}
        actions={<>
          <a href={`/admin/pages/${id}/preview`} target="_blank" className="btn btn-outline btn-sm">Preview</a>
          {page.status === 'published' && <a href={url} target="_blank" rel="noopener" className="btn btn-outline btn-sm">View live</a>}
          {staff.permissions.has('content.create') && <ActionButton action={duplicatePage.bind(null, id)}>Duplicate</ActionButton>}
          {canPublish && page.kind !== 'home' && <ActionButton variant="danger" confirm="Delete this page and all its sections? This cannot be undone." action={deletePage.bind(null, id)}>Delete</ActionButton>}
        </>} />

      <PageBuilder pageId={id} canEdit initial={(sections ?? []).map((s) => ({ id: s.id, type: s.type, name: s.name ?? '', is_visible: s.is_visible, settings: (s.settings ?? {}) as Record<string, unknown> }))}
        collections={cols ?? []} categories={(cats ?? []).map((c) => ({ slug: c.slug, name: c.parent_id ? `— ${c.name}` : c.name }))} />

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card title="Page details & SEO">
          <ActionForm action={savePageMeta} className="grid gap-4">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="body" value={page.body ?? ''} />
            <Field label="Title"><input name="title" defaultValue={page.title} required className="input" /></Field>
            {page.kind !== 'home' && <Field label="URL slug" hint={`Live at ${url}`}><input name="slug" defaultValue={page.slug} className="input" /></Field>}
            <Field label="Status" hint={canPublish ? undefined : 'Ask an admin or editor to publish.'}>
              <select name="status" defaultValue={page.status} className="input" disabled={!canPublish}><option value="draft">Draft</option><option value="published">Published</option></select>
              {!canPublish && <input type="hidden" name="status" value={page.status} />}
            </Field>
            <Field label="SEO title" hint="Shown in search results and browser tabs"><input name="seo_title" defaultValue={page.seo_title ?? ''} maxLength={70} className="input" /></Field>
            <Field label="Meta description" hint="Around 150 characters"><textarea name="seo_description" defaultValue={page.seo_description ?? ''} maxLength={320} className="input !min-h-[80px]" /></Field>
            <Field label="Social share image"><MediaField name="_og_url" idName="og_image_id" defaultUrl={og?.url} defaultId={og?.id} kind="image" /></Field>
            <Toggle name="noindex" defaultChecked={page.noindex} label="Hide from search engines (noindex)" />
            <Submit>Save details</Submit>
          </ActionForm>
        </Card>
        {page.kind !== 'home' && (
          <Card title="Page body">
            <p className="mb-3 text-[13px] text-muted">Used when the page has no sections — ideal for policies and simple text pages.</p>
            <ActionForm action={savePageMeta} className="grid gap-4">
              <input type="hidden" name="id" value={id} />
              {/* keep the other fields unchanged */}
              <input type="hidden" name="title" value={page.title} /><input type="hidden" name="slug" value={page.slug} /><input type="hidden" name="status" value={page.status} />
              <input type="hidden" name="seo_title" value={page.seo_title ?? ''} /><input type="hidden" name="seo_description" value={page.seo_description ?? ''} />
              <input type="hidden" name="og_image_id" value={page.og_image_id ?? ''} />{page.noindex && <input type="hidden" name="noindex" value="on" />}
              <RichText name="body" defaultValue={page.body ?? ''} minHeight={320} />
              <div><Submit>Save body</Submit></div>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
