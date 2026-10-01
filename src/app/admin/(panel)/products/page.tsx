import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Pagination, FilterBar, FilterSelect, FilterInput } from '@/components/admin/ui';
import { ActionButton } from '@/components/admin/client';
import { ProductTable } from './product-table';
import { createProduct } from './actions';
import { titleCase } from '@/lib/utils';

const PER = 40;
export default async function Products({ searchParams }: PageProps<'/admin/products'>) {
  const staff = await requireStaffPage('products.view');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const db = supabaseAdmin();
  const q = typeof sp.q === 'string' ? sp.q.trim().replace(/[%,()]/g, '') : '';
  let query = db.from('products').select('id, name, slug, status, product_type, price, is_featured, updated_at, category:category_id (name), product_media (sort, media:media_id (url, kind, metadata)), product_variants (id, stock_on_hand, stock_reserved, track_inventory, is_active)', { count: 'exact' })
    .order('updated_at', { ascending: false }).range((page - 1) * PER, page * PER - 1);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,slug.ilike.%${q}%`);
  if (typeof sp.status === 'string' && sp.status) query = query.eq('status', sp.status);
  if (typeof sp.type === 'string' && sp.type) query = query.eq('product_type', sp.type);
  if (typeof sp.category === 'string' && sp.category) query = query.eq('category_id', sp.category);
  const [{ data, count }, { data: cats }] = await Promise.all([query, db.from('categories').select('id, name').order('sort')]);
  const rows = (data ?? []).map((p: any) => ({
    id: p.id, name: p.name, slug: p.slug, status: p.status, type: p.product_type, price: p.price, category: p.category?.name ?? '—', featured: p.is_featured,
    image: [...(p.product_media ?? [])].sort((a: any, b: any) => a.sort - b.sort).map((m: any) => (m.media?.kind === 'video' ? m.media.metadata?.poster : m.media?.url)).find(Boolean) ?? null,
    variants: (p.product_variants ?? []).filter((v: any) => v.is_active).length,
    stock: (p.product_variants ?? []).filter((v: any) => v.track_inventory && v.is_active).reduce((s: number, v: any) => s + v.stock_on_hand - v.stock_reserved, 0),
    tracked: (p.product_variants ?? []).some((v: any) => v.track_inventory), updated_at: p.updated_at,
  }));
  const isBundles = sp.type === 'bundle_deal';
  const params = new URLSearchParams(Object.entries(sp).filter(([k, v]) => typeof v === 'string' && k !== 'page') as [string, string][]);
  return (
    <>
      <PageHeader title={isBundles ? 'Bundles & set deals' : 'Products'} description={isBundles ? 'Build-your-bundle offers and fixed-price sets. Stock is taken from the component products.' : 'Every product, variant and price on the store comes from here.'}
        actions={staff.permissions.has('products.create') && <>
          <ActionButton variant="primary" action={createProduct.bind(null, isBundles ? 'bundle_deal' : 'hair')}>{isBundles ? 'New bundle' : 'New product'}</ActionButton>
          {!isBundles && <ActionButton action={createProduct.bind(null, 'wig')}>New wig</ActionButton>}
        </>} />
      <FilterBar>
        <FilterInput name="q" label="Search" value={q} placeholder="Name, SKU, slug" />
        <FilterSelect name="status" label="Status" value={sp.status as string} options={[['active', 'Active'], ['draft', 'Draft'], ['hidden', 'Hidden'], ['archived', 'Archived']]} />
        <FilterSelect name="type" label="Type" value={sp.type as string} options={['hair', 'wig', 'bundle_deal', 'accessory', 'custom_unit'].map((t) => [t, titleCase(t)])} />
        <FilterSelect name="category" label="Category" value={sp.category as string} options={(cats ?? []).map((c) => [c.id, c.name])} />
        <button className="btn btn-primary btn-sm">Filter</button><Link href="/admin/products" className="btn btn-outline btn-sm">Reset</Link>
      </FilterBar>
      <ProductTable rows={rows} canPublish={staff.permissions.has('products.publish')} />
      <Pagination page={page} total={count ?? 0} perPage={PER} href={(p) => `/admin/products?${new URLSearchParams({ ...Object.fromEntries(params), page: String(p) })}`} />
    </>
  );
}
