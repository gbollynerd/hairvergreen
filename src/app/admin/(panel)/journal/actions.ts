'use server';
import { revalidateTag } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, str, bool, json, refreshStore, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';
import { sanitizeHtml } from '@/lib/sanitize';
import { isUuid, slugify } from '@/lib/utils';
import type { StaffContext } from '@/lib/auth';

const canEditPost = (staff: StaffContext, post: { author_id: string | null }) =>
  staff.permissions.has('blog.edit_any') || (staff.permissions.has('blog.edit_own') && post.author_id === staff.id);

function bust(slug?: string) {
  refreshStore('content');
  try { revalidateTag('posts', 'max'); if (slug) revalidateTag(`post:${slug}`, 'max'); } catch { /* ignore */ }
}

export async function createPost(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('blog.create', async (staff) => {
    const title = str(fd, 'title');
    if (!title) return { error: 'Give the post a title' };
    const base = slugify(title);
    const { data: clash } = await supabaseAdmin().from('blog_posts').select('id').eq('slug', base).maybeSingle();
    const slug = clash ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base;
    const { data, error } = await supabaseAdmin().from('blog_posts').insert({ title, slug, status: 'draft', author_id: staff.id, author_name: staff.name || null }).select('id').single();
    if (error) throw error;
    await audit(staff, { action: 'create', entityType: 'blog_post', entityId: data.id, summary: `Created post ${title}` });
    return { ok: true, message: 'Draft created', redirect: `/admin/journal/${data.id}` };
  });
}

export async function savePost(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded(['blog.create', 'blog.edit_own', 'blog.edit_any'], async (staff) => {
    const id = str(fd, 'id');
    if (!isUuid(id)) return { error: 'Invalid post' };
    const db = supabaseAdmin();
    const { data: before } = await db.from('blog_posts').select('*').eq('id', id).single();
    if (!before) return { error: 'Post not found' };
    if (!canEditPost(staff, before)) return { error: 'You can only edit your own posts' };

    const canPublish = staff.permissions.has('blog.publish');
    let status = str(fd, 'status');
    if (!['draft', 'review', 'scheduled', 'published'].includes(status)) status = before.status;
    // Admin enters Lagos time (WAT, UTC+1, no DST)
    const local = str(fd, 'published_at_local');
    let publishedAt: string | null = local && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? new Date(`${local}:00+01:00`).toISOString() : null;
    const wantsLive = status === 'published' || status === 'scheduled';
    const wasLive = before.status === 'published' || before.status === 'scheduled';
    if ((wantsLive || wasLive) && status !== before.status && !canPublish) return { error: 'You do not have permission to publish. Set the status to “In review” and an editor will publish it.' };
    if (wasLive && !canPublish) return { error: 'This post is live — ask an editor to make changes.' };
    if (status === 'scheduled') {
      if (!publishedAt || new Date(publishedAt) <= new Date()) return { error: 'Choose a future date and time to schedule the post' };
      status = 'published'; // future-dated published posts go live automatically
    }
    if (status === 'published' && !publishedAt) publishedAt = before.published_at && new Date(before.published_at) <= new Date() ? before.published_at : new Date().toISOString();

    const body = sanitizeHtml(str(fd, 'body'));
    const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    const slug = slugify(str(fd, 'slug') || before.slug);
    const patch = {
      title: str(fd, 'title') || before.title, slug, excerpt: str(fd, 'excerpt') || null, body,
      category_id: isUuid(str(fd, 'category_id')) ? str(fd, 'category_id') : null,
      tags: json<string[]>(fd, 'tags', []).map((t) => t.toLowerCase().slice(0, 40)).slice(0, 20),
      featured_image_id: isUuid(str(fd, 'featured_image_id')) ? str(fd, 'featured_image_id') : null,
      video_url: str(fd, 'video_url') || null,
      author_name: str(fd, 'author_name') || null,
      status, published_at: status === 'published' ? publishedAt : before.published_at,
      related_product_ids: fd.getAll('related_product_ids').map(String).filter(isUuid).slice(0, 12),
      reading_minutes: Math.max(1, Math.round(words / 220)),
      seo_title: str(fd, 'seo_title') || null, seo_description: str(fd, 'seo_description') || null, noindex: bool(fd, 'noindex'),
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from('blog_posts').update(patch).eq('id', id);
    if (error) throw error;
    const action = status !== before.status ? (status === 'published' ? 'publish' : status === 'review' ? 'submit_review' : 'status') : 'update';
    await audit(staff, { action, entityType: 'blog_post', entityId: id, summary: `Post ${patch.title} (${status})`, before, after: { ...before, ...patch } });
    bust(before.slug); if (slug !== before.slug) bust(slug);
    const future = status === 'published' && patch.published_at && new Date(patch.published_at) > new Date();
    return { ok: true, message: future ? 'Post scheduled' : status === 'published' ? 'Post published' : status === 'review' ? 'Submitted for review' : 'Draft saved' };
  });
}

export async function deletePost(id: string): Promise<ActionResult> {
  return guarded(['blog.edit_own', 'blog.edit_any'], async (staff) => {
    if (!isUuid(id)) return { error: 'Invalid post' };
    const db = supabaseAdmin();
    const { data: post } = await db.from('blog_posts').select('*').eq('id', id).single();
    if (!post) return { error: 'Post not found' };
    if (!canEditPost(staff, post)) return { error: 'You can only delete your own posts' };
    if (post.status === 'published' && !staff.permissions.has('blog.publish')) return { error: 'Ask an editor to remove a published post' };
    await db.from('blog_posts').delete().eq('id', id);
    await audit(staff, { action: 'delete', entityType: 'blog_post', entityId: id, summary: `Deleted post ${post.title}`, before: post });
    bust(post.slug);
    return { ok: true, message: 'Post deleted', redirect: '/admin/journal' };
  });
}
