import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPost, getPosts } from '@/lib/data/content';
import { productsByIds, toCard } from '@/lib/data/catalog';
import { Media } from '@/components/ui/media';
import { ProductRail } from '@/components/sections/product-rail';
import { JsonLd } from '@/components/seo/json-ld';
import { sanitizeHtml } from '@/lib/sanitize';
import { formatDate } from '@/lib/utils';
import { env } from '@/lib/env';
import { meta } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/journal/[slug]'>) {
  const { slug } = await params;
  const p = await getPost(slug);
  return p ? meta({ title: p.seo_title || p.title, description: p.seo_description || p.excerpt, path: `/journal/${slug}`, image: p.featured_image?.url, type: 'article', noindex: p.noindex }) : {};
}

export default async function Post({ params }: PageProps<'/journal/[slug]'>) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const [products, more] = await Promise.all([productsByIds(post.related_product_ids ?? []), getPosts({ limit: 4 })]);
  const related = more.filter((p) => p.id !== post.id && (post.related_post_ids.length ? post.related_post_ids.includes(p.id) : true)).slice(0, 3);
  const video = post.video_url && /^https:\/\/(www\.)?(youtube\.com|youtu\.be|player\.vimeo\.com)/.test(post.video_url)
    ? post.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/') : null;
  return (
    <article>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: post.title, datePublished: post.published_at, dateModified: post.updated_at,
        author: { '@type': 'Organization', name: post.author_name || 'Hairver Green' }, publisher: { '@type': 'Organization', name: 'Hairver Green' },
        mainEntityOfPage: `${env.siteUrl}/journal/${post.slug}` }} />
      <header className="container-x max-w-4xl pt-12 text-center md:pt-20">
        <p className="eyebrow">{post.category?.name}{post.reading_minutes ? ` · ${post.reading_minutes} min read` : ''}</p>
        <h1 className="display-1 mt-5">{post.title}</h1>
        {post.excerpt && <p className="lede mx-auto mt-6 max-w-2xl">{post.excerpt}</p>}
        <p className="mt-6 text-[13px] text-muted">{post.author_name || 'Hairver Green'} · {formatDate(post.published_at)}</p>
      </header>
      {post.featured_image?.url && <div className="container-x mt-12"><div className="relative aspect-[16/9] overflow-hidden bg-panel"><Media src={post.featured_image.url} alt={post.featured_image.alt ?? post.title} fill priority sizes="100vw" /></div></div>}
      <div className="container-x mt-12 max-w-[720px]">
        <div className="prose-hg" dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }} />
        {video && <div className="mt-10 aspect-video"><iframe src={video} title={post.title} className="h-full w-full" allowFullScreen loading="lazy" /></div>}
        {post.gallery?.length > 0 && <div className="mt-10 grid grid-cols-2 gap-3">{post.gallery.map((g, i) => <div key={i} className="relative aspect-[4/5] bg-panel"><Media src={g.url} alt={g.alt ?? ''} fill sizes="360px" /></div>)}</div>}
        {post.tags?.filter((t) => t !== 'demo').length > 0 && <p className="mt-10 text-[13px] text-muted">Tags: {post.tags.filter((t) => t !== 'demo').join(', ')}</p>}
      </div>
      {products.length > 0 && (
        <section className="container-x mt-20"><p className="eyebrow mb-3">Shop the story</p><h2 className="display-3 mb-10">Featured in this article</h2><ProductRail items={products.map(toCard)} /></section>
      )}
      {related.length > 0 && (
        <section className="container-x mt-20">
          <h2 className="display-3 mb-10">Keep reading</h2>
          <div className="grid gap-10 md:grid-cols-3">{related.map((p) => (
            <Link key={p.id} href={`/journal/${p.slug}`} className="group block"><div className="relative aspect-[3/2] overflow-hidden bg-panel"><Media src={p.featured_image?.url} alt="" fill sizes="33vw" className="zoom-on-hover" /></div><h3 className="mt-4 font-display text-[24px] leading-tight">{p.title}</h3></Link>
          ))}</div>
        </section>
      )}
    </article>
  );
}
