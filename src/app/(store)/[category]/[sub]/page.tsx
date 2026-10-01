import { notFound, permanentRedirect } from 'next/navigation';
import { getCategoryBySlug } from '@/lib/data/catalog';
import { ProductListing, parseFilters } from '@/components/listing/listing';
import { meta } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/[category]/[sub]'>) {
  const { category, sub } = await params;
  const cat = await getCategoryBySlug(sub);
  if (!cat) return {};
  return meta({ title: cat.seo_title || `${cat.name}`, description: cat.seo_description || cat.description, path: `/${category}/${sub}` });
}

export default async function SubCategory({ params, searchParams }: PageProps<'/[category]/[sub]'>) {
  const { category, sub } = await params;
  const cat = await getCategoryBySlug(sub);
  if (!cat || !cat.parent) notFound();
  if (cat.parent.slug !== category) permanentRedirect(`/${cat.parent.slug}/${cat.slug}`);
  if (cat.slug === 'custom-units') permanentRedirect('/services/custom-units');
  const filters = { ...parseFilters(await searchParams), category: cat.slug };
  return (
    <ProductListing title={cat.name} eyebrow={cat.parent.name} description={cat.description} filters={filters} basePath={`/${category}/${sub}`}
      crumbs={[{ name: 'Home', href: '/' }, { name: cat.parent.name, href: `/${cat.parent.slug}` }, { name: cat.name, href: `/${category}/${sub}` }]} />
  );
}
