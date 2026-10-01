import { notFound } from 'next/navigation';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAttrMap } from '@/lib/data/catalog';
import { getSettings } from '@/lib/data/content';
import { ProductView } from '@/components/product/product-view';
import { StoreProvider } from '@/components/store/store-provider';
import type { ProductFull } from '@/lib/types';

// Staff-only preview of draft/hidden products using the storefront product component.
export default async function Preview({ params }: PageProps<'/admin/products/[id]/preview'>) {
  await requireStaffPage('products.view');
  const { id } = await params;
  const db = supabaseAdmin();
  const { data } = await db.from('products').select(`*, category:category_id (*, parent:parent_id (id, slug, name)), variants:product_variants (*), media:product_media (id, media_id, option_match, sort, alt, media:media_id (*)),
    bundle:bundles (product_id, pricing_mode, value, headline, items:bundle_items!bundle_items_bundle_product_id_fkey (id, product_id, variant_id, quantity, is_optional, label, sort, product:product_id (id, name, slug, option_keys, variants:product_variants (*))))`).eq('id', id).maybeSingle();
  if (!data) notFound();
  const p = data as any;
  p.variants = p.variants.filter((v: any) => v.is_active).sort((a: any, b: any) => a.position - b.position).map(({ cost_price: _c, ...v }: any) => v);
  p.media = p.media.sort((a: any, b: any) => a.sort - b.sort);
  const settings = await getSettings();
  return (
    <StoreProvider currencies={settings.currencies.display}>
      <div className="bg-bg">
        <p className="bg-accent px-4 py-2 text-center text-[12px] uppercase tracking-[0.2em]">Preview · {p.status} — not visible to customers until published</p>
        <div className="container-x py-10"><ProductView product={p as ProductFull} attrs={await getAttrMap()} /></div>
      </div>
    </StoreProvider>
  );
}
