import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, getAttrMap, getRelated, getProductReviews, getAttributes, productsByIds, toCard } from '@/lib/data/catalog';
import { ProductView } from '@/components/product/product-view';
import { ProductRail } from '@/components/sections/product-rail';
import { Accordion } from '@/components/ui/accordion';
import { JsonLd, BreadcrumbJsonLd } from '@/components/seo/json-ld';
import { ReviewsSection } from '@/components/product/reviews-section';
import { BoughtTogether } from '@/components/product/bought-together';
import { RecentlyViewed } from '@/components/product/recently-viewed';
import { sanitizeHtml } from '@/lib/sanitize';
import { env } from '@/lib/env';
import { meta } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/products/[slug]'>) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return {};
  return meta({ title: p.seo_title || p.name, description: p.seo_description || p.short_description, path: `/products/${slug}`, image: p.media[0]?.media.url, noindex: p.noindex });
}

export default async function ProductPage({ params, searchParams }: PageProps<'/products/[slug]'>) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const sp = await searchParams;
  const initialOptions = Object.fromEntries(Object.entries(sp).filter(([k, v]) => product.option_keys.includes(k) && typeof v === 'string')) as Record<string, string>;
  const [attrs, rel, reviews, attributes, [mainEntry]] = await Promise.all([getAttrMap(), getRelated(product.id), getProductReviews(product.id), getAttributes(), productsByIds([product.id])]);

  // Never send cost prices to the browser
  const safe = { ...product, variants: product.variants.map(({ cost_price: _c, ...v }) => v) } as typeof product;
  const d = product.details || {};
  const cat = product.category;
  const crumbs = [{ name: 'Home', href: '/' }];
  if (cat?.parent) crumbs.push({ name: cat.parent.name, href: `/${cat.parent.slug}` });
  if (cat) crumbs.push({ name: cat.name, href: cat.parent ? `/${cat.parent.slug}/${cat.slug}` : `/${cat.slug}` });
  crumbs.push({ name: product.name, href: `/products/${product.slug}` });

  const texture = product.variants.map((v) => v.options.texture).find(Boolean);
  const sections = [
    { title: 'Product details', content: <div className="prose-hg !text-[15px] !text-muted" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description || '') }} /> },
    (d.origin || d.grade || d.hair_info || d.weight_per_bundle) && { title: 'Hair information', content: (
      <dl className="grid grid-cols-[130px_1fr] gap-y-2">
        {d.origin && <><dt className="text-ink">Origin</dt><dd>{d.origin}</dd></>}
        {d.grade && <><dt className="text-ink">Grade</dt><dd>{d.grade}</dd></>}
        {d.weight_per_bundle && <><dt className="text-ink">Weight</dt><dd>{d.weight_per_bundle}</dd></>}
        {d.hair_info && <><dt className="text-ink">Details</dt><dd>{d.hair_info}</dd></>}
      </dl>) },
    texture && attrs.texture?.[texture] && { title: 'Texture', content: <p>{attributes.find((x) => x.attribute === 'texture' && x.slug === texture)?.description ?? attrs.texture[texture].label}</p> },
    (d.construction || d.cap || d.lace_info) && { title: 'Construction & lace', content: (
      <dl className="grid grid-cols-[130px_1fr] gap-y-2">
        {d.construction && <><dt className="text-ink">Construction</dt><dd>{d.construction}</dd></>}
        {d.lace_info && <><dt className="text-ink">Lace</dt><dd>{d.lace_info}</dd></>}
        {d.cap && <><dt className="text-ink">Cap</dt><dd>{d.cap}</dd></>}
        {d.production_time && <><dt className="text-ink">Production</dt><dd>{d.production_time}</dd></>}
      </dl>) },
    d.density_info && { title: 'Density', content: <p>{d.density_info}</p> },
    product.option_keys.includes('length') && { title: 'Length guide', content: (
      <p>Lengths are measured straight from the weft to the tips. Wavy and curly textures sit shorter than their stretched length. <Link href="/hair-guide#length-guide" className="underline">See the full length guide</Link>.</p>) },
    d.care && { title: 'Care instructions', content: <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.care) }} /> },
    d.shipping_note && { title: 'Shipping', content: <p>{d.shipping_note} <Link href="/policies/shipping-policy" className="underline">Shipping policy</Link></p> },
    d.returns_note && { title: 'Returns & exchanges', content: <p>{d.returns_note} <Link href="/policies/refund-policy" className="underline">Refund policy</Link></p> },
  ].filter(Boolean) as { title: string; content: React.ReactNode }[];

  const prices = product.variants.map((v) => v.price);
  const inStock = product.variants.some((v) => !v.track_inventory || v.allow_backorder || v.stock_on_hand - v.stock_reserved > 0);
  const img = product.media[0]?.media.url;

  return (
    <>
      <BreadcrumbJsonLd items={crumbs} />
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: product.short_description ?? undefined,
        sku: product.sku ?? undefined, brand: { '@type': 'Brand', name: 'Hairver Green' },
        image: img ? [img.startsWith('http') ? img : `${env.siteUrl}${img}`] : undefined, url: `${env.siteUrl}/products/${product.slug}`,
        offers: prices.length ? {
          '@type': 'AggregateOffer', priceCurrency: 'NGN', lowPrice: (Math.min(...prices) / 100).toFixed(2), highPrice: (Math.max(...prices) / 100).toFixed(2),
          offerCount: prices.length, availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        } : undefined,
        ...(product.rating_count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(product.rating_avg).toFixed(1), reviewCount: product.rating_count } } : {}),
        ...(reviews.length ? { review: reviews.slice(0, 5).map((r) => ({ '@type': 'Review', author: { '@type': 'Person', name: r.author_name }, reviewRating: { '@type': 'Rating', ratingValue: r.rating }, reviewBody: r.body, datePublished: r.created_at.slice(0, 10) })) } : {}),
      }} />

      <div className="container-x pt-5 md:pt-8">
        <nav aria-label="Breadcrumb" className="mb-5 text-[12px] text-muted">
          <ol className="flex flex-wrap gap-2">{crumbs.map((c, i) => <li key={c.href} className="flex gap-2">{i > 0 && <span aria-hidden>/</span>}{i === crumbs.length - 1 ? <span aria-current="page" className="line-clamp-1">{c.name}</span> : <Link href={c.href} className="hover:text-ink">{c.name}</Link>}</li>)}</ol>
        </nav>
        <ProductView product={safe} attrs={attrs} initialOptions={initialOptions} />
      </div>

      <section className="container-x mt-16 grid gap-12 md:mt-24 lg:grid-cols-12">
        <div className="lg:col-span-7"><Accordion items={sections} defaultOpen={0} /></div>
        {(d.faq?.length ?? 0) > 0 && (
          <div className="lg:col-span-5">
            <p className="eyebrow mb-4">Questions</p>
            <Accordion items={d.faq!.map((f) => ({ title: f.q, content: <p>{f.a}</p> }))} />
          </div>
        )}
      </section>

      {rel.boughtTogether.length > 0 && mainEntry && product.product_type !== 'bundle_deal' && product.product_type !== 'custom_unit' && (
        <BoughtTogether main={toCard(mainEntry)} items={rel.boughtTogether.slice(0, 3).map(toCard)} />
      )}

      <ReviewsSection productId={product.id} productName={product.name} reviews={reviews} avg={Number(product.rating_avg)} count={product.rating_count} />

      {rel.related.length > 0 && (
        <section className="container-x mt-20 md:mt-28">
          <p className="eyebrow mb-3">Discover</p>
          <h2 className="display-3 mb-10">You may also like</h2>
          <ProductRail items={rel.related.slice(0, 8).map(toCard)} />
        </section>
      )}
      <RecentlyViewed exclude={product.slug} />
    </>
  );
}
