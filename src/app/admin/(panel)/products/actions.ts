'use server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, refreshStore, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';
import { slugify } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';
import type { StaffContext } from '@/lib/auth';

const naira = (k: number | null | undefined) => `₦${((k ?? 0) / 100).toLocaleString('en-NG')}`;

const VariantSchema = z.object({
  id: z.string().optional().nullable(), sku: z.string().trim().max(80).optional().nullable(), title: z.string().max(200),
  options: z.record(z.string(), z.string()), price: z.number().int().min(0), compare_at_price: z.number().int().min(0).nullable().optional(),
  cost_price: z.number().int().min(0).nullable().optional(), weight_grams: z.number().int().min(0).nullable().optional(),
  image_id: z.string().nullable().optional(), is_active: z.boolean(), track_inventory: z.boolean(), stock_on_hand: z.number().int(),
  low_stock_threshold: z.number().int().min(0), allow_backorder: z.boolean(), restock_date: z.string().nullable().optional(),
});

const Payload = z.object({
  name: z.string().trim().min(2).max(200), slug: z.string().trim().max(200).optional(), sku: z.string().trim().max(80).nullable().optional(),
  product_type: z.enum(['hair', 'wig', 'bundle_deal', 'accessory', 'custom_unit', 'service', 'gift_card']),
  category_id: z.string().nullable().optional(), brand: z.string().max(80).default('HairverGreen'),
  status: z.enum(['draft', 'active', 'hidden', 'archived']), publish_at: z.string().nullable().optional(),
  short_description: z.string().max(600).nullable().optional(), description: z.string().max(40000).nullable().optional(),
  details: z.record(z.string(), z.unknown()).default({}), tags: z.array(z.string().max(60)).max(40).default([]),
  option_keys: z.array(z.string().regex(/^[a-z_]+$/)).max(6).default([]),
  is_featured: z.boolean(), is_new: z.boolean(), requires_review: z.boolean(), weight_grams: z.number().int().min(0).default(0),
  shipping_class: z.string().max(40).default('standard'), tax_class: z.string().max(40).default('standard'),
  seo_title: z.string().max(200).nullable().optional(), seo_description: z.string().max(400).nullable().optional(), og_image_id: z.string().nullable().optional(), noindex: z.boolean().default(false),
  variants: z.array(VariantSchema).min(1).max(400),
  media: z.array(z.object({ media_id: z.string(), option_match: z.record(z.string(), z.string()).default({}), alt: z.string().max(300).nullable().optional() })).max(40),
  relations: z.array(z.object({ related_id: z.string(), kind: z.enum(['related', 'upsell', 'cross_sell', 'bought_together']) })).max(60).default([]),
  collection_ids: z.array(z.string()).max(40).default([]),
  bundle: z.object({ pricing_mode: z.enum(['fixed', 'percent_off', 'amount_off']), value: z.number().min(0), headline: z.string().max(200).nullable().optional(),
    items: z.array(z.object({ product_id: z.string(), variant_id: z.string().nullable().optional(), quantity: z.number().int().min(1).max(20), is_optional: z.boolean(), label: z.string().max(80).nullable().optional() })).max(20) }).nullable().optional(),
});
export type ProductPayload = z.infer<typeof Payload>;

export async function saveProduct(id: string, raw: string): Promise<ActionResult> {
  return guarded('products.edit', async (staff) => {
    let parsed;
    try { parsed = Payload.safeParse(JSON.parse(raw)); } catch { return { error: 'Invalid data' }; }
    if (!parsed.success) { const i = parsed.error.issues[0]; return { error: `${i.path.join('.')}: ${i.message}` }; }
    const p = parsed.data;
    if (p.status === 'active' && !staff.permissions.has('products.publish')) return { error: 'You can save drafts but need “publish” permission to make a product live.' };
    const db = supabaseAdmin();
    const { data: before } = await db.from('products').select('*').eq('id', id).single();
    if (!before) return { error: 'Product not found' };
    const { data: beforeVariants } = await db.from('product_variants').select('*').eq('product_id', id);

    const slug = slugify(p.slug || p.name) || slugify(p.name);
    const prices = p.variants.filter((v) => v.is_active).map((v) => v.price);
    const productRow = {
      name: p.name, slug, sku: p.sku || null, product_type: p.product_type, category_id: p.category_id || null, brand: p.brand, status: p.status,
      publish_at: p.publish_at || null, short_description: p.short_description || null, description: sanitizeHtml(p.description || ''),
      details: { ...p.details, care: typeof p.details.care === 'string' ? sanitizeHtml(p.details.care) : p.details.care },
      tags: p.tags, option_keys: p.option_keys, price: prices.length ? Math.min(...prices) : 0, is_featured: p.is_featured, is_new: p.is_new,
      requires_review: p.requires_review || p.product_type === 'custom_unit', weight_grams: p.weight_grams, shipping_class: p.shipping_class, tax_class: p.tax_class,
      seo_title: p.seo_title || null, seo_description: p.seo_description || null, og_image_id: p.og_image_id || null, noindex: p.noindex,
    };
    const { error: pe } = await db.from('products').update(productRow).eq('id', id);
    if (pe) throw pe;

    // Variants
    const canStock = staff.permissions.has('inventory.edit');
    const canCost = staff.permissions.has('finance.view');
    const keep = new Set<string>();
    const changes: string[] = [];
    for (const [i, v] of p.variants.entries()) {
      const prev = beforeVariants?.find((b) => b.id === v.id);
      const row: Record<string, unknown> = {
        product_id: id, sku: v.sku || null, title: v.title || 'Default', options: v.options, price: v.price, compare_at_price: v.compare_at_price ?? null,
        weight_grams: v.weight_grams ?? null, image_id: v.image_id || null, is_active: v.is_active, position: i, track_inventory: v.track_inventory,
        low_stock_threshold: v.low_stock_threshold, allow_backorder: v.allow_backorder, restock_date: v.restock_date || null,
      };
      if (canCost) row.cost_price = v.cost_price ?? null;
      if (prev) {
        await db.from('product_variants').update(row).eq('id', prev.id);
        keep.add(prev.id);
        if (prev.price !== v.price) changes.push(`${p.name} — ${v.title}: price ${naira(prev.price)} → ${naira(v.price)}`);
        if (canStock && prev.stock_on_hand !== v.stock_on_hand) {
          await db.rpc('adjust_stock', { p_variant: prev.id, p_delta: v.stock_on_hand - prev.stock_on_hand, p_reason: 'adjustment', p_note: 'Edited in product editor', p_actor: staff.id });
          changes.push(`${v.title}: stock ${prev.stock_on_hand} → ${v.stock_on_hand}`);
        }
      } else {
        const { data: ins, error } = await db.from('product_variants').insert({ ...row, stock_on_hand: 0 }).select('id').single();
        if (error) throw error;
        keep.add(ins.id);
        if (canStock && v.stock_on_hand) await db.rpc('adjust_stock', { p_variant: ins.id, p_delta: v.stock_on_hand, p_reason: 'adjustment', p_note: 'Initial stock', p_actor: staff.id });
        changes.push(`Added variant ${v.title}`);
      }
    }
    for (const b of beforeVariants ?? []) {
      if (keep.has(b.id)) continue;
      const { error } = await db.from('product_variants').delete().eq('id', b.id);
      if (error) await db.from('product_variants').update({ is_active: false }).eq('id', b.id); // referenced by a bundle: deactivate instead
      changes.push(`Removed variant ${b.title}`);
    }

    // Media, relations, collections
    await db.from('product_media').delete().eq('product_id', id);
    if (p.media.length) await db.from('product_media').insert(p.media.map((m, i) => ({ product_id: id, media_id: m.media_id, option_match: m.option_match, alt: m.alt || null, sort: i })));
    await db.from('product_relations').delete().eq('product_id', id);
    const rel = p.relations.filter((r) => r.related_id !== id);
    if (rel.length) await db.from('product_relations').insert(rel.map((r, i) => ({ product_id: id, related_id: r.related_id, kind: r.kind, sort: i })));
    if (staff.permissions.has('collections.manage') || staff.permissions.has('products.edit')) {
      await db.from('collection_products').delete().eq('product_id', id);
      if (p.collection_ids.length) await db.from('collection_products').insert(p.collection_ids.map((c) => ({ collection_id: c, product_id: id })));
    }

    // Bundle configuration
    if (p.product_type === 'bundle_deal' && p.bundle) {
      await db.from('bundles').upsert({ product_id: id, pricing_mode: p.bundle.pricing_mode, value: Math.round(p.bundle.value), headline: p.bundle.headline || null });
      await db.from('bundle_items').delete().eq('bundle_product_id', id);
      if (p.bundle.items.length) await db.from('bundle_items').insert(p.bundle.items.map((it, i) => ({ bundle_product_id: id, product_id: it.product_id, variant_id: it.variant_id || null, quantity: it.quantity, is_optional: it.is_optional, label: it.label || null, sort: i })));
      await db.from('product_variants').update({ track_inventory: false }).eq('product_id', id);
    } else if (p.product_type !== 'bundle_deal') {
      await db.from('bundles').delete().eq('product_id', id);
    }

    const summary = [before.status !== p.status ? `status ${before.status} → ${p.status}` : '', ...changes].filter(Boolean);
    await audit(staff, { action: 'update', entityType: 'product', entityId: id, summary: `${p.name}: ${summary.join('; ') || 'details updated'}`.slice(0, 1000),
      before: pickAuditable(before), after: pickAuditable({ ...before, ...productRow }) });
    refreshStore('catalog');
    return { ok: true, message: 'Product saved' };
  });
}

function pickAuditable(o: Record<string, unknown>) {
  const { name, slug, status, price, category_id, short_description, is_featured, is_new, tags, seo_title, seo_description, publish_at } = o as Record<string, unknown>;
  return { name, slug, status, price, category_id, short_description, is_featured, is_new, tags, seo_title, seo_description, publish_at };
}

export async function createProduct(type: string = 'hair'): Promise<ActionResult> {
  return guarded('products.create', async (staff) => {
    const db = supabaseAdmin();
    const slug = `new-product-${Date.now().toString(36)}`;
    const { data, error } = await db.from('products').insert({ name: 'Untitled product', slug, status: 'draft', product_type: ['hair', 'wig', 'bundle_deal', 'accessory', 'custom_unit'].includes(type) ? type : 'hair', created_by: staff.id }).select('id').single();
    if (error) throw error;
    await db.from('product_variants').insert({ product_id: data.id, title: 'Default', options: {}, price: 0, track_inventory: type !== 'bundle_deal' && type !== 'custom_unit' });
    if (type === 'bundle_deal') await db.from('bundles').insert({ product_id: data.id, pricing_mode: 'percent_off', value: 10 });
    await audit(staff, { action: 'create', entityType: 'product', entityId: data.id, summary: 'Created draft product' });
    return { ok: true, redirect: `/admin/products/${data.id}` };
  });
}

export async function duplicateProduct(id: string): Promise<ActionResult> {
  return guarded('products.create', async (staff) => {
    const db = supabaseAdmin();
    const { data: p } = await db.from('products').select('*').eq('id', id).single();
    if (!p) return { error: 'Not found' };
    const { id: _id, created_at: _c, updated_at: _u, search_vector: _s, search_text: _t, rating_avg: _r, rating_count: _rc, sales_count: _sc, ...rest } = p;
    const suffix = Date.now().toString(36);
    const { data: np, error } = await db.from('products').insert({ ...rest, name: `${p.name} (copy)`, slug: `${p.slug}-copy-${suffix}`, sku: p.sku ? `${p.sku}-COPY` : null, status: 'draft', created_by: staff.id }).select('id').single();
    if (error) throw error;
    const [{ data: vs }, { data: media }, { data: bundle }, { data: items }] = await Promise.all([
      db.from('product_variants').select('*').eq('product_id', id), db.from('product_media').select('*').eq('product_id', id),
      db.from('bundles').select('*').eq('product_id', id).maybeSingle(), db.from('bundle_items').select('*').eq('bundle_product_id', id),
    ]);
    if (vs?.length) await db.from('product_variants').insert(vs.map(({ id: _, created_at: __, updated_at: ___, ...v }) => ({ ...v, product_id: np.id, sku: v.sku ? `${v.sku}-${suffix}`.toUpperCase() : null, stock_on_hand: 0, stock_reserved: 0 })));
    if (media?.length) await db.from('product_media').insert(media.map(({ id: _, ...m }) => ({ ...m, product_id: np.id })));
    if (bundle) { await db.from('bundles').insert({ ...bundle, product_id: np.id, created_at: undefined }); if (items?.length) await db.from('bundle_items').insert(items.map(({ id: _, ...it }) => ({ ...it, bundle_product_id: np.id }))); }
    await audit(staff, { action: 'create', entityType: 'product', entityId: np.id, summary: `Duplicated from ${p.name}` });
    return { ok: true, redirect: `/admin/products/${np.id}`, message: 'Duplicated as a draft' };
  });
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  return guarded('products.delete', async (staff) => {
    const db = supabaseAdmin();
    const { data: p } = await db.from('products').select('name').eq('id', id).single();
    const { count } = await db.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id);
    if (count) {
      await db.from('products').update({ status: 'archived' }).eq('id', id);
      await audit(staff, { action: 'archive', entityType: 'product', entityId: id, summary: `${p?.name} archived (has order history)` });
      refreshStore('catalog');
      return { ok: true, message: 'This product has order history, so it was archived instead of deleted.', redirect: '/admin/products' };
    }
    const { error } = await db.from('products').delete().eq('id', id);
    if (error) return { error: 'This product is part of a bundle — remove it from the bundle first, or archive it.' };
    await audit(staff, { action: 'delete', entityType: 'product', entityId: id, summary: `Deleted ${p?.name}` });
    refreshStore('catalog');
    return { ok: true, message: 'Product deleted', redirect: '/admin/products' };
  });
}

export async function bulkStatus(ids: string[], status: 'active' | 'hidden' | 'draft' | 'archived'): Promise<ActionResult> {
  return guarded('products.publish', async (staff: StaffContext) => {
    if (!ids.length) return { error: 'Select products first' };
    await supabaseAdmin().from('products').update({ status }).in('id', ids.slice(0, 200));
    await audit(staff, { action: 'bulk_update', entityType: 'product', summary: `Set ${ids.length} products to ${status}`, after: { ids, status } });
    refreshStore('catalog');
    return { ok: true, message: `${ids.length} product(s) set to ${status}` };
  });
}
