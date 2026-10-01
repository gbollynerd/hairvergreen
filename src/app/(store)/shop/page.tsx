import { ProductListing, parseFilters } from '@/components/listing/listing';
import { getCatalog, getAttributes } from '@/lib/data/catalog';
import { meta } from '@/lib/seo';

export async function generateMetadata({ searchParams }: PageProps<'/shop'>) {
  const sp = await searchParams;
  const attrs = await getAttributes();
  const t = typeof sp.texture === 'string' ? attrs.find((a) => a.attribute === 'texture' && a.slug === sp.texture)?.label : null;
  const l = typeof sp.length === 'string' ? attrs.find((a) => a.attribute === 'length' && a.slug === sp.length)?.label : null;
  const title = t ? `${t} Hair & Wigs` : l ? `${l} Hair & Wigs` : 'Shop All Hair & Wigs';
  return meta({ title, description: 'Luxury virgin hair, donor hair, ready-to-wear wigs and custom units from Hairver Green, Lagos.', path: '/shop' });
}

export default async function Shop({ searchParams }: PageProps<'/shop'>) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [{ categories }, attrs] = await Promise.all([getCatalog(), getAttributes()]);
  const tex = filters.texture?.length === 1 ? attrs.find((a) => a.attribute === 'texture' && a.slug === filters.texture![0]) : null;
  const len = filters.length?.length === 1 ? attrs.find((a) => a.attribute === 'length' && a.slug === filters.length![0]) : null;
  const title = tex ? tex.label : len ? `${len.label} hair` : 'Shop all';
  return (
    <ProductListing title={title} eyebrow={tex ? 'Shop by texture' : len ? 'Shop by length' : 'Hairver Green'}
      description={tex?.description ?? (len ? 'Every piece available in this length.' : 'Every texture, length and unit — in one place.')}
      filters={filters} basePath="/shop" crumbs={[{ name: 'Home', href: '/' }, { name: 'Shop', href: '/shop' }]}
      showCategoryFilter={categories.filter((c) => c.parent_id && c.is_visible).map((c) => ({ slug: c.slug, name: c.name }))} />
  );
}
