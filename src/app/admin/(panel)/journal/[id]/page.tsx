import { notFound } from 'next/navigation';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card, Badge } from '@/components/admin/ui';
import { ActionForm, Submit, Field, Toggle, TagsInput, MediaField, ActionButton } from '@/components/admin/client';
import { RichText } from '@/components/admin/rich-text';
import { postState } from '../status';
import { savePost, deletePost } from '../actions';

const toLocal = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16); }; // WAT (UTC+1)

export default async function EditPost({ params }: PageProps<'/admin/journal/[id]'>) {
  const staff = await requireStaffPage(['blog.create', 'blog.edit_own', 'blog.edit_any']);
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: post } = await db.from('blog_posts').select('*, img:featured_image_id (id, url)').eq('id', id).maybeSingle();
  if (!post) notFound();
  const canEdit = staff.permissions.has('blog.edit_any') || (staff.permissions.has('blog.edit_own') && post.author_id === staff.id);
  if (!canEdit) notFound();
  const canPublish = staff.permissions.has('blog.publish');
  const live = post.status === 'published' || post.status === 'scheduled';
  const locked = live && !canPublish;
  const [{ data: cats }, { data: products }] = await Promise.all([
    db.from('blog_categories').select('id, name').order('sort'),
    db.from('products').select('id, name').eq('status', 'active').order('name'),
  ]);
  const st = postState(post);
  const img = post.img as { id: string; url: string } | null;
  const future = post.published_at && new Date(post.published_at) > new Date();

  return (
    <>
      <PageHeader back={{ href: '/admin/journal', label: 'Hair Journal' }} title={post.title} description={<><Badge tone={st.tone}>{st.label}</Badge> · /journal/{post.slug}</>}
        actions={<>
          {post.status === 'published' && !future && <a href={`/journal/${post.slug}`} target="_blank" className="btn btn-outline btn-sm">View live</a>}
          {!locked && <ActionButton variant="danger" confirm="Delete this post? This cannot be undone." action={deletePost.bind(null, id)}>Delete</ActionButton>}
        </>} />
      {locked && <p className="mb-5 border border-line bg-panel px-4 py-3 text-[13px]">This post is live. Only editors with publishing permission can change it.</p>}
      <ActionForm action={savePost} className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <input type="hidden" name="id" value={id} />
        <fieldset disabled={locked} className="grid min-w-0 gap-5">
          <Field label="Title"><input name="title" defaultValue={post.title} required className="input font-display !text-[24px]" /></Field>
          <Field label="Excerpt" hint="One or two sentences shown on the journal page and in search results"><textarea name="excerpt" defaultValue={post.excerpt ?? ''} maxLength={400} className="input !min-h-[70px]" /></Field>
          <Field label="Body"><RichText name="body" defaultValue={post.body} minHeight={420} /></Field>
          <Card title="SEO">
            <div className="grid gap-4">
              <Field label="URL slug"><input name="slug" defaultValue={post.slug} className="input" /></Field>
              <Field label="SEO title"><input name="seo_title" defaultValue={post.seo_title ?? ''} maxLength={70} className="input" /></Field>
              <Field label="Meta description"><textarea name="seo_description" defaultValue={post.seo_description ?? ''} maxLength={320} className="input !min-h-[70px]" /></Field>
              <Toggle name="noindex" defaultChecked={post.noindex} label="Hide from search engines" />
            </div>
          </Card>
        </fieldset>
        <fieldset disabled={locked} className="grid content-start gap-5">
          <Card title="Publishing">
            <div className="grid gap-4">
              <Field label="Status">
                <select name="status" defaultValue={future ? 'scheduled' : post.status} className="input">
                  <option value="draft">Draft</option>
                  <option value="review">In review</option>
                  {canPublish && <option value="scheduled">Scheduled</option>}
                  {canPublish && <option value="published">Published</option>}
                </select>
              </Field>
              <Field label="Publish date (Lagos time)" hint="Required for scheduling. Leave blank to publish now."><input type="datetime-local" name="published_at_local" defaultValue={toLocal(post.published_at)} className="input" /></Field>
              {!canPublish && <p className="text-[12px] text-muted">Set the status to “In review” when it is ready. An editor will publish it.</p>}
              <Submit>Save post</Submit>
            </div>
          </Card>
          <Card title="Organise">
            <div className="grid gap-4">
              <Field label="Category"><select name="category_id" defaultValue={post.category_id ?? ''} className="input"><option value="">—</option>{(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Tags"><TagsInput name="tags" defaultValue={post.tags ?? []} /></Field>
              <Field label="Author name" hint="Shown on the post"><input name="author_name" defaultValue={post.author_name ?? ''} className="input" /></Field>
            </div>
          </Card>
          <Card title="Media">
            <div className="grid gap-4">
              <Field label="Featured image"><MediaField name="_img" idName="featured_image_id" defaultUrl={img?.url} defaultId={img?.id} kind="image" /></Field>
              <Field label="Video URL (optional)"><input name="video_url" defaultValue={post.video_url ?? ''} className="input" placeholder="https://…" /></Field>
            </div>
          </Card>
          <Card title="Shop the post">
            <Field label="Related products" hint="Hold Ctrl / Cmd to select several">
              <select name="related_product_ids" multiple defaultValue={post.related_product_ids ?? []} className="input !h-48">
                {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </Card>
        </fieldset>
      </ActionForm>
    </>
  );
}
