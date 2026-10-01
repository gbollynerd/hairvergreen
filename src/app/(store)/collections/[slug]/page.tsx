import { notFound } from 'next/navigation';
import { getCollection, listProducts } from '@/lib/data/catalog';
import { ProductListing, parseFilters } from '@/components/listing/listing';
import { CollectionDeal } from '@/components/store/collection-deal';
import { meta } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/collections/[slug]'>) {
  const { slug } = await params;
  const c = await getCollection(slug);
  return c ? meta({ title: c.seo_title || c.name, description: c.seo_description || c.tagline, path: `/collections/${slug}`, image: c.image?.url }) : {};
}

export default async function CollectionPage({ params, searchParams }: PageProps<'/collections/[slug]'>) {
  const { slug } = await params;
  const c = await getCollection(slug);
  if (!c || !c.is_visible) notFound();
  const filters = { ...parseFilters(await searchParams), collection: slug };
  let deal: { regular: number; price: number; products: { id: string; name: string; slug: string; variant_id: string | null }[] } | null = null;
  if (c.deal_enabled && c.deal_price) {
    const { items } = await listProducts({ collection: slug });
    const simple = items.filter((p) => p.product_type !== 'custom_unit');
    const regular = simple.reduce((s, p) => s + p.price_min, 0);
    if (regular > c.deal_price) deal = { regular, price: c.deal_price, products: simple.map((p) => ({ id: p.id, name: p.name, slug: p.slug, variant_id: p.default_variant_id })) };
  }
  return (
    <ProductListing title={c.name} eyebrow="Collection" description={c.description} filters={filters} basePath={`/collections/${slug}`}
      crumbs={[{ name: 'Home', href: '/' }, { name: 'Collections', href: '/collections' }, { name: c.name, href: `/collections/${slug}` }]}>
      {deal && <CollectionDeal {...deal} name={c.name} />}
    </ProductListing>
  );
}
