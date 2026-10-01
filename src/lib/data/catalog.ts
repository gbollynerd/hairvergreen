import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabasePublic } from '@/lib/supabase/public';
import type {
  AttributeValue, Bundle, Category, Collection, Media, ProductCardData, ProductFull, Review, Variant,
} from '@/lib/types';

export const CATALOG_TAG = 'catalog';
const REVALIDATE = 300;

const available = (v: Pick<Variant, 'track_inventory' | 'stock_on_hand' | 'stock_reserved' | 'allow_backorder'>) =>
  !v.track_inventory || v.allow_backorder || v.stock_on_hand - v.stock_reserved > 0;

export type CatalogEntry = ProductCardData & {
  category_id: string | null; category_ids: string[]; collection_slugs: string[]; tags: string[]; created_at: string;
  sales_count: number; is_featured: boolean; options: Record<string, string[]>; on_sale: boolean; search_text?: string;
  variants: { id: string; options: Record<string, string>; price: number; compare_at_price: number | null; available: boolean }[];
};

type RawProduct = {
  id: string; name: string; slug: string; product_type: ProductCardData['product_type']; is_new: boolean; is_featured: boolean;
  rating_avg: number; rating_count: number; short_description: string | null; category_id: string | null; tags: string[];
  created_at: string; sales_count: number; option_keys: string[]; price: number;
  product_variants: (Variant)[];
  product_media: { sort: number; option_match: Record<string, string>; media: Pick<Media, 'url' | 'alt' | 'kind' | 'metadata'> | null }[];
  collection_products: { collections: { slug: string } | null }[];
  bundles: { pricing_mode: Bundle['pricing_mode']; value: number; bundle_items: { product_id: string; variant_id: string | null; quantity: number; is_optional: boolean }[] } | null;
};

async function loadCatalog(): Promise<{ entries: CatalogEntry[]; categories: Category[]; attributes: AttributeValue[] }> {
  const db = supabasePublic();
  const [{ data: products, error }, { data: categories, error: catErr }, { data: attributes, error: attrErr }] = await Promise.all([
    db.from('products').select(`
      id, name, slug, product_type, is_new, is_featured, rating_avg, rating_count, short_description, category_id, tags,
      created_at, sales_count, option_keys, price,
      product_variants (id, product_id, sku, title, options, price, compare_at_price, weight_grams, image_id, is_active, position,
        track_inventory, stock_on_hand, stock_reserved, low_stock_threshold, allow_backorder, restock_date),
      product_media (sort, option_match, media:media_id (url, alt, kind, metadata)),
      collection_products (collections (slug)),
      bundles (pricing_mode, value, bundle_items!bundle_items_bundle_product_id_fkey (product_id, variant_id, quantity, is_optional))
    `).order('created_at', { ascending: false }),
    db.from('categories').select('*, image:image_id (url, alt, width, height)').order('sort'),
    db.from('attribute_values').select('*').order('attribute').order('sort'),
  ]);
  if (error || catErr || attrErr) {
    // Throw so the failure is not cached as an empty catalogue; the error boundary shows a retry page.
    console.error('[catalog] load failed', error ?? catErr ?? attrErr);
    throw new Error('Catalogue temporarily unavailable');
  }
  const cats = (categories ?? []) as Category[];
  const raw = (products ?? []) as unknown as RawProduct[];
  const byId = new Map(raw.map((p) => [p.id, p]));

  const entries: CatalogEntry[] = raw.map((p) => {
    const variants = (p.product_variants ?? []).filter((v) => v.is_active).sort((a, b) => a.position - b.position);
    const images = (p.product_media ?? [])
      .sort((a, b) => a.sort - b.sort)
      .filter((m) => m.media)
      .map((m) => ({ url: m.media!.url, alt: m.media!.alt || p.name, kind: m.media!.kind ?? 'image', poster: m.media!.metadata?.poster ?? null }));

    let priceMin = variants.length ? Math.min(...variants.map((v) => v.price)) : p.price;
    let priceMax = variants.length ? Math.max(...variants.map((v) => v.price)) : p.price;
    const cheapest = variants.find((v) => v.price === priceMin);
    let compareAt = cheapest?.compare_at_price && cheapest.compare_at_price > priceMin ? cheapest.compare_at_price : null;
    let inStock = variants.some(available);

    // Bundle deals: derive "from" price and availability from components
    if (p.product_type === 'bundle_deal' && p.bundles) {
      const req = p.bundles.bundle_items.filter((i) => !i.is_optional);
      let sum = 0; let ok = true;
      for (const it of req) {
        const comp = byId.get(it.product_id);
        const cvs = (comp?.product_variants ?? []).filter((v) => v.is_active && (!it.variant_id || v.id === it.variant_id));
        const avail = cvs.filter(available);
        if (!avail.length) ok = false;
        const pool = avail.length ? avail : cvs;
        sum += (pool.length ? Math.min(...pool.map((v) => v.price)) : 0) * it.quantity;
      }
      if (p.bundles.pricing_mode !== 'fixed') {
        const discounted = p.bundles.pricing_mode === 'percent_off'
          ? Math.round(sum * (1 - p.bundles.value / 100)) : Math.max(0, sum - p.bundles.value * 100);
        priceMin = discounted; priceMax = discounted; compareAt = sum > discounted ? sum : null;
      } else {
        compareAt = sum > priceMin ? sum : null;
      }
      inStock = ok;
    }

    const options: Record<string, string[]> = {};
    for (const v of variants) for (const [k, val] of Object.entries(v.options || {})) {
      (options[k] ||= []).includes(val) || options[k].push(val);
    }
    const cat = cats.find((c) => c.id === p.category_id);
    const categoryIds = [p.category_id, cat?.parent_id].filter(Boolean) as string[];

    return {
      id: p.id, name: p.name, slug: p.slug, product_type: p.product_type, is_new: p.is_new, rating_avg: Number(p.rating_avg),
      rating_count: p.rating_count, short_description: p.short_description, price_min: priceMin, price_max: priceMax,
      compare_at: compareAt, in_stock: inStock, images, option_keys: p.option_keys, variant_count: variants.length,
      default_variant_id: variants.length === 1 ? variants[0].id : null,
      category_id: p.category_id, category_ids: categoryIds,
      collection_slugs: (p.collection_products ?? []).map((c) => c.collections?.slug).filter(Boolean) as string[],
      tags: p.tags, created_at: p.created_at, sales_count: p.sales_count, is_featured: p.is_featured, options,
      on_sale: Boolean(compareAt) || variants.some((v) => v.compare_at_price && v.compare_at_price > v.price),
      variants: variants.map((v) => ({ id: v.id, options: v.options, price: v.price, compare_at_price: v.compare_at_price, available: available(v) })),
    };
  });
  return { entries, categories: cats, attributes: (attributes ?? []) as AttributeValue[] };
}

export const getCatalog = unstable_cache(loadCatalog, ['catalog-v1'], { tags: [CATALOG_TAG], revalidate: REVALIDATE });

// ---------------------------------------------------------------------------
// Listing & filtering
// ---------------------------------------------------------------------------
export type ListingFilters = {
  category?: string;         // category slug (includes children)
  collection?: string;       // collection slug
  q?: string;
  texture?: string[]; length?: string[]; color?: string[]; lace?: string[]; density?: string[]; construction?: string[];
  min?: number; max?: number;  // major units (naira)
  availability?: 'in_stock';
  sale?: boolean; isNew?: boolean; rating?: number;
  type?: string;
  sort?: 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'best_selling' | 'rating';
  ids?: string[];
};

const OPTION_FILTERS = ['texture', 'length', 'color', 'lace', 'density', 'construction'] as const;

export async function listProducts(f: ListingFilters, searchIds?: string[]) {
  const { entries, categories } = await getCatalog();
  let list = entries;
  if (f.ids) { const set = new Set(f.ids); list = list.filter((p) => set.has(p.id)); }
  if (searchIds) { const order = new Map(searchIds.map((id, i) => [id, i])); list = list.filter((p) => order.has(p.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!); }
  if (f.category) {
    const cat = categories.find((c) => c.slug === f.category);
    if (!cat) return { items: [], facets: emptyFacets(), total: 0 };
    list = list.filter((p) => p.category_ids.includes(cat.id));
  }
  if (f.collection) list = list.filter((p) => p.collection_slugs.includes(f.collection!));
  if (f.type) list = list.filter((p) => p.product_type === f.type);

  // Facets are computed before option filters are applied so customers can see what else exists.
  const base = list;

  for (const key of OPTION_FILTERS) {
    const want = f[key];
    if (want?.length) list = list.filter((p) => p.variants.some((v) => want.includes(v.options?.[key])));
  }
  if (f.min != null) list = list.filter((p) => p.price_max >= f.min! * 100);
  if (f.max != null) list = list.filter((p) => p.price_min <= f.max! * 100);
  if (f.availability === 'in_stock') list = list.filter((p) => p.in_stock);
  if (f.sale) list = list.filter((p) => p.on_sale);
  if (f.isNew) list = list.filter((p) => p.is_new);
  if (f.rating) list = list.filter((p) => p.rating_avg >= f.rating!);

  const sort = f.sort ?? (searchIds ? undefined : 'featured');
  const sorted = [...list];
  switch (sort) {
    case 'newest': sorted.sort((a, b) => b.created_at.localeCompare(a.created_at)); break;
    case 'price_asc': sorted.sort((a, b) => a.price_min - b.price_min); break;
    case 'price_desc': sorted.sort((a, b) => b.price_min - a.price_min); break;
    case 'best_selling': sorted.sort((a, b) => b.sales_count - a.sales_count); break;
    case 'rating': sorted.sort((a, b) => b.rating_avg - a.rating_avg || b.rating_count - a.rating_count); break;
    case 'featured': sorted.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || Number(b.in_stock) - Number(a.in_stock) || b.sales_count - a.sales_count); break;
  }
  return { items: sorted, facets: buildFacets(base), total: sorted.length };
}

function emptyFacets() { return { options: {} as Record<string, string[]>, priceMin: 0, priceMax: 0 }; }
function buildFacets(list: CatalogEntry[]) {
  const options: Record<string, string[]> = {};
  for (const p of list) for (const [k, vals] of Object.entries(p.options)) for (const v of vals) (options[k] ||= []).includes(v) || options[k].push(v);
  const prices = list.flatMap((p) => [p.price_min, p.price_max]);
  return { options, priceMin: prices.length ? Math.min(...prices) : 0, priceMax: prices.length ? Math.max(...prices) : 0 };
}

export async function productsBySlugs(slugs: string[]) {
  const { entries } = await getCatalog();
  return slugs.map((s) => entries.find((e) => e.slug === s)).filter(Boolean) as CatalogEntry[];
}
export async function productsByIds(ids: string[]) {
  const { entries } = await getCatalog();
  return ids.map((s) => entries.find((e) => e.id === s)).filter(Boolean) as CatalogEntry[];
}

export async function getCategoryBySlug(slug: string) {
  const { categories } = await getCatalog();
  const cat = categories.find((c) => c.slug === slug && c.is_visible);
  if (!cat) return null;
  const parent = categories.find((c) => c.id === cat.parent_id) ?? null;
  const children = categories.filter((c) => c.parent_id === cat.id && c.is_visible);
  return { ...cat, parent, children };
}

export const getAttributes = async () => (await getCatalog()).attributes;
export async function attributeLabel(attribute: string, slug: string) {
  const a = (await getAttributes()).find((x) => x.attribute === attribute && x.slug === slug);
  return a?.label ?? slug;
}

// ---------------------------------------------------------------------------
// Product detail
// ---------------------------------------------------------------------------
async function loadProduct(slug: string): Promise<ProductFull | null> {
  const db = supabasePublic();
  const { data, error } = await db.from('products').select(`
    *,
    category:category_id (*, parent:parent_id (id, slug, name)),
    variants:product_variants (*),
    media:product_media (id, media_id, option_match, sort, alt, media:media_id (*)),
    bundle:bundles (product_id, pricing_mode, value, headline,
      items:bundle_items!bundle_items_bundle_product_id_fkey (id, product_id, variant_id, quantity, is_optional, label, sort,
        product:product_id (id, name, slug, option_keys, variants:product_variants (*))))
  `).eq('slug', slug).maybeSingle();
  if (error) { console.error('[catalog] product', error); return null; }
  if (!data) return null;
  const p = data as any;
  p.variants = (p.variants ?? []).filter((v: Variant) => v.is_active).sort((a: Variant, b: Variant) => a.position - b.position);
  p.media = (p.media ?? []).filter((m: any) => m.media).sort((a: any, b: any) => a.sort - b.sort);
  if (p.bundle) {
    p.bundle.items = (p.bundle.items ?? []).sort((a: any, b: any) => a.sort - b.sort).map((it: any) => ({
      ...it, product: { ...it.product, variants: (it.product?.variants ?? []).filter((v: Variant) => v.is_active).sort((a: Variant, b: Variant) => a.position - b.position) },
    }));
  }
  return p as ProductFull;
}
export const getProduct = (slug: string) =>
  unstable_cache(() => loadProduct(slug), ['product-v1', slug], { tags: [CATALOG_TAG, `product:${slug}`], revalidate: REVALIDATE })();

async function loadRelations(productId: string) {
  const { data } = await supabasePublic().from('product_relations').select('related_id, kind, sort').eq('product_id', productId).order('sort');
  return (data ?? []) as { related_id: string; kind: string; sort: number }[];
}
export async function getRelated(productId: string) {
  const rel = await unstable_cache(() => loadRelations(productId), ['rel-v1', productId], { tags: [CATALOG_TAG], revalidate: REVALIDATE })();
  const { entries } = await getCatalog();
  const by = (kind: string) => rel.filter((r) => r.kind === kind).map((r) => entries.find((e) => e.id === r.related_id)).filter(Boolean) as CatalogEntry[];
  const me = entries.find((e) => e.id === productId);
  let related = by('related');
  if (related.length < 4 && me) {
    const extra = entries.filter((e) => e.id !== productId && e.category_ids.some((c) => me.category_ids.includes(c)) && !related.find((r) => r.id === e.id));
    related = [...related, ...extra].slice(0, 8);
  }
  return { related, boughtTogether: by('bought_together'), upsells: by('upsell'), crossSells: by('cross_sell') };
}

async function loadReviews(productId: string) {
  const { data } = await supabasePublic().from('reviews').select('*').eq('product_id', productId).eq('status', 'approved')
    .order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(50);
  return (data ?? []) as Review[];
}
export const getProductReviews = (productId: string) =>
  unstable_cache(() => loadReviews(productId), ['reviews-v1', productId], { tags: [CATALOG_TAG, 'reviews'], revalidate: REVALIDATE })();

export const getFeaturedReviews = unstable_cache(async (limit: number = 8) => {
  const { data } = await supabasePublic().from('reviews').select('*, product:product_id (name, slug)').eq('status', 'approved')
    .gte('rating', 4).order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as Review[];
}, ['featured-reviews-v1'], { tags: [CATALOG_TAG, 'reviews'], revalidate: REVALIDATE });

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------
export const getCollections = unstable_cache(async () => {
  const { data } = await supabasePublic().from('collections').select('*, image:image_id (*)').order('sort');
  return (data ?? []) as Collection[];
}, ['collections-v1'], { tags: [CATALOG_TAG], revalidate: REVALIDATE });

export async function getCollection(slug: string) {
  return (await getCollections()).find((c) => c.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export async function searchProductIds(q: string, limit = 48) {
  const term = q.trim().slice(0, 100);
  if (!term) return [];
  const { data, error } = await supabasePublic().rpc('search_products', { q: term, lim: limit });
  if (error) { console.error('[search]', error); return []; }
  return ((data ?? []) as { product_id: string }[]).map((r) => r.product_id);
}

/** Strip catalogue-only fields before sending a product to the browser. */
export function toCard(e: CatalogEntry): ProductCardData {
  return {
    id: e.id, name: e.name, slug: e.slug, product_type: e.product_type, is_new: e.is_new, rating_avg: e.rating_avg,
    rating_count: e.rating_count, short_description: e.short_description, price_min: e.price_min, price_max: e.price_max,
    compare_at: e.compare_at, in_stock: e.in_stock, images: e.images.slice(0, 2), option_keys: e.option_keys,
    variant_count: e.variant_count, default_variant_id: e.default_variant_id,
  };
}

export async function getAttrMap() {
  const attrs = await getAttributes();
  const map: Record<string, Record<string, { label: string; sort: number; swatch: string | null }>> = {};
  for (const a of attrs) (map[a.attribute] ||= {})[a.slug] = { label: a.label, sort: a.sort, swatch: a.swatch };
  return map;
}
