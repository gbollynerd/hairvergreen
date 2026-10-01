'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Trash2, Plus, Wand2, ExternalLink, Copy, ImagePlus } from 'lucide-react';
import { adminToast, Field, MediaPicker, ListEditor, TagsInput, ActionButton } from '@/components/admin/client';
import { RichText } from '@/components/admin/rich-text';
import { saveProduct, duplicateProduct, deleteProduct } from '../actions';
import { cn, slugify, titleCase } from '@/lib/utils';

type V = {
  id?: string | null; sku: string | null; title: string; options: Record<string, string>; price: number; compare_at_price: number | null; cost_price: number | null;
  weight_grams: number | null; image_id: string | null; is_active: boolean; track_inventory: boolean; stock_on_hand: number; stock_reserved?: number;
  low_stock_threshold: number; allow_backorder: boolean; restock_date: string | null;
};
type M = { media_id: string; url: string; kind: string; option_match: Record<string, string>; alt: string };
type Attr = { attribute: string; label: string; slug: string; sort: number };
type BundleItem = { product_id: string; variant_id: string | null; quantity: number; is_optional: boolean; label: string | null };

const TABS = ['Information', 'Organisation', 'Variants & pricing', 'Inventory', 'Images', 'Details', 'SEO', 'Related', 'Publish'] as const;
const OPTION_LABELS: Record<string, string> = { texture: 'Texture', length: 'Length', color: 'Colour', lace: 'Lace', density: 'Density', construction: 'Construction', cap_size: 'Cap size' };
const N = (kobo: number | null | undefined) => (kobo == null ? '' : String(kobo / 100));
const K = (naira: string) => (naira.trim() === '' ? null : Math.round(Number(naira.replace(/[^0-9.]/g, '')) * 100));

export function ProductEditor({ product, variants: v0, media: m0, relations: r0, collectionIds: c0, bundle: b0, categories, collections, attributes, allProducts, perms }: {
  product: any; variants: V[]; media: M[]; relations: { related_id: string; kind: string }[]; collectionIds: string[];
  bundle: { pricing_mode: string; value: number; headline: string | null; items: BundleItem[] } | null;
  categories: { id: string; name: string; parent_id: string | null }[]; collections: { id: string; name: string }[]; attributes: Attr[];
  allProducts: { id: string; name: string; type: string; variants: { id: string; title: string; price: number }[] }[];
  perms: { edit: boolean; publish: boolean; del: boolean; stock: boolean; cost: boolean; create: boolean };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Information');
  const [p, setP] = useState({ ...product, details: product.details ?? {}, tags: (product.tags ?? []).filter((t: string) => t !== 'demo') });
  const [variants, setVariants] = useState<V[]>(v0);
  const [media, setMedia] = useState<M[]>(m0);
  const [relations, setRelations] = useState(r0);
  const [collectionIds, setCollectionIds] = useState<string[]>(c0);
  const [bundle, setBundle] = useState(b0 ?? { pricing_mode: 'percent_off', value: 10, headline: '', items: [] as BundleItem[] });
  const [optionKeys, setOptionKeys] = useState<string[]>(product.option_keys ?? []);
  const [picker, setPicker] = useState(false);
  const [saving, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const up = (patch: Record<string, unknown>) => { setP((x: any) => ({ ...x, ...patch })); setDirty(true); };
  const upD = (patch: Record<string, unknown>) => { setP((x: any) => ({ ...x, details: { ...x.details, ...patch } })); setDirty(true); };
  const attrKeys = useMemo(() => [...new Set(attributes.map((a) => a.attribute))], [attributes]);
  const label = (k: string, v: string) => attributes.find((a) => a.attribute === k && a.slug === v)?.label ?? v;
  const isBundle = p.product_type === 'bundle_deal';

  const save = (status?: string) => start(async () => {
    const payload = {
      ...p, status: status ?? p.status, tags: p.tags, option_keys: optionKeys, details: p.details,
      variants: variants.map((v) => ({ ...v, title: v.title || (Object.keys(v.options).length ? Object.entries(v.options).map(([k, x]) => label(k, x)).join(' / ') : 'Default') })),
      media: media.map((m) => ({ media_id: m.media_id, option_match: m.option_match, alt: m.alt })), relations, collection_ids: collectionIds,
      bundle: isBundle ? { ...bundle, value: Number(bundle.value) || 0 } : null,
    };
    const r = await saveProduct(product.id, JSON.stringify(payload));
    if (r?.error) adminToast(r.error, 'error');
    else { adminToast(status === 'active' ? 'Published' : 'Saved'); setDirty(false); if (status) up({ status }); router.refresh(); }
  });

  // Variant generation from selected option values
  const [gen, setGen] = useState<Record<string, string[]>>(() => {
    const g: Record<string, string[]> = {};
    for (const k of product.option_keys ?? []) g[k] = [...new Set(v0.map((v) => v.options?.[k]).filter(Boolean))] as string[];
    return g;
  });
  const [bulk, setBulk] = useState({ price: '', compare: '', cost: '', stock: '', step: '' });
  const generate = () => {
    const keys = optionKeys.filter((k) => gen[k]?.length);
    let combos: Record<string, string>[] = [{}];
    for (const k of keys) combos = combos.flatMap((c) => gen[k].map((v) => ({ ...c, [k]: v })));
    if (combos.length > 300) { adminToast('Too many combinations (max 300) — narrow your selection', 'error'); return; }
    const base = variants[0];
    const next = combos.map((o) => {
      const existing = variants.find((v) => keys.every((k) => v.options[k] === o[k]) && Object.keys(v.options).length === keys.length);
      return existing ?? { id: null, sku: p.sku ? [p.sku, ...Object.values(o).map((x) => x.toUpperCase().replace(/[^A-Z0-9]/g, ''))].join('-') : null, title: '', options: o,
        price: base?.price ?? 0, compare_at_price: null, cost_price: base?.cost_price ?? null, weight_grams: null, image_id: null, is_active: true,
        track_inventory: !isBundle, stock_on_hand: 0, low_stock_threshold: 2, allow_backorder: false, restock_date: null };
    });
    setVariants(next.length ? next : [{ ...(base ?? {}), options: {}, title: 'Default' } as V]);
    setDirty(true);
    adminToast(`${next.length} variant${next.length === 1 ? '' : 's'} — existing prices and stock kept`);
  };
  const applyBulk = () => {
    const step = K(bulk.step || '0') ?? 0;
    setVariants((vs) => vs.map((v, i) => ({
      ...v,
      ...(bulk.price ? { price: (K(bulk.price) ?? 0) + (step ? step * (Number(v.options.length ? (Number(v.options.length) - Math.min(...vs.map((x) => Number(x.options.length) || 0))) / 2 : i)) : 0) } : {}),
      ...(bulk.compare ? { compare_at_price: K(bulk.compare) } : {}), ...(bulk.cost && perms.cost ? { cost_price: K(bulk.cost) } : {}),
      ...(bulk.stock && perms.stock ? { stock_on_hand: Number(bulk.stock) } : {}),
    })));
    setDirty(true);
  };
  const setV = (i: number, patch: Partial<V>) => { setVariants((vs) => vs.map((v, n) => (n === i ? { ...v, ...patch } : v))); setDirty(true); };

  const inp = 'input !min-h-[36px] !py-1 !text-[13px]';
  return (
    <div>
      <div className="sticky top-14 z-30 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[#f3f0e8]/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="min-w-0">
          <Link href={isBundle ? '/admin/products?type=bundle_deal' : '/admin/products'} className="text-[12px] text-muted">← {isBundle ? 'Bundles' : 'Products'}</Link>
          <h1 className="truncate font-display text-[26px] leading-tight">{p.name}</h1>
          <p className="text-[12px] text-muted">Status: <strong className="text-ink">{titleCase(p.status)}</strong>{dirty && <span className="ml-2 text-sale">· unsaved changes</span>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={p.status === 'active' ? `/products/${p.slug}` : `/admin/products/${product.id}/preview`} target="_blank" className="btn btn-outline btn-sm"><ExternalLink size={13} /> Preview</a>
          {perms.create && <ActionButton action={duplicateProduct.bind(null, product.id)}><Copy size={13} /> Duplicate</ActionButton>}
          {perms.edit && <button type="button" disabled={saving} onClick={() => save(p.status === 'active' ? undefined : 'draft')} className="btn btn-outline btn-sm">{saving ? 'Saving…' : p.status === 'active' ? 'Save' : 'Save draft'}</button>}
          {perms.publish && p.status !== 'active' && <button type="button" disabled={saving} onClick={() => save('active')} className="btn btn-primary btn-sm">Publish</button>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Product sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0 lg:flex-col">
          {TABS.filter((t) => !(isBundle && t === 'Inventory')).map((t, i) => (
            <button key={t} type="button" onClick={() => setTab(t)} aria-current={tab === t ? 'step' : undefined}
              className={cn('flex shrink-0 items-center gap-3 px-3 py-2 text-left text-[13px]', tab === t ? 'bg-surface font-medium ring-1 ring-line' : 'text-muted hover:text-ink')}>
              <span className="grid h-5 w-5 place-items-center rounded-full border border-line text-[10px]">{i + 1}</span>{t === 'Variants & pricing' && isBundle ? 'Bundle & pricing' : t}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          {tab === 'Information' && (
            <section className="grid gap-5 border border-line bg-surface p-5">
              <Field label="Product name"><input value={p.name} onChange={(e) => up({ name: e.target.value, ...(product.name === 'Untitled product' && p.slug.startsWith('new-product') ? {} : {}) })} className="input" /></Field>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="URL slug" hint={`/products/${slugify(p.slug || p.name)}`}><input value={p.slug} onChange={(e) => up({ slug: e.target.value })} onBlur={() => up({ slug: slugify(p.slug || p.name) })} className="input" /></Field>
                <Field label="Base SKU"><input value={p.sku ?? ''} onChange={(e) => up({ sku: e.target.value.toUpperCase() })} className="input" /></Field>
              </div>
              <Field label="Short description" hint="Shown beside the price on the product page and in search results."><textarea value={p.short_description ?? ''} onChange={(e) => up({ short_description: e.target.value })} className="input !min-h-[80px]" maxLength={600} /></Field>
              <Field label="Description"><RichText defaultValue={p.description ?? ''} onChange={(h) => up({ description: h })} /></Field>
            </section>
          )}

          {tab === 'Organisation' && (
            <section className="grid gap-5 border border-line bg-surface p-5 md:grid-cols-2">
              <Field label="Product type"><select value={p.product_type} onChange={(e) => up({ product_type: e.target.value })} className="input">
                {[['hair', 'Hair (bundles, closures, frontals, extensions)'], ['wig', 'Wig / unit'], ['bundle_deal', 'Bundle deal / set'], ['custom_unit', 'Custom unit (configurator)'], ['accessory', 'Accessory / care']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              <Field label="Category"><select value={p.category_id ?? ''} onChange={(e) => up({ category_id: e.target.value || null })} className="input"><option value="">— None —</option>
                {categories.filter((c) => !c.parent_id).map((c) => <optgroup key={c.id} label={c.name}><option value={c.id}>{c.name} (all)</option>{categories.filter((s) => s.parent_id === c.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}</select></Field>
              <Field label="Brand"><input value={p.brand} onChange={(e) => up({ brand: e.target.value })} className="input" /></Field>
              <Field label="Tags" hint="Used by search and filters."><TagsInput name="_tags" defaultValue={p.tags} onChange={(t) => up({ tags: t })} /></Field>
              <fieldset className="md:col-span-2"><legend className="label mb-2">Collections</legend>
                <div className="flex flex-wrap gap-2">{collections.map((c) => <button key={c.id} type="button" aria-pressed={collectionIds.includes(c.id)} className="chip !min-h-[34px] text-[12px]" onClick={() => { setCollectionIds((x) => x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]); setDirty(true); }}>{c.name}</button>)}</div>
              </fieldset>
              <div className="flex flex-wrap gap-6 md:col-span-2">
                <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={p.is_featured} onChange={(e) => up({ is_featured: e.target.checked })} /> Featured</label>
                <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={p.is_new} onChange={(e) => up({ is_new: e.target.checked })} /> “New” badge</label>
                <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={p.requires_review || p.product_type === 'custom_unit'} disabled={p.product_type === 'custom_unit'} onChange={(e) => up({ requires_review: e.target.checked })} /> Orders need customization review</label>
              </div>
            </section>
          )}

          {tab === 'Variants & pricing' && !isBundle && (
            <>
              <section className="border border-line bg-surface p-5">
                <p className="label mb-3">Options customers choose</p>
                <div className="flex flex-wrap gap-2">{attrKeys.map((k) => <button key={k} type="button" className="chip !min-h-[34px] text-[12px]" aria-pressed={optionKeys.includes(k)} onClick={() => { setOptionKeys((x) => x.includes(k) ? x.filter((y) => y !== k) : [...x, k]); setDirty(true); }}>{OPTION_LABELS[k] ?? titleCase(k)}</button>)}</div>
                {optionKeys.length > 0 && (
                  <div className="mt-5 space-y-4">
                    {optionKeys.map((k) => (
                      <div key={k}><p className="mb-2 text-[12px] text-muted">{OPTION_LABELS[k] ?? k} values</p>
                        <div className="flex flex-wrap gap-1.5">{attributes.filter((a) => a.attribute === k).map((a) => (
                          <button key={a.slug} type="button" className="chip !min-h-[30px] !px-2.5 text-[12px]" aria-pressed={gen[k]?.includes(a.slug)} onClick={() => setGen((g) => ({ ...g, [k]: g[k]?.includes(a.slug) ? g[k].filter((x) => x !== a.slug) : [...(g[k] ?? []), a.slug] }))}>{a.label}</button>
                        ))}</div>
                      </div>
                    ))}
                    <button type="button" onClick={generate} className="btn btn-primary btn-sm"><Wand2 size={14} /> Generate variants</button>
                    <p className="text-[12px] text-muted">Missing a value (e.g. a new texture)? Add it in <Link href="/admin/categories" className="underline">Categories & attributes</Link>.</p>
                  </div>
                )}
              </section>
              <section className="border border-line bg-surface p-5">
                <p className="label mb-3">Set for all variants</p>
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Price ₦"><input value={bulk.price} onChange={(e) => setBulk({ ...bulk, price: e.target.value })} className={inp} /></Field>
                  <Field label="+ per 2&quot; length ₦"><input value={bulk.step} onChange={(e) => setBulk({ ...bulk, step: e.target.value })} className={inp} placeholder="optional" /></Field>
                  <Field label="Compare-at ₦"><input value={bulk.compare} onChange={(e) => setBulk({ ...bulk, compare: e.target.value })} className={inp} /></Field>
                  {perms.cost && <Field label="Cost ₦"><input value={bulk.cost} onChange={(e) => setBulk({ ...bulk, cost: e.target.value })} className={inp} /></Field>}
                  {perms.stock && <Field label="Stock"><input value={bulk.stock} onChange={(e) => setBulk({ ...bulk, stock: e.target.value })} className={inp} /></Field>}
                  <button type="button" onClick={applyBulk} className="btn btn-outline btn-sm">Apply</button>
                </div>
              </section>
              <VariantTable variants={variants} setV={setV} remove={(i) => { setVariants((vs) => vs.filter((_, n) => n !== i)); setDirty(true); }} label={label} media={media} perms={perms} />
            </>
          )}

          {tab === 'Variants & pricing' && isBundle && (
            <BundleEditor bundle={bundle} setBundle={(b) => { setBundle(b); setDirty(true); }} products={allProducts.filter((x) => x.type !== 'bundle_deal')} fixedPrice={variants[0]?.price ?? 0}
              setFixedPrice={(price) => setV(0, { price })} />
          )}

          {tab === 'Inventory' && !isBundle && (
            <section className="border border-line bg-surface p-5">
              <p className="mb-4 text-[13px] text-muted">Stock changes are logged in the inventory history. Reserved units are held by unpaid orders.</p>
              <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13px]">
                <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.12em] text-muted"><th className="py-2">Variant</th><th>Track</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Low-stock alert at</th><th>Backorder</th><th>Restock date</th></tr></thead>
                <tbody className="divide-y divide-line">{variants.map((v, i) => (
                  <tr key={i}><td className="py-2">{v.title || Object.entries(v.options).map(([k, x]) => label(k, x)).join(' / ') || 'Default'}</td>
                    <td><input type="checkbox" checked={v.track_inventory} onChange={(e) => setV(i, { track_inventory: e.target.checked })} /></td>
                    <td><input type="number" disabled={!perms.stock} value={v.stock_on_hand} onChange={(e) => setV(i, { stock_on_hand: Number(e.target.value) })} className={cn(inp, 'w-20')} /></td>
                    <td>{v.stock_reserved ?? 0}</td><td>{v.stock_on_hand - (v.stock_reserved ?? 0)}</td>
                    <td><input type="number" value={v.low_stock_threshold} onChange={(e) => setV(i, { low_stock_threshold: Number(e.target.value) })} className={cn(inp, 'w-20')} /></td>
                    <td><input type="checkbox" checked={v.allow_backorder} onChange={(e) => setV(i, { allow_backorder: e.target.checked })} /></td>
                    <td><input type="date" value={v.restock_date ?? ''} onChange={(e) => setV(i, { restock_date: e.target.value || null })} className={inp} /></td></tr>
                ))}</tbody></table></div>
              <Field label="Default shipping weight (grams)" className="mt-5 max-w-xs"><input type="number" value={p.weight_grams} onChange={(e) => up({ weight_grams: Number(e.target.value) })} className="input" /></Field>
            </section>
          )}

          {tab === 'Images' && (
            <section className="border border-line bg-surface p-5">
              <div className="mb-4 flex items-center justify-between"><p className="text-[13px] text-muted">First image is the main image. Tag an image with an option (e.g. Texture: Body Wave) so it shows when that option is selected.</p>
                <button type="button" onClick={() => setPicker(true)} className="btn btn-primary btn-sm"><ImagePlus size={14} /> Add media</button></div>
              <ul className="space-y-3">{media.map((m, i) => (
                <li key={m.media_id + i} className="flex flex-wrap items-center gap-3 border border-line p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.kind === 'video' ? <video src={`${m.url}#t=0.5`} preload="metadata" className="h-20 w-16 object-cover" muted /> : <img src={m.url} alt="" className="h-20 w-16 object-cover" />}
                  <input value={m.alt} onChange={(e) => { setMedia((x) => x.map((y, n) => n === i ? { ...y, alt: e.target.value } : y)); setDirty(true); }} placeholder="Alt text (describe the image)" className={cn(inp, 'min-w-[200px] flex-1')} />
                  {optionKeys.map((k) => (
                    <select key={k} value={m.option_match[k] ?? ''} onChange={(e) => { const om = { ...m.option_match }; if (e.target.value) om[k] = e.target.value; else delete om[k]; setMedia((x) => x.map((y, n) => n === i ? { ...y, option_match: om } : y)); setDirty(true); }} className={cn(inp, '!w-auto')} aria-label={`${k} for this image`}>
                      <option value="">Any {OPTION_LABELS[k]?.toLowerCase() ?? k}</option>{[...new Set(variants.map((v) => v.options[k]).filter(Boolean))].map((x) => <option key={x} value={x}>{label(k, x)}</option>)}
                    </select>
                  ))}
                  <div className="flex gap-1">
                    <button type="button" onClick={() => { if (i === 0) return; setMedia((x) => { const c = [...x]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; }); setDirty(true); }} className="grid h-8 w-8 place-items-center border border-line" aria-label="Move up"><ArrowUp size={13} /></button>
                    <button type="button" onClick={() => { if (i === media.length - 1) return; setMedia((x) => { const c = [...x]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; return c; }); setDirty(true); }} className="grid h-8 w-8 place-items-center border border-line" aria-label="Move down"><ArrowDown size={13} /></button>
                    <button type="button" onClick={() => { setMedia((x) => x.filter((_, n) => n !== i)); setDirty(true); }} className="grid h-8 w-8 place-items-center border border-line text-sale" aria-label="Remove"><Trash2 size={13} /></button>
                  </div>
                </li>
              ))}</ul>
              <MediaPicker open={picker} multiple onClose={() => setPicker(false)} onPick={(ms) => { setMedia((x) => [...x, ...ms.map((m) => ({ media_id: m.id, url: m.url, kind: m.kind, option_match: {}, alt: m.alt }))]); setDirty(true); }} />
            </section>
          )}

          {tab === 'Details' && (
            <section className="grid gap-5 border border-line bg-surface p-5 md:grid-cols-2">
              {[['origin', 'Origin'], ['grade', 'Grade'], ['weight_per_bundle', 'Weight per bundle'], ['construction', 'Construction'], ['cap', 'Cap'], ['lace_info', 'Lace information'], ['density_info', 'Density information'], ['production_time', 'Production time']].map(([k, l]) => (
                <Field key={k} label={l}><input value={(p.details[k] as string) ?? ''} onChange={(e) => upD({ [k]: e.target.value })} className="input" /></Field>
              ))}
              <Field label="Hair information" className="md:col-span-2"><textarea value={p.details.hair_info ?? ''} onChange={(e) => upD({ hair_info: e.target.value })} className="input !min-h-[70px]" /></Field>
              <Field label="Care instructions" className="md:col-span-2"><RichText defaultValue={p.details.care ?? ''} onChange={(h) => upD({ care: h })} minHeight={120} /></Field>
              <Field label="Shipping note" className="md:col-span-2"><textarea value={p.details.shipping_note ?? ''} onChange={(e) => upD({ shipping_note: e.target.value })} className="input !min-h-[60px]" /></Field>
              <Field label="Returns note" className="md:col-span-2" hint="Must match your actual Refund Policy."><textarea value={p.details.returns_note ?? ''} onChange={(e) => upD({ returns_note: e.target.value })} className="input !min-h-[60px]" /></Field>
              <div className="md:col-span-2"><p className="label mb-2">Product FAQ</p><FaqEditor value={p.details.faq ?? []} onChange={(faq) => upD({ faq })} /></div>
            </section>
          )}

          {tab === 'SEO' && (
            <section className="grid gap-5 border border-line bg-surface p-5">
              <Field label="SEO title" hint={`${(p.seo_title || p.name).length}/60 characters`}><input value={p.seo_title ?? ''} onChange={(e) => up({ seo_title: e.target.value })} placeholder={p.name} className="input" /></Field>
              <Field label="Meta description" hint={`${(p.seo_description || p.short_description || '').length}/160 characters`}><textarea value={p.seo_description ?? ''} onChange={(e) => up({ seo_description: e.target.value })} placeholder={p.short_description ?? ''} className="input !min-h-[80px]" /></Field>
              <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={p.noindex} onChange={(e) => up({ noindex: e.target.checked })} /> Hide from search engines (noindex)</label>
              <div className="border border-line bg-bg p-4"><p className="text-[12px] text-muted">Search preview</p><p className="mt-1 text-[18px] text-[#1a0dab]">{p.seo_title || p.name} · Hairver Green</p><p className="text-[13px] text-[#006621]">hairvergreen.com/products/{slugify(p.slug || p.name)}</p><p className="text-[13px] text-muted">{p.seo_description || p.short_description}</p></div>
            </section>
          )}

          {tab === 'Related' && (
            <section className="grid gap-6 border border-line bg-surface p-5 md:grid-cols-2">
              {([['related', 'You may also like'], ['bought_together', 'Frequently bought together'], ['upsell', 'Upsells (premium alternatives)'], ['cross_sell', 'Cross-sells (add-ons in bag)']] as const).map(([kind, title]) => (
                <div key={kind}><p className="label mb-2">{title}</p>
                  <ul className="mb-2 space-y-1 text-[13px]">{relations.filter((r) => r.kind === kind).map((r) => <li key={r.related_id} className="flex justify-between gap-2 bg-bg px-2 py-1">{allProducts.find((x) => x.id === r.related_id)?.name ?? '—'}<button type="button" className="text-sale" onClick={() => { setRelations((x) => x.filter((y) => !(y.related_id === r.related_id && y.kind === kind))); setDirty(true); }} aria-label="Remove"><Trash2 size={12} /></button></li>)}</ul>
                  <select className={inp} value="" onChange={(e) => { if (!e.target.value) return; setRelations((x) => [...x, { related_id: e.target.value, kind }]); setDirty(true); }}>
                    <option value="">+ Add product…</option>{allProducts.filter((x) => !relations.some((r) => r.kind === kind && r.related_id === x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </div>
              ))}
            </section>
          )}

          {tab === 'Publish' && (
            <section className="grid gap-5 border border-line bg-surface p-5 md:grid-cols-2">
              <Field label="Status"><select value={p.status} onChange={(e) => up({ status: e.target.value })} className="input" disabled={!perms.publish && p.status !== 'active'}>
                <option value="draft">Draft — not visible</option><option value="active" disabled={!perms.publish}>Active — live on the store</option><option value="hidden">Hidden — live but unlisted</option><option value="archived">Archived</option></select></Field>
              <Field label="Schedule (publish at)" hint="Leave empty to publish immediately when Active."><input type="datetime-local" value={p.publish_at ? p.publish_at.slice(0, 16) : ''} onChange={(e) => up({ publish_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="input" /></Field>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                {perms.edit && <button type="button" disabled={saving} onClick={() => save()} className="btn btn-primary btn-sm">Save</button>}
                {perms.del && <ActionButton variant="danger" confirm="Delete this product? Products with orders are archived instead." action={deleteProduct.bind(null, product.id)}>Delete product</ActionButton>}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function FaqEditor({ value, onChange }: { value: { q: string; a: string }[]; onChange: (v: { q: string; a: string }[]) => void }) {
  return (
    <div className="space-y-2">
      {value.map((f, i) => (
        <div key={i} className="grid gap-2 border border-line p-2 md:grid-cols-[1fr_1.5fr_auto]">
          <input value={f.q} onChange={(e) => onChange(value.map((x, n) => n === i ? { ...x, q: e.target.value } : x))} placeholder="Question" className="input !min-h-[36px] !text-[13px]" />
          <input value={f.a} onChange={(e) => onChange(value.map((x, n) => n === i ? { ...x, a: e.target.value } : x))} placeholder="Answer" className="input !min-h-[36px] !text-[13px]" />
          <button type="button" onClick={() => onChange(value.filter((_, n) => n !== i))} className="grid h-9 w-9 place-items-center border border-line text-sale" aria-label="Remove"><Trash2 size={13} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { q: '', a: '' }])} className="btn btn-outline btn-sm"><Plus size={13} /> Add question</button>
    </div>
  );
}

function VariantTable({ variants, setV, remove, label, media, perms }: { variants: V[]; setV: (i: number, p: Partial<V>) => void; remove: (i: number) => void; label: (k: string, v: string) => string; media: M[]; perms: { cost: boolean; stock: boolean } }) {
  const inp = 'input !min-h-[34px] !py-0.5 !text-[13px]';
  return (
    <section className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[900px] text-[13px]">
        <thead className="border-b border-line bg-bg/60 text-left text-[11px] uppercase tracking-[0.12em] text-muted"><tr><th className="px-3 py-2">Variant</th><th>SKU</th><th>Price ₦</th><th>Compare-at ₦</th>{perms.cost && <th>Cost ₦</th>}{perms.stock && <th>Stock</th>}<th>Image</th><th>Active</th><th></th></tr></thead>
        <tbody className="divide-y divide-line">{variants.map((v, i) => (
          <tr key={i}>
            <td className="px-3 py-1.5">{Object.entries(v.options).map(([k, x]) => label(k, x)).join(' / ') || 'Default'}</td>
            <td><input value={v.sku ?? ''} onChange={(e) => setV(i, { sku: e.target.value.toUpperCase() })} className={cn(inp, 'w-40')} /></td>
            <td><input inputMode="decimal" value={N(v.price)} onChange={(e) => setV(i, { price: K(e.target.value) ?? 0 })} className={cn(inp, 'w-28')} /></td>
            <td><input inputMode="decimal" value={N(v.compare_at_price)} onChange={(e) => setV(i, { compare_at_price: K(e.target.value) })} className={cn(inp, 'w-28')} /></td>
            {perms.cost && <td><input inputMode="decimal" value={N(v.cost_price)} onChange={(e) => setV(i, { cost_price: K(e.target.value) })} className={cn(inp, 'w-28')} /></td>}
            {perms.stock && <td><input type="number" value={v.stock_on_hand} onChange={(e) => setV(i, { stock_on_hand: Number(e.target.value) })} className={cn(inp, 'w-20')} /></td>}
            <td><select value={v.image_id ?? ''} onChange={(e) => setV(i, { image_id: e.target.value || null })} className={cn(inp, 'w-28')}><option value="">Auto</option>{media.map((m, n) => <option key={m.media_id} value={m.media_id}>Image {n + 1}</option>)}</select></td>
            <td className="text-center"><input type="checkbox" checked={v.is_active} onChange={(e) => setV(i, { is_active: e.target.checked })} /></td>
            <td>{variants.length > 1 && <button type="button" onClick={() => remove(i)} className="grid h-8 w-8 place-items-center text-sale" aria-label="Remove variant"><Trash2 size={13} /></button>}</td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}

function BundleEditor({ bundle, setBundle, products, fixedPrice, setFixedPrice }: {
  bundle: { pricing_mode: string; value: number; headline: string | null; items: BundleItem[] }; setBundle: (b: any) => void;
  products: { id: string; name: string; variants: { id: string; title: string; price: number }[] }[]; fixedPrice: number; setFixedPrice: (p: number) => void;
}) {
  const setItem = (i: number, patch: Partial<BundleItem>) => setBundle({ ...bundle, items: bundle.items.map((x, n) => n === i ? { ...x, ...patch } : x) });
  const regular = bundle.items.filter((i) => !i.is_optional).reduce((s, it) => {
    const prod = products.find((p) => p.id === it.product_id); const vs = prod?.variants ?? [];
    const v = it.variant_id ? vs.find((x) => x.id === it.variant_id) : vs.sort((a, b) => a.price - b.price)[0];
    return s + (v?.price ?? 0) * it.quantity;
  }, 0);
  const price = bundle.pricing_mode === 'fixed' ? fixedPrice : bundle.pricing_mode === 'percent_off' ? Math.round(regular * (1 - bundle.value / 100)) : regular - bundle.value * 100;
  return (
    <section className="space-y-5 border border-line bg-surface p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Pricing"><select value={bundle.pricing_mode} onChange={(e) => setBundle({ ...bundle, pricing_mode: e.target.value })} className="input">
          <option value="percent_off">% off the chosen items</option><option value="amount_off">₦ off the chosen items</option><option value="fixed">Fixed set price</option></select></Field>
        {bundle.pricing_mode === 'fixed' ? <Field label="Set price ₦"><input inputMode="decimal" value={N(fixedPrice)} onChange={(e) => setFixedPrice(K(e.target.value) ?? 0)} className="input" /></Field>
          : <Field label={bundle.pricing_mode === 'percent_off' ? 'Discount %' : 'Discount ₦'}><input type="number" value={bundle.value} onChange={(e) => setBundle({ ...bundle, value: Number(e.target.value) })} className="input" /></Field>}
        <Field label="Headline"><input value={bundle.headline ?? ''} onChange={(e) => setBundle({ ...bundle, headline: e.target.value })} className="input" placeholder="Save 12% on the complete set" /></Field>
      </div>
      <div className="space-y-2">
        <p className="label">Items in the set</p>
        {bundle.items.map((it, i) => {
          const prod = products.find((p) => p.id === it.product_id);
          return (
            <div key={i} className="grid gap-2 border border-line p-3 md:grid-cols-[1.2fr_1.4fr_80px_1fr_auto_auto] md:items-center">
              <select value={it.product_id} onChange={(e) => setItem(i, { product_id: e.target.value, variant_id: null })} className="input !min-h-[36px] !text-[13px]">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <select value={it.variant_id ?? ''} onChange={(e) => setItem(i, { variant_id: e.target.value || null })} className="input !min-h-[36px] !text-[13px]"><option value="">Customer chooses</option>{prod?.variants.map((v) => <option key={v.id} value={v.id}>{v.title} — ₦{(v.price / 100).toLocaleString()}</option>)}</select>
              <input type="number" min={1} value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} className="input !min-h-[36px] !text-[13px]" aria-label="Quantity" />
              <input value={it.label ?? ''} onChange={(e) => setItem(i, { label: e.target.value })} placeholder="Label (e.g. Bundle 1)" className="input !min-h-[36px] !text-[13px]" />
              <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" checked={it.is_optional} onChange={(e) => setItem(i, { is_optional: e.target.checked })} /> Optional</label>
              <button type="button" onClick={() => setBundle({ ...bundle, items: bundle.items.filter((_, n) => n !== i) })} className="grid h-9 w-9 place-items-center text-sale" aria-label="Remove"><Trash2 size={13} /></button>
            </div>
          );
        })}
        <button type="button" onClick={() => setBundle({ ...bundle, items: [...bundle.items, { product_id: products[0]?.id, variant_id: null, quantity: 1, is_optional: false, label: '' }] })} className="btn btn-outline btn-sm"><Plus size={13} /> Add item</button>
      </div>
      <div className="flex flex-wrap gap-6 bg-panel px-4 py-3 text-[14px]"><span>From regular total: <strong>₦{(regular / 100).toLocaleString('en-NG')}</strong></span><span>Set price from: <strong>₦{(price / 100).toLocaleString('en-NG')}</strong></span>{regular > price && <span className="text-sale">Customer saves ₦{((regular - price) / 100).toLocaleString('en-NG')}</span>}</div>
      <p className="text-[12px] text-muted">Stock comes from the component products: selling a set reserves and deducts each item.</p>
    </section>
  );
}
