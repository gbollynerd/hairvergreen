import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaffPage, requireAnyPermission } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { RESOURCES, type ColumnDef } from '@/lib/admin/resources';
import { PageHeader, Table, Td, Badge, FilterBar, FilterSelect, FilterInput, Pagination } from '@/components/admin/ui';
import { formatMoney } from '@/lib/money';
import { formatDate, formatDateTime, titleCase } from '@/lib/utils';
import { loadOptions } from './options';

const PER = 50;
const get = (row: Record<string, any>, path: string) => path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), row);

function Cell({ c, row }: { c: ColumnDef; row: Record<string, any> }) {
  const v = get(row, c.name);
  switch (c.format) {
    case 'money': return <>{v == null ? '—' : formatMoney(v)}</>;
    case 'date': return <>{formatDate(v)}</>;
    case 'datetime': return <>{v ? formatDateTime(v) : '—'}</>;
    case 'boolean': return v ? <Badge tone="green">Yes</Badge> : <Badge>No</Badge>;
    case 'badge': return v ? <Badge tone={['new', 'active', 'requested'].includes(v) ? 'gold' : 'gray'}>{titleCase(String(v))}</Badge> : <>—</>;
    case 'image': return v ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={v} alt="" className="h-12 w-12 object-cover" /> : <>—</>;
    case 'list': return <>{Array.isArray(v) && v.length ? v.join(', ') : '—'}</>;
    case 'count': return <>{Array.isArray(v) ? (v[0]?.count ?? v.length) : 0}</>;
    case 'discount': return <>{row.kind === 'percentage' ? `${v}%` : row.kind === 'fixed' ? `₦${Number(v).toLocaleString('en-NG')}` : row.kind === 'tiered' ? 'Tiers' : row.kind === 'free_shipping' ? 'Free shipping' : `Buy ${row.buy_quantity} get ${row.get_quantity}`}</>;
    default: return <>{v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</>;
  }
}

export default async function ResourceList({ params, searchParams }: PageProps<'/admin/[resource]'>) {
  const { resource } = await params;
  const def = RESOURCES[resource];
  if (!def) notFound();
  await requireStaffPage();
  try { await requireAnyPermission(...(Array.isArray(def.permission) ? def.permission : [def.permission])); } catch { notFound(); }
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  let q = supabaseAdmin().from(def.table).select(def.select ?? '*', { count: 'exact' }).range((page - 1) * PER, page * PER - 1);
  for (const [col, asc] of def.orderBy) q = q.order(col, { ascending: asc, nullsFirst: false });
  const term = typeof sp.q === 'string' ? sp.q.trim().replace(/[%,()]/g, '') : '';
  if (term && def.searchable?.length) q = q.or(def.searchable.map((c) => `${c}.ilike.%${term}%`).join(','));
  for (const f of def.filters ?? []) if (typeof sp[f.name] === 'string' && sp[f.name]) q = q.eq(f.name, sp[f.name] as string);
  const [{ data, count }, opts] = await Promise.all([q, loadOptions(def)]);
  const filters = (def.filters ?? []).map((f) => (f.name === 'zone_id' ? { ...f, options: opts.shipping_zones ?? [] } : f));
  const exportKind = { newsletter: 'subscribers', expenses: 'expenses' }[resource];
  const params2 = new URLSearchParams(Object.entries(sp).filter(([k, v]) => typeof v === 'string' && k !== 'page') as [string, string][]);
  return (
    <>
      <PageHeader title={def.title} description={def.description}
        actions={<>{exportKind && <a href={`/api/admin/export/${exportKind}`} className="btn btn-outline btn-sm">Export CSV</a>}{!def.noCreate && <Link href={`/admin/${resource}/new`} className="btn btn-primary btn-sm">New {def.singular}</Link>}</>} />
      {resource === 'shipping-zones' && <p className="-mt-4 mb-6 text-[13px]"><Link href="/admin/shipping-methods" className="underline">Manage shipping methods & rates →</Link></p>}
      {resource === 'categories' && <p className="-mt-4 mb-6 text-[13px]"><Link href="/admin/attributes" className="underline">Manage textures, lengths & other attributes →</Link></p>}
      {(def.searchable?.length || filters.length > 0) && (
        <FilterBar>
          {def.searchable?.length ? <FilterInput name="q" label="Search" value={term} /> : null}
          {filters.map((f) => <FilterSelect key={f.name} name={f.name} label={f.label} value={sp[f.name] as string} options={f.options} />)}
          <button className="btn btn-primary btn-sm">Filter</button>
        </FilterBar>
      )}
      <Table head={[...def.columns.map((c) => c.label), '']} empty={`No ${def.title.toLowerCase()} yet.`}>
        {((data ?? []) as unknown as Record<string, any>[]).map((row) => (
          <tr key={row.id} className="hover:bg-bg/50">
            {def.columns.map((c, i) => <Td key={c.name} className={i === 0 ? 'font-medium' : ''}>{i === 0 ? <Link href={`/admin/${resource}/${row.id}`} className="underline"><Cell c={c} row={row} /></Link> : <Cell c={c} row={row} />}</Td>)}
            <Td><Link href={`/admin/${resource}/${row.id}`} className="text-[12px] underline">Edit</Link></Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} total={count ?? 0} perPage={PER} href={(p) => `/admin/${resource}?${new URLSearchParams({ ...Object.fromEntries(params2), page: String(p) })}`} />
    </>
  );
}
