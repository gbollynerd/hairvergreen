import { ProductListing, parseFilters } from '@/components/listing/listing';
import { searchProductIds } from '@/lib/data/catalog';
import Link from 'next/link';

export const metadata = { title: 'Search', robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 100) : '';
  const filters = parseFilters(sp);
  if (!q) {
    return (
      <div className="container-x py-20 text-center">
        <h1 className="display-2">Search Hairver Green</h1>
        <form action="/search" className="mx-auto mt-8 flex max-w-lg gap-2" role="search">
          <label htmlFor="q" className="sr-only">Search</label>
          <input id="q" name="q" className="input flex-1" placeholder="Try “20 inch body wave”" />
          <button className="btn btn-primary">Search</button>
        </form>
        <div className="mt-6 flex flex-wrap justify-center gap-2">{['Body Wave', 'Straight', '20 inch', 'Glueless', 'Custom Unit'].map((t) => <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="chip">{t}</Link>)}</div>
      </div>
    );
  }
  const ids = await searchProductIds(q, 96);
  return <ProductListing title={`“${q}”`} eyebrow="Search results" filters={{ ...filters, sort: filters.sort }} basePath={`/search`} searchIds={ids} />;
}
