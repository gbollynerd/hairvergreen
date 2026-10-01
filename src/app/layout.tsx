import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { getSettings } from '@/lib/data/content';
import { ThemeStyle } from '@/components/theme-style';
import { env, isConfigured } from '@/lib/env';

// Brand fonts are self-hosted (SIL Open Font License) for speed and privacy.
const cormorant = localFont({
  variable: '--font-cormorant', display: 'swap',
  src: [
    { path: '../fonts/cormorant-garamond-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/cormorant-garamond-latin-400-italic.woff2', weight: '400', style: 'italic' },
    { path: '../fonts/cormorant-garamond-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/cormorant-garamond-latin-500-italic.woff2', weight: '500', style: 'italic' },
    { path: '../fonts/cormorant-garamond-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/cormorant-garamond-latin-600-italic.woff2', weight: '600', style: 'italic' },
  ],
});
const jost = localFont({
  variable: '--font-jost', display: 'swap',
  src: [
    { path: '../fonts/jost-latin-300-normal.woff2', weight: '300', style: 'normal' },
    { path: '../fonts/jost-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/jost-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
});

// Editorial display face used by the split hero (SIL Open Font License).
const bodoni = localFont({
  variable: '--font-bodoni', display: 'swap',
  src: [
    { path: '../fonts/bodoni-moda-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/bodoni-moda-latin-400-italic.woff2', weight: '400', style: 'italic' },
  ],
});

export async function generateMetadata(): Promise<Metadata> {
  const s = isConfigured() ? await getSettings() : null;
  const title = s?.seo.default_title || 'Hairver Green — Luxury Hair House, Lagos';
  const description = s?.seo.default_description || 'Premium virgin hair, donor hair, custom units and ready-to-wear wigs, crafted in Lagos and delivered worldwide.';
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: title, template: s?.seo.title_template || '%s · Hairver Green' },
    description,
    applicationName: 'Hairver Green',
    openGraph: { type: 'website', siteName: 'Hairver Green', title, description, locale: 'en_NG', images: s?.seo.og_image ? [s.seo.og_image] : ['/og-default.png'] },
    twitter: { card: 'summary_large_image', title, description },
    icons: { icon: s?.theme.favicon_url || '/icon.svg', apple: '/apple-icon.png' },
    verification: s?.analytics.gsc_verification ? { google: s.analytics.gsc_verification } : undefined,
    alternates: { canonical: '/' },
  };
}

export const viewport: Viewport = { themeColor: '#0F3D2E', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const s = isConfigured() ? await getSettings() : null;
  return (
    <html lang="en" className={`${cormorant.variable} ${jost.variable} ${bodoni.variable}`} data-motion={s?.theme.animations === 'none' ? 'none' : 'on'} data-buttons={s?.theme.button_style === 'outline' ? 'outline' : 'solid'}>
      <head>{s && <ThemeStyle theme={s.theme} />}</head>
      <body>{children}</body>
    </html>
  );
}
