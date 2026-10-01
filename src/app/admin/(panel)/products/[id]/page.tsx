import { notFound } from 'next/navigation';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ProductEditor } from './product-editor';

export default async function EditProduct({ params }: PageProps<'/admin/products/[id]'>) {
  const staff = await requireStaffPage('products.view');
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: product } = await db.from('products').select('*').eq('id', id).maybeSingle();
  if (!product) notFound();
  const [{ data: variants }, { data: media }, { data: relations }, { data: colLinks }, { data: bundle }, { data: bundleItems }, { data: cats }, { data: cols }, { data: attrs }, { data: allProducts }] = await Promise.all([
    db.from('product_variants').select('*').eq('product_id', id).order('position'),
    db.from('product_media').select('media_id, option_match, alt, sort, media:media_id (id, url, alt, kind)').eq('product_id', id).order('sort'),
    db.from('product_relations').select('related_id, kind, sort').eq('product_id', id).order('sort'),
    db.from('collection_products').select('collection_id').eq('product_id', id),
    db.from('bundles').select('*').eq('product_id', id).maybeSingle(),
    db.from('bundle_items').select('*').eq('bundle_product_id', id).order('sort'),
    db.from('categories').select('id, name, parent_id').order('sort'),
    db.from('collections').select('id, name').order('sort'),
    db.from('attribute_values').select('attribute, label, slug, sort').order('attribute').order('sort'),
    db.from('products').select('id, name, product_type, product_variants (id, title, price, is_active)').neq('id', id).order('name'),
  ]);
  const canCost = staff.permissions.has('finance.view');
  return (
    <ProductEditor
      product={product}
      variants={(variants ?? []).map((v) => (canCost ? v : { ...v, cost_price: null }))}
      media={(media ?? []).map((m: any) => ({ media_id: m.media_id, url: m.media?.url, kind: m.media?.kind, option_match: m.option_match ?? {}, alt: m.alt ?? m.media?.alt ?? '' }))}
      relations={relations ?? []} collectionIds={(colLinks ?? []).map((c) => c.collection_id)}
      bundle={bundle ? { pricing_mode: bundle.pricing_mode, value: Number(bundle.value), headline: bundle.headline, items: (bundleItems ?? []).map((i) => ({ product_id: i.product_id, variant_id: i.variant_id, quantity: i.quantity, is_optional: i.is_optional, label: i.label })) } : null}
      categories={cats ?? []} collections={cols ?? []} attributes={attrs ?? []}
      allProducts={(allProducts ?? []).map((p: any) => ({ id: p.id, name: p.name, type: p.product_type, variants: (p.product_variants ?? []).filter((v: any) => v.is_active).map((v: any) => ({ id: v.id, title: v.title, price: v.price })) }))}
      perms={{ edit: staff.permissions.has('products.edit'), publish: staff.permissions.has('products.publish'), del: staff.permissions.has('products.delete'), stock: staff.permissions.has('inventory.edit'), cost: canCost, create: staff.permissions.has('products.create') }}
    />
  );
}
