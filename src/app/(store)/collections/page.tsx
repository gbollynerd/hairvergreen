import Link from 'next/link';
import { getCollections } from '@/lib/data/catalog';
import { Media } from '@/components/ui/media';
import { Reveal } from '@/components/ui/reveal';
import { meta } from '@/lib/seo';

export const revalidate = 300;
export const generateMetadata = () => meta({ title: 'Collections', description: 'Curated Hairver Green collections — signature textures, luxury units, bundle deals and limited editions.', path: '/collections' });

export default async function Collections() {
  const cols = (await getCollections()).filter((c) => c.is_visible);
  return (
    <div className="container-x py-12 md:py-16">
      <p className="eyebrow">Hairver Green</p>
      <h1 className="display-2 mt-3">Collections</h1>
      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cols.map((c, i) => (
          <Reveal key={c.id} delay={(i % 3) * 80}>
            <Link href={`/collections/${c.slug}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden bg-panel"><Media src={c.image?.url} alt={c.name} fill sizes="33vw" className="zoom-on-hover" /></div>
              <h2 className="mt-4 font-display text-[28px]">{c.name}</h2>
              {c.tagline && <p className="text-[14px] text-muted">{c.tagline}</p>}
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
