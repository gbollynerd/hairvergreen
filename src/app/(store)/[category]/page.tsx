import { notFound } from 'next/navigation';
import { getCategoryBySlug } from '@/lib/data/catalog';
import { getPage } from '@/lib/data/content';
import { ProductListing, parseFilters } from '@/components/listing/listing';
import { SectionRenderer } from '@/components/sections/section-renderer';
import { sanitizeHtml } from '@/lib/sanitize';
import { meta } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/[category]'>) {
  const { category } = await params;
  const cat = await getCategoryBySlug(category);
  if (cat) return meta({ title: cat.seo_title || cat.name, description: cat.seo_description || cat.description, path: `/${cat.slug}` });
  const page = await getPage(category);
  if (page) return meta({ title: page.page.seo_title || page.page.title, description: page.page.seo_description, path: `/${category}`, noindex: page.page.noindex });
  return {};
}

// Top-level categories (/wigs, /hair) — falls back to CMS pages (/about, /faq, /hair-guide).
export default async function CategoryOrPage({ params, searchParams }: PageProps<'/[category]'>) {
  const { category } = await params;
  const cat = await getCategoryBySlug(category);
  if (cat) {
    const filters = { ...parseFilters(await searchParams), category: cat.slug };
    return (
      <ProductListing title={cat.name} eyebrow="Shop" description={cat.description} filters={filters} basePath={`/${cat.slug}`}
        crumbs={[{ name: 'Home', href: '/' }, { name: cat.name, href: `/${cat.slug}` }]}>
        {cat.children.length > 0 && (
          <nav aria-label={`${cat.name} categories`} className="-mx-4 mb-10 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:flex-wrap md:px-0">
            {cat.children.map((c) => <a key={c.id} href={`/${cat.slug}/${c.slug}`} className="chip shrink-0">{c.name}</a>)}
          </nav>
        )}
      </ProductListing>
    );
  }
  const page = await getPage(category);
  if (!page) notFound();
  return (
    <>
      {page.sections.length ? <SectionRenderer sections={page.sections} /> : (
        <div className="container-x max-w-3xl py-16">
          <h1 className="display-2">{page.page.title}</h1>
          {page.page.body && <div className="prose-hg mt-8" dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.page.body) }} />}
        </div>
      )}
    </>
  );
}
