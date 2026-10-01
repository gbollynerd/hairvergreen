import Link from 'next/link';
import { listProducts, getAttrMap, toCard, type ListingFilters } from '@/lib/data/catalog';
import { ProductGrid } from '@/components/store/product-card';
import { FilterPanel, SortSelect, ActiveFilters } from './filters';
import { BreadcrumbJsonLd } from '@/components/seo/json-ld';

const PAGE = 24;
const OPTION_KEYS = ['texture', 'length', 'color', 'lace', 'density', 'construction'] as const;

export type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(',') : []).filter(Boolean).slice(0, 20);

export function parseFilters(sp: SP): ListingFilters & { page: number } {
  const f: ListingFilters & { page: number } = { page: Math.max(1, Number(sp.page) || 1) };
  for (const k of OPTION_KEYS) { const v = arr(sp[k]); if (v.length) f[k] = v; }
  if (sp.min) f.min = Number(sp.min) || undefined;
  if (sp.max) f.max = Number(sp.max) || undefined;
  if (sp.availability === 'in_stock') f.availability = 'in_stock';
  if (sp.sale === '1') f.sale = true;
  if (sp.new === '1') f.isNew = true;
  if (sp.rating) f.rating = Number(sp.rating) || undefined;
  if (typeof sp.category === 'string') f.category = sp.category;
  if (typeof sp.q === 'string') f.q = sp.q.slice(0, 100);
  const sorts = ['featured', 'newest', 'price_asc', 'price_desc', 'best_selling', 'rating'];
  if (typeof sp.sort === 'string' && sorts.includes(sp.sort)) f.sort = sp.sort as ListingFilters['sort'];
  return f;
}

export async function ProductListing({ title, eyebrow, description, filters, basePath, searchIds, crumbs, showCategoryFilter, children }: {
  title: string; eyebrow?: string; description?: string | null; filters: ListingFilters & { page: number }; basePath: string;
  searchIds?: string[]; crumbs?: { name: string; href: string }[]; showCategoryFilter?: { slug: string; name: string }[]; children?: React.ReactNode;
}) {
  const [{ items, facets, total }, attrs] = await Promise.all([listProducts(filters, searchIds), getAttrMap()]);
  const shown = items.slice(0, filters.page * PAGE).map(toCard);
  const facetGroups = OPTION_KEYS.filter((k) => (facets.options[k]?.length ?? 0) > 1).map((k) => ({
    key: k,
    options: facets.options[k].map((v) => ({ value: v, label: attrs[k]?.[v]?.label ?? v, sort: attrs[k]?.[v]?.sort ?? 99 }))
      .sort((a, b) => a.sort - b.sort || a.value.localeCompare(b.value, undefined, { numeric: true })),
  }));
  const nextParams = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v != null && k !== 'page' && k !== 'category' && k !== 'collection') nextParams.set(k === 'isNew' ? 'new' : k, Array.isArray(v) ? v.join(',') : typeof v === 'boolean' ? '1' : String(v)); });
  if (filters.category && (basePath === '/shop' || basePath === '/search')) nextParams.set('category', filters.category);
  nextParams.set('page', String(filters.page + 1));

  return (
    <div className="container-x pb-10 pt-8 md:pt-12">
      {crumbs && (
        <>
          <BreadcrumbJsonLd items={crumbs} />
          <nav aria-label="Breadcrumb" className="mb-6 text-[12px] text-muted">
            <ol className="flex flex-wrap gap-2">{crumbs.map((c, i) => <li key={c.href} className="flex gap-2">{i > 0 && <span aria-hidden>/</span>}{i === crumbs.length - 1 ? <span aria-current="page">{c.name}</span> : <Link href={c.href} className="hover:text-ink">{c.name}</Link>}</li>)}</ol>
          </nav>
        </>
      )}
      <header className="mb-8 max-w-3xl md:mb-12">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="display-2">{title}</h1>
        {description && <p className="lede mt-4">{description}</p>}
      </header>
      {children}
      <div className="grid gap-8 lg:grid-cols-[240px_1fr] lg:gap-12">
        <FilterPanel groups={facetGroups} priceMin={Math.floor(facets.priceMin / 100)} priceMax={Math.ceil(facets.priceMax / 100)} categories={showCategoryFilter} total={total} />
        <div>
          <div className="mb-6 flex items-center justify-between gap-4 border-b border-line pb-4">
            <p className="text-[13px] text-muted" aria-live="polite">{total} {total === 1 ? 'piece' : 'pieces'}</p>
            <SortSelect />
          </div>
          <ActiveFilters labels={Object.fromEntries(facetGroups.map((g) => [g.key, Object.fromEntries(g.options.map((o) => [o.value, o.label]))]))} />
          {shown.length ? <ProductGrid items={shown} /> : (
            <div className="py-20 text-center">
              <p className="font-display text-[28px]">Nothing matches those filters yet.</p>
              <p className="mt-2 text-muted">Try removing a filter, or explore our best sellers.</p>
              <div className="mt-6 flex justify-center gap-3"><Link href={basePath} className="btn btn-outline">Clear filters</Link><Link href="/collections/best-sellers" className="btn btn-primary">Best sellers</Link></div>
            </div>
          )}
          {total > shown.length && (
            <div className="mt-14 flex flex-col items-center gap-3">
              <p className="text-[12px] text-muted">Showing {shown.length} of {total}</p>
              <Link href={`${basePath}?${nextParams.toString()}`} scroll={false} className="btn btn-outline">Load more</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
