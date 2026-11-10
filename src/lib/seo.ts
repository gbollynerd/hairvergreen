import type { Metadata } from 'next';
import { env } from '@/lib/env';

export function meta({ title, description, path, image, noindex, type = 'website' }: {
  title?: string | null; description?: string | null; path: string; image?: string | null; noindex?: boolean; type?: 'website' | 'article';
}): Metadata {
  const abs = image ? (image.startsWith('http') ? image : `${env.siteUrl}${image}`) : undefined;
  // Social apps can't show SVGs, so fall back to the brand share card
  const img = abs && !abs.split('?')[0].endsWith('.svg') ? abs : `${env.siteUrl}/og-default.png`;
  return {
    title: title ?? undefined,
    description: description ?? undefined,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: { title: title ?? undefined, description: description ?? undefined, url: path, type, siteName: 'Hairver Green', images: [img] },
    twitter: { card: 'summary_large_image', title: title ?? undefined, description: description ?? undefined, images: [img] },
  };
}
