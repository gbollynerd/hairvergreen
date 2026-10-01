import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Table, Td, FilterBar, FilterInput, FilterSelect, Pagination } from '@/components/admin/ui';
import { formatDateTime, titleCase } from '@/lib/utils';

const PER = 50;

export default async function Audit({ searchParams }: PageProps<'/admin/audit'>) {
  await requireStaffPage('audit.view');
  const sp = await searchParams;
  const actor = typeof sp.actor === 'string' ? sp.actor.trim() : '';
  const entity = typeof sp.entity === 'string' ? sp.entity : '';
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const page = Math.max(1, Number(sp.page) || 1);
  const db = supabaseAdmin();
  let query = db.from('audit_logs').select('id, actor_email, action, entity_type, entity_id, summary, before, after, ip, created_at', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PER, page * PER - 1);
  const clean = (v: string) => v.replace(/[%,()]/g, ' ');
  if (actor) query = query.ilike('actor_email', `%${clean(actor)}%`);
  if (entity) query = query.eq('entity_type', entity);
  if (q) query = query.ilike('summary', `%${clean(q)}%`);
  const [{ data, count }, { data: types }] = await Promise.all([query, db.from('audit_logs').select('entity_type').limit(5000)]);
  const entities = [...new Set((types ?? []).map((t) => t.entity_type))].sort();
  const href = (p: number) => `/admin/audit?${new URLSearchParams({ actor, entity, q, page: String(p) })}`;
  return (
    <>
      <PageHeader title="Audit log" description="A permanent record of who changed what in the admin — orders, refunds, prices, content, staff and settings." />
      <FilterBar>
        <FilterInput name="q" label="Search" value={q} placeholder="Summary" />
        <FilterInput name="actor" label="Staff email" value={actor} />
        <FilterSelect name="entity" label="Area" value={entity} options={entities.map((e) => [e, titleCase(e)])} />
        <button className="btn btn-outline btn-sm">Filter</button>
      </FilterBar>
      <Table head={['When', 'Who', 'Action', 'What', 'Details']} empty="Nothing recorded yet.">
        {(data ?? []).map((l) => (
          <tr key={l.id} className="align-top">
            <Td className="whitespace-nowrap text-muted">{formatDateTime(l.created_at)}</Td>
            <Td>{l.actor_email ?? 'System'}{l.ip && <span className="block text-[11px] text-muted">{l.ip}</span>}</Td>
            <Td>{titleCase(l.action)}</Td>
            <Td>{titleCase(l.entity_type)}<span className="block text-[12px] text-muted">{l.summary}</span></Td>
            <Td>{(l.before || l.after) ? (
              <details className="text-[12px]"><summary className="cursor-pointer underline">Changes</summary>
                <pre className="mt-2 max-h-72 max-w-[480px] overflow-auto whitespace-pre-wrap bg-bg p-3 font-mono text-[11px]">{JSON.stringify({ before: l.before ?? undefined, after: l.after ?? undefined }, null, 2)}</pre>
              </details>) : '—'}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} total={count ?? 0} perPage={PER} href={href} />
    </>
  );
}
