import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabasePublic } from '@/lib/supabase/public';
import type { Announcement, BlogPost, MenuItem, Page, PageSection, Popup, StoreSettings, ThemeSettings } from '@/lib/types';
import type { DisplayCurrency } from '@/lib/money';

export const CONTENT_TAG = 'content';
const REVALIDATE = 300;

export const DEFAULT_THEME: ThemeSettings = {
  colors: {
    primary: '#0F3D2E', primary_contrast: '#F6F2EA', accent: '#D8C08E', accent_strong: '#B0925C', background: '#F6F2EA',
    surface: '#FFFDF8', panel: '#EFE6D2', text: '#1B1A17', muted: '#6B665C', border: '#E3D9C4', sale: '#8A2E2E',
  },
  fonts: { display: 'Cormorant Garamond', body: 'Jost' }, radius: 'none', button_style: 'solid', product_card: 'editorial',
  animations: 'subtle', logo_media_url: null, favicon_url: null,
};

export const DEFAULT_STORE: StoreSettings = {
  name: 'Hairver Green', short_name: 'HairverGreen', tagline: 'Luxury Hair House · Lagos', email: 'hello@hairvergreen.com', phone: '',
  whatsapp: '', address: 'Lagos, Nigeria', city: 'Lagos', country: 'NG', instagram: 'https://www.instagram.com/hairvergreen/', tiktok: '',
  support_hours: '',
};

export type PublicSettings = {
  store: StoreSettings; theme: ThemeSettings;
  currencies: { base: string; display: DisplayCurrency[] };
  seo: { title_template: string; default_title: string; default_description: string; og_image: string | null };
  analytics: { ga4_id: string; meta_pixel_id: string; tiktok_pixel_id: string; gsc_verification: string };
  checkout: { guest_checkout: boolean; hold_minutes: number; require_phone: boolean; terms_page: string; order_note: boolean };
  shipping: { free_shipping_banner: boolean };
  social_proof: { reviews_enabled: boolean; verified_only: boolean };
};

async function loadSettings(): Promise<PublicSettings> {
  const { data } = await supabasePublic().from('settings').select('key, value').eq('is_public', true);
  const m = Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])) as Record<string, any>;
  return {
    store: { ...DEFAULT_STORE, ...(m.store || {}) },
    theme: { ...DEFAULT_THEME, ...(m.theme || {}), colors: { ...DEFAULT_THEME.colors, ...(m.theme?.colors || {}) }, fonts: { ...DEFAULT_THEME.fonts, ...(m.theme?.fonts || {}) } },
    currencies: m.currencies || { base: 'NGN', display: [{ code: 'NGN', symbol: '₦', rate: 1 }] },
    seo: { title_template: '%s · Hairver Green', default_title: 'Hairver Green', default_description: '', og_image: null, ...(m.seo || {}) },
    analytics: { ga4_id: '', meta_pixel_id: '', tiktok_pixel_id: '', gsc_verification: '', ...(m.analytics || {}) },
    checkout: { guest_checkout: true, hold_minutes: 60, require_phone: true, terms_page: '/policies/terms', order_note: true, ...(m.checkout || {}) },
    shipping: { free_shipping_banner: true, ...(m.shipping || {}) },
    social_proof: { reviews_enabled: true, verified_only: false, ...(m.social_proof || {}) },
  };
}
export const getSettings = unstable_cache(loadSettings, ['settings-v1'], { tags: [CONTENT_TAG, 'settings'], revalidate: REVALIDATE });

export const getMenus = unstable_cache(async () => {
  const { data } = await supabasePublic().from('menus').select('key, items');
  return Object.fromEntries((data ?? []).map((m: { key: string; items: MenuItem[] }) => [m.key, m.items])) as Record<string, MenuItem[]>;
}, ['menus-v1'], { tags: [CONTENT_TAG, 'menus'], revalidate: REVALIDATE });

export const getAnnouncements = unstable_cache(async () => {
  const now = new Date().toISOString();
  const { data } = await supabasePublic().from('announcements').select('id, message, href, background, text_color, dismissible, starts_at, ends_at')
    .eq('is_active', true).order('sort');
  return ((data ?? []) as (Announcement & { starts_at: string | null; ends_at: string | null })[])
    .filter((a) => (!a.starts_at || a.starts_at <= now) && (!a.ends_at || a.ends_at >= now));
}, ['announcements-v1'], { tags: [CONTENT_TAG, 'announcements'], revalidate: 120 });

export const getPopups = unstable_cache(async () => {
  const now = new Date().toISOString();
  const { data } = await supabasePublic().from('popups').select('*, image:image_id (url, alt)').eq('is_active', true).order('priority', { ascending: false });
  return ((data ?? []) as Popup[]).filter((p) => (!p.starts_at || p.starts_at <= now) && (!p.ends_at || p.ends_at >= now));
}, ['popups-v1'], { tags: [CONTENT_TAG, 'popups'], revalidate: 120 });

async function loadPage(slug: string) {
  const db = supabasePublic();
  const { data: page, error } = await db.from('pages').select('*, og_image:og_image_id (url)').eq('slug', slug).eq('status', 'published').maybeSingle();
  // Throw on errors so a database hiccup is never cached as "page not found"
  if (error) throw new Error(`pages: ${error.message}`);
  if (!page) return null;
  const { data: sections, error: secErr } = await db.from('page_sections').select('*').eq('page_id', page.id).eq('is_visible', true).order('sort');
  if (secErr) throw new Error(`page_sections: ${secErr.message}`);
  return { page: page as Page & { og_image: { url: string } | null }, sections: (sections ?? []) as PageSection[] };
}
export const getPage = (slug: string) =>
  unstable_cache(() => loadPage(slug), ['page-v1', slug], { tags: [CONTENT_TAG, `page:${slug}`], revalidate: REVALIDATE })();

export const getSocialPosts = unstable_cache(async () => {
  const { data } = await supabasePublic().from('social_posts').select('*, media:media_id (url, alt)').eq('is_visible', true).order('sort').limit(12);
  return (data ?? []) as { id: string; image_url: string | null; permalink: string | null; caption: string | null; product_ids: string[]; platform: string; media: { url: string; alt: string } | null }[];
}, ['social-v1'], { tags: [CONTENT_TAG, 'social'], revalidate: REVALIDATE });

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------
const POST_SELECT = '*, featured_image:featured_image_id (url, alt, width, height), category:category_id (name, slug)';

export const getPosts = unstable_cache(async (opts: { category?: string; limit?: number; tag?: string } = {}) => {
  const db = supabasePublic();
  let q = db.from('blog_posts').select(POST_SELECT).eq('status', 'published').lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false }).limit(opts.limit ?? 24);
  if (opts.category) {
    const { data: c } = await db.from('blog_categories').select('id').eq('slug', opts.category).maybeSingle();
    if (!c) return [];
    q = q.eq('category_id', c.id);
  }
  if (opts.tag) q = q.contains('tags', [opts.tag]);
  const { data } = await q;
  return (data ?? []) as BlogPost[];
}, ['posts-v1'], { tags: [CONTENT_TAG, 'posts'], revalidate: REVALIDATE });

export const getPost = (slug: string) => unstable_cache(async () => {
  const { data } = await supabasePublic().from('blog_posts').select(POST_SELECT).eq('slug', slug).eq('status', 'published').maybeSingle();
  if (!data || (data.published_at && data.published_at > new Date().toISOString())) return null;
  return data as BlogPost;
}, ['post-v1', slug], { tags: [CONTENT_TAG, 'posts', `post:${slug}`], revalidate: REVALIDATE })();

export const getBlogCategories = unstable_cache(async () => {
  const { data } = await supabasePublic().from('blog_categories').select('*').order('sort');
  return (data ?? []) as { id: string; name: string; slug: string }[];
}, ['blog-cats-v1'], { tags: [CONTENT_TAG, 'posts'], revalidate: REVALIDATE });

export const getShippingZones = unstable_cache(async () => {
  const { data } = await supabasePublic().from('shipping_zones').select('*, methods:shipping_methods (*)').eq('is_active', true).order('sort');
  return (data ?? []) as any[];
}, ['zones-v1'], { tags: [CONTENT_TAG, 'shipping'], revalidate: REVALIDATE });
