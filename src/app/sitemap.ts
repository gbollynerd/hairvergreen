import type { MetadataRoute } from 'next';
import { env, isConfigured } from '@/lib/env';
import { getCatalog, getCollections } from '@/lib/data/catalog';
import { getPosts } from '@/lib/data/content';
import { supabasePublic } from '@/lib/supabase/public';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const u = (p: string) => `${env.siteUrl}${p}`;
  const base: MetadataRoute.Sitemap = ['/', '/shop', '/collections', '/journal', '/services/custom-units', '/services/consultation', '/contact', '/hair-guide']
    .map((p) => ({ url: u(p), changeFrequency: 'weekly', priority: p === '/' ? 1 : 0.7 }));
  if (!isConfigured()) return base;
  const [{ entries, categories }, cols, posts, { data: pages }] = await Promise.all([
    getCatalog(), getCollections(), getPosts({ limit: 500 }),
    supabasePublic().from('pages').select('slug, kind, updated_at, noindex').eq('status', 'published'),
  ]);
  return [
    ...base,
    ...categories.filter((c) => c.is_visible).map((c) => {
      const parent = categories.find((p) => p.id === c.parent_id);
      return { url: u(parent ? `/${parent.slug}/${c.slug}` : `/${c.slug}`), changeFrequency: 'weekly' as const, priority: 0.8 };
    }),
    ...entries.map((p) => ({ url: u(`/products/${p.slug}`), lastModified: p.created_at, changeFrequency: 'weekly' as const, priority: 0.9, images: p.images.filter((i) => i.kind !== 'video' && !i.url.endsWith('.svg')).slice(0, 1).map((i) => (i.url.startsWith('http') ? i.url : u(i.url))) })),
    ...cols.filter((c) => c.is_visible).map((c) => ({ url: u(`/collections/${c.slug}`), changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...posts.filter((p) => !p.noindex).map((p) => ({ url: u(`/journal/${p.slug}`), lastModified: p.updated_at, changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...(pages ?? []).filter((p) => !p.noindex && p.slug !== 'home').map((p) => ({ url: u(p.kind === 'policy' ? `/policies/${p.slug}` : `/${p.slug}`), lastModified: p.updated_at, changeFrequency: 'monthly' as const, priority: 0.4 })),
  ];
}
