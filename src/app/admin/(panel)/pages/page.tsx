import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card, Table, Td, Badge } from '@/components/admin/ui';
import { ActionForm, Submit, Field } from '@/components/admin/client';
import { formatDateTime } from '@/lib/utils';
import { createPage } from './actions';
import { pageUrl } from '@/lib/admin/section-schema';

export default async function Pages() {
  const staff = await requireStaffPage('content.edit');
  const db = supabaseAdmin();
  const [{ data: pages }, { data: secs }] = await Promise.all([
    db.from('pages').select('id, title, slug, kind, status, updated_at').order('kind').order('title'),
    db.from('page_sections').select('page_id'),
  ]);
  const count = (secs ?? []).reduce<Record<string, number>>((a, s) => ((a[s.page_id] = (a[s.page_id] ?? 0) + 1), a), {});
  const KIND: Record<string, string> = { home: 'Homepage', page: 'Page', landing: 'Landing page', policy: 'Policy' };
  return (
    <>
      <PageHeader title="Pages & homepage" description="Build the homepage and content pages from sections. Reorder, hide or edit any section without touching code." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Table head={['Page', 'Type', 'URL', 'Sections', 'Status', 'Updated']}>
          {(pages ?? []).map((p) => (
            <tr key={p.id} className="hover:bg-bg/50">
              <Td><Link href={`/admin/pages/${p.id}`} className="font-medium underline">{p.title}</Link></Td>
              <Td>{KIND[p.kind] ?? p.kind}</Td>
              <Td className="text-muted">{pageUrl(p)}</Td>
              <Td>{count[p.id] ?? 0}</Td>
              <Td><Badge tone={p.status === 'published' ? 'green' : 'gold'}>{p.status}</Badge></Td>
              <Td className="text-muted">{formatDateTime(p.updated_at)}</Td>
            </tr>
          ))}
        </Table>
        {staff.permissions.has('content.create') && (
          <Card title="New page">
            <ActionForm action={createPage} className="grid gap-4">
              <Field label="Title"><input name="title" required className="input" placeholder="e.g. Bridal Hair" /></Field>
              <Field label="URL" hint="Leave blank to generate from the title"><input name="slug" className="input" placeholder="bridal-hair" /></Field>
              <Field label="Type"><select name="kind" className="input"><option value="page">Page</option><option value="landing">Landing page</option><option value="policy">Policy</option></select></Field>
              <Submit>Create page</Submit>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
