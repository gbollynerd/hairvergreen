import Link from 'next/link';
import { getPosts, getBlogCategories } from '@/lib/data/content';
import { Media } from '@/components/ui/media';
import { Reveal } from '@/components/ui/reveal';
import { formatDate, cn } from '@/lib/utils';
import { meta } from '@/lib/seo';

export const revalidate = 300;
export const generateMetadata = () => meta({ title: 'The Hair Journal', description: 'Hair care, wig care, styling and hair education from the Hairver Green studio in Lagos.', path: '/journal' });

export default async function Journal({ searchParams }: PageProps<'/journal'>) {
  const sp = await searchParams;
  const cat = typeof sp.category === 'string' ? sp.category : undefined;
  const [posts, cats] = await Promise.all([getPosts({ category: cat, limit: 30 }), getBlogCategories()]);
  const [lead, ...rest] = posts;
  return (
    <div className="container-x py-12 md:py-16">
      <p className="eyebrow">Read</p>
      <h1 className="display-2 mt-3">The Hair Journal</h1>
      <nav aria-label="Journal categories" className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:flex-wrap md:px-0">
        <Link href="/journal" className="chip shrink-0" aria-current={!cat ? 'page' : undefined} aria-pressed={!cat}>All</Link>
        {cats.map((c) => <Link key={c.id} href={`/journal?category=${c.slug}`} className="chip shrink-0" aria-pressed={cat === c.slug}>{c.name}</Link>)}
      </nav>
      {!posts.length && <p className="py-20 text-center text-muted">No stories here yet.</p>}
      {lead && (
        <Reveal className="mt-12">
          <Link href={`/journal/${lead.slug}`} className="group grid gap-8 md:grid-cols-2 md:items-center">
            <div className="relative aspect-[3/2] overflow-hidden bg-panel"><Media src={lead.featured_image?.url} alt={lead.featured_image?.alt ?? lead.title} fill priority sizes="50vw" className="zoom-on-hover" /></div>
            <div><p className="eyebrow">{lead.category?.name} · {formatDate(lead.published_at)}</p><h2 className="display-2 mt-3">{lead.title}</h2>{lead.excerpt && <p className="lede mt-4">{lead.excerpt}</p>}<span className="caps link-underline mt-6 inline-block">Read the story</span></div>
          </Link>
        </Reveal>
      )}
      <div className={cn('mt-16 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3')}>
        {rest.map((p, i) => (
          <Reveal key={p.id} delay={(i % 3) * 80}>
            <Link href={`/journal/${p.slug}`} className="group block">
              <div className="relative aspect-[3/2] overflow-hidden bg-panel"><Media src={p.featured_image?.url} alt={p.featured_image?.alt ?? p.title} fill sizes="33vw" className="zoom-on-hover" /></div>
              <p className="eyebrow mt-5">{p.category?.name} · {formatDate(p.published_at)}</p>
              <h2 className="mt-2 font-display text-[26px] leading-tight">{p.title}</h2>
              {p.excerpt && <p className="mt-2 line-clamp-2 text-[14px] text-muted">{p.excerpt}</p>}
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
