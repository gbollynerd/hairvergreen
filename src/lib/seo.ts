import type { Metadata } from 'next';
import { env } from '@/lib/env';

export function meta({ title, description, path, image, noindex, type = 'website' }: {
  title?: string | null; description?: string | null; path: string; image?: string | null; noindex?: boolean; type?: 'website' | 'article';
}): Metadata {
  const img = image ? (image.startsWith('http') ? image : `${env.siteUrl}${image}`) : undefined;
  return {
    title: title ?? undefined,
    description: description ?? undefined,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: { title: title ?? undefined, description: description ?? undefined, url: path, type, ...(img && !img.endsWith('.svg') ? { images: [img] } : {}) },
    twitter: { card: 'summary_large_image', title: title ?? undefined, description: description ?? undefined },
  };
}
