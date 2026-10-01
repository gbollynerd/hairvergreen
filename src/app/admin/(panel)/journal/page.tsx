import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card, Table, Td, Badge, FilterBar, FilterSelect, FilterInput } from '@/components/admin/ui';
import { ActionForm, Submit, Field } from '@/components/admin/client';
import { formatDateTime } from '@/lib/utils';
import { createPost } from './actions';
import { postState } from './status';

export default async function Journal({ searchParams }: PageProps<'/admin/journal'>) {
  const staff = await requireStaffPage(['blog.create', 'blog.edit_own', 'blog.edit_any']);
  const sp = await searchParams;
  const status = typeof sp.status === 'string' ? sp.status : '';
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const db = supabaseAdmin();
  let query = db.from('blog_posts').select('id, title, slug, status, published_at, updated_at, author_id, author_name, category:category_id (name)').order('updated_at', { ascending: false }).limit(200);
  if (status) query = query.eq('status', status);
  if (q) query = query.ilike('title', `%${q.replace(/[%,()]/g, ' ')}%`);
  const onlyOwn = !staff.permissions.has('blog.edit_any');
  if (onlyOwn) query = query.eq('author_id', staff.id);
  const { data: posts } = await query;
  return (
    <>
      <PageHeader title="Hair Journal" description={onlyOwn ? 'Your posts. Submit drafts for review and an editor will publish them.' : 'Write, review, schedule and publish Hair Journal posts.'} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div>
          <FilterBar>
            <FilterInput name="q" label="Search" value={q} placeholder="Title" />
            <FilterSelect name="status" label="Status" value={status} options={[['draft', 'Draft'], ['review', 'In review'], ['published', 'Published / scheduled']]} />
            <button className="btn btn-outline btn-sm">Filter</button>
          </FilterBar>
          <Table head={['Title', 'Category', 'Author', 'Status', 'Publish date', 'Updated']} empty="No posts yet.">
            {(posts ?? []).map((p: any) => {
              const st = postState(p);
              return (
                <tr key={p.id} className="hover:bg-bg/50">
                  <Td><Link href={`/admin/journal/${p.id}`} className="font-medium underline">{p.title}</Link></Td>
                  <Td>{p.category?.name ?? '—'}</Td><Td>{p.author_name ?? '—'}</Td>
                  <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                  <Td className="text-muted">{p.published_at ? formatDateTime(p.published_at) : '—'}</Td>
                  <Td className="text-muted">{formatDateTime(p.updated_at)}</Td>
                </tr>
              );
            })}
          </Table>
        </div>
        {staff.permissions.has('blog.create') && (
          <Card title="New post">
            <ActionForm action={createPost} className="grid gap-4">
              <Field label="Title"><input name="title" required className="input" placeholder="How to care for your body wave unit" /></Field>
              <Submit>Create draft</Submit>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
