import { env } from '@/lib/env';
import type { StoreSettings } from '@/lib/types';

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export function OrganizationJsonLd({ store }: { store: StoreSettings }) {
  const sameAs = [store.instagram, store.tiktok].filter(Boolean);
  return (
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', '@id': `${env.siteUrl}/#org`, name: 'Hairver Green', url: env.siteUrl, logo: `${env.siteUrl}/icon.svg`, sameAs,
          address: { '@type': 'PostalAddress', addressLocality: store.city || 'Lagos', addressCountry: store.country || 'NG' },
          ...(store.email ? { email: store.email } : {}), ...(store.phone ? { telephone: store.phone } : {}) },
        { '@type': 'WebSite', '@id': `${env.siteUrl}/#website`, url: env.siteUrl, name: 'Hairver Green', publisher: { '@id': `${env.siteUrl}/#org` },
          potentialAction: { '@type': 'SearchAction', target: `${env.siteUrl}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
      ],
    }} />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; href: string }[] }) {
  return (
    <JsonLd data={{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${env.siteUrl}${it.href}` })),
    }} />
  );
}
