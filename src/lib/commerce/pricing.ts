import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type CartInputLine = {
  id: string; product_id: string; variant_id: string; quantity: number;
  bundle_selection?: Record<string, string> | null;   // bundle_item_id -> variant_id (or "none" to skip optional)
  customization?: Record<string, unknown> | null;
  saved_for_later?: boolean;
};

export type PricedLine = {
  id: string; product_id: string; variant_id: string; quantity: number; saved_for_later: boolean;
  name: string; slug: string; product_type: string; variant_title: string; sku: string | null; image: string | null;
  options: Record<string, string>; unit_price: number; compare_at_price: number | null; unit_cost: number;
  line_subtotal: number; line_discount: number; line_total: number; weight_grams: number;
  category_ids: string[]; collection_ids: string[];
  bundle_components: { product_id: string; variant_id: string; name: string; variant_title: string; quantity: number }[] | null;
  customization: Record<string, unknown> | null;
  stock_allocations: { variant_id: string; quantity: number }[];
  available: number | null; error: string | null; requires_review: boolean;
};

export type ShippingOption = {
  id: string; name: string; carrier: string | null; service_level: string; price: number; original_price: number;
  min_days: number | null; max_days: number | null; zone: string; free_over: number | null;
};

export type AppliedDiscount = { id: string; code: string | null; label: string; amount: number; free_shipping?: boolean };

export type Quote = {
  lines: PricedLine[]; saved: PricedLine[];
  item_count: number; subtotal: number; discount_total: number; shipping_total: number; tax_total: number; total: number; cost_total: number;
  discounts: AppliedDiscount[]; code_errors: { code: string; message: string }[];
  shipping_options: ShippingOption[]; selected_shipping: ShippingOption | null;
  free_shipping: { threshold: number; remaining: number } | null;
  requires_review: boolean; has_errors: boolean; weight_grams: number;
};

export type QuoteContext = {
  country?: string | null; state?: string | null; email?: string | null; userId?: string | null;
  codes?: string[]; shippingMethodId?: string | null;
};

import { DEFAULT_CUSTOM_UNIT, priceCustomUnit, type CustomUnitConfig } from './custom-unit';
export { DEFAULT_CUSTOM_UNIT, priceCustomUnit, type CustomUnitConfig };

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------
const availOf = (v: any) => (!v.track_inventory || v.allow_backorder ? null : Math.max(0, v.stock_on_hand - v.stock_reserved));

export async function buildQuote(input: CartInputLine[], ctx: QuoteContext = {}): Promise<Quote> {
  const db = supabaseAdmin();
  const active = input.filter((l) => !l.saved_for_later);
  const productIds = [...new Set(input.map((l) => l.product_id))];

  // Load products (with bundles), their variants, category/collection membership
  const { data: prods } = productIds.length
    ? await db.from('products').select(`id, name, slug, product_type, status, publish_at, weight_grams, category_id, requires_review,
        categories:category_id (id, parent_id),
        collection_products (collection_id),
        product_media (sort, option_match, media:media_id (url)),
        bundles (pricing_mode, value, bundle_items!bundle_items_bundle_product_id_fkey (id, product_id, variant_id, quantity, is_optional, label, sort))`)
      .in('id', productIds)
    : { data: [] as any[] };
  const pmap = new Map((prods ?? []).map((p: any) => [p.id, p]));

  // Collect every variant we need (line variants + bundle components)
  const variantIds = new Set(input.map((l) => l.variant_id));
  for (const l of input) {
    const p: any = pmap.get(l.product_id);
    for (const it of p?.bundles?.bundle_items ?? []) {
      const vid = it.variant_id ?? l.bundle_selection?.[it.id];
      if (vid && vid !== 'none') variantIds.add(vid);
    }
  }
  const { data: vars } = variantIds.size
    ? await db.from('product_variants').select('*, product:product_id (id, name, slug, status, weight_grams, product_media (sort, option_match, media:media_id (url)))').in('id', [...variantIds])
    : { data: [] as any[] };
  const vmap = new Map((vars ?? []).map((v: any) => [v.id, v]));

  const { data: custSetting } = await db.from('settings').select('value').eq('key', 'custom_unit').maybeSingle();
  const customCfg: CustomUnitConfig = (custSetting?.value as CustomUnitConfig) || DEFAULT_CUSTOM_UNIT;

  const pickImage = (p: any, opts: Record<string, string>) => {
    const media = [...(p?.product_media ?? [])].sort((a: any, b: any) => a.sort - b.sort);
    const match = media.find((m: any) => Object.entries(m.option_match || {}).length && Object.entries(m.option_match).every(([k, v]) => opts[k] === v));
    return (match ?? media[0])?.media?.url ?? null;
  };

  const now = new Date().toISOString();
  const lines: PricedLine[] = input.map((l) => {
    const p: any = pmap.get(l.product_id);
    const v: any = vmap.get(l.variant_id);
    const base: PricedLine = {
      id: l.id, product_id: l.product_id, variant_id: l.variant_id, quantity: l.quantity, saved_for_later: !!l.saved_for_later,
      name: p?.name ?? 'Unavailable item', slug: p?.slug ?? '', product_type: p?.product_type ?? 'hair', variant_title: v?.title ?? '',
      sku: v?.sku ?? null, image: p ? pickImage(p, v?.options ?? {}) : null, options: v?.options ?? {}, unit_price: v?.price ?? 0,
      compare_at_price: v?.compare_at_price ?? null, unit_cost: v?.cost_price ?? 0, line_subtotal: 0, line_discount: 0, line_total: 0,
      weight_grams: (v?.weight_grams ?? p?.weight_grams ?? 0) * l.quantity,
      category_ids: [p?.category_id, p?.categories?.parent_id].filter(Boolean),
      collection_ids: (p?.collection_products ?? []).map((c: any) => c.collection_id),
      bundle_components: null, customization: l.customization ?? null, stock_allocations: [], available: null, error: null,
      requires_review: !!p?.requires_review,
    };
    if (!p || !v || p.status !== 'active' || (p.publish_at && p.publish_at > now) || !v.is_active || v.product_id !== p.id) {
      base.error = 'This item is no longer available';
      return base;
    }

    if (p.product_type === 'bundle_deal' && p.bundles) {
      const comps: PricedLine['bundle_components'] = [];
      let sum = 0; let cost = 0; let weight = 0;
      for (const it of [...p.bundles.bundle_items].sort((a: any, b: any) => a.sort - b.sort)) {
        const sel = it.variant_id ?? l.bundle_selection?.[it.id];
        if (!sel || sel === 'none') {
          if (!it.is_optional) base.error = `Choose an option for ${it.label || 'each item'}`;
          continue;
        }
        const cv: any = vmap.get(sel);
        if (!cv || cv.product_id !== it.product_id || !cv.is_active || cv.product?.status !== 'active') { base.error = 'A bundle item is unavailable'; continue; }
        sum += cv.price * it.quantity; cost += (cv.cost_price ?? 0) * it.quantity;
        weight += (cv.weight_grams ?? cv.product?.weight_grams ?? 0) * it.quantity;
        comps.push({ product_id: it.product_id, variant_id: cv.id, name: cv.product?.name ?? '', variant_title: cv.title, quantity: it.quantity });
        base.stock_allocations.push({ variant_id: cv.id, quantity: it.quantity * l.quantity });
      }
      const mode = p.bundles.pricing_mode;
      base.unit_price = mode === 'fixed' ? v.price
        : mode === 'percent_off' ? Math.round(sum * (1 - Number(p.bundles.value) / 100)) : Math.max(0, sum - Number(p.bundles.value) * 100);
      base.compare_at_price = sum > base.unit_price ? sum : null;
      base.unit_cost = cost; base.bundle_components = comps; base.weight_grams = weight * l.quantity;
      base.variant_title = comps.map((c) => `${c.quantity > 1 ? c.quantity + '× ' : ''}${c.name}${c.variant_title && c.variant_title !== 'Default' ? ' (' + c.variant_title + ')' : ''}`).join(' · ');
    } else if (p.product_type === 'custom_unit') {
      const priced = priceCustomUnit(v.price, customCfg, (l.customization as Record<string, unknown>) ?? {});
      if (priced.errors.length) base.error = priced.errors[0];
      base.unit_price = priced.price; base.compare_at_price = null; base.requires_review = true;
      base.variant_title = priced.summary.join(' · ');
      base.unit_cost = Math.round(priced.price * 0.55);
      if (v.track_inventory) base.stock_allocations.push({ variant_id: v.id, quantity: l.quantity });
    } else {
      base.stock_allocations.push({ variant_id: v.id, quantity: l.quantity });
    }

    // Availability across allocations (sum per variant)
    let minAvail: number | null = null;
    for (const a of base.stock_allocations) {
      const av: any = vmap.get(a.variant_id);
      const avail = av ? availOf(av) : 0;
      if (avail === null) continue;
      const perUnit = a.quantity / l.quantity;
      const units = Math.floor(avail / perUnit);
      minAvail = minAvail === null ? units : Math.min(minAvail, units);
    }
    base.available = minAvail;
    if (minAvail !== null && !base.error) {
      if (minAvail <= 0) base.error = 'Sold out';
      else if (minAvail < l.quantity) base.error = `Only ${minAvail} available`;
    }
    base.line_subtotal = base.unit_price * l.quantity;
    base.line_total = base.line_subtotal;
    return base;
  });

  const activeLines = lines.filter((l) => !l.saved_for_later);
  const saved = lines.filter((l) => l.saved_for_later);
  const priceable = activeLines.filter((l) => !l.error || !/unavailable|Sold out/i.test(l.error));
  const subtotal = priceable.reduce((s, l) => s + l.line_subtotal, 0);
  const weight = priceable.reduce((s, l) => s + l.weight_grams, 0);

  // Discounts
  const { discounts, codeErrors, freeShipping } = await applyDiscounts(priceable, subtotal, ctx);
  discounts.push(...(await collectionDeals(priceable)));
  const discountTotal = priceable.reduce((s, l) => s + l.line_discount, 0) + discounts.filter((d) => d.id.startsWith('order:')).reduce((s, d) => s + d.amount, 0);
  const orderLevel = discounts.filter((d) => d.id.startsWith('order:')).reduce((s, d) => s + d.amount, 0);
  // Spread order-level discount across lines proportionally (for accurate line_total / refunds)
  if (orderLevel > 0 && subtotal > 0) {
    let left = orderLevel;
    priceable.forEach((l, i) => {
      const share = i === priceable.length - 1 ? left : Math.min(left, Math.round((l.line_subtotal / subtotal) * orderLevel));
      l.line_discount += share; left -= share;
    });
  }
  priceable.forEach((l) => { l.line_discount = Math.min(l.line_discount, l.line_subtotal); l.line_total = l.line_subtotal - l.line_discount; });
  const discountCapped = priceable.reduce((s, l) => s + l.line_discount, 0);
  const afterDiscount = subtotal - discountCapped;

  // Shipping
  const { options, freeInfo } = await shippingOptions(ctx.country || 'NG', ctx.state || null, afterDiscount, weight, freeShipping);
  const selected = options.find((o) => o.id === ctx.shippingMethodId) ?? options[0] ?? null;
  const shippingTotal = activeLines.length ? selected?.price ?? 0 : 0;

  // Tax
  const taxTotal = await computeTax(ctx.country || 'NG', ctx.state || null, afterDiscount, shippingTotal);

  const total = Math.max(0, afterDiscount + shippingTotal + taxTotal);
  void discountTotal;
  return {
    lines: activeLines, saved,
    item_count: activeLines.reduce((s, l) => s + l.quantity, 0),
    subtotal, discount_total: discountCapped, shipping_total: shippingTotal, tax_total: taxTotal, total,
    cost_total: priceable.reduce((s, l) => s + l.unit_cost * l.quantity, 0),
    discounts: discounts.map((d) => ({ ...d, id: d.id.replace(/^(order|line|ship):/, '') })),
    code_errors: codeErrors, shipping_options: options, selected_shipping: activeLines.length ? selected : null,
    free_shipping: freeInfo, requires_review: activeLines.some((l) => l.requires_review),
    has_errors: activeLines.some((l) => l.error), weight_grams: weight,
  };
}

// ---------------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------------
type DiscountRow = {
  id: string; name: string; code: string | null; kind: string; value: number; applies_to: string; target_ids: string[];
  min_subtotal: number | null; max_discount: number | null; min_quantity: number | null; buy_quantity: number | null;
  get_quantity: number | null; get_percent: number | null; tiers: { min_qty: number; percent: number }[] | null;
  eligibility: string; customer_emails: string[]; usage_limit: number | null; per_customer_limit: number | null; used_count: number;
  starts_at: string | null; ends_at: string | null; countries: string[]; currencies: string[]; combinable: boolean; is_active: boolean;
};

async function applyDiscounts(lines: PricedLine[], subtotal: number, ctx: QuoteContext) {
  const db = supabaseAdmin();
  const codes = [...new Set((ctx.codes ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean))].slice(0, 3);
  const now = new Date().toISOString();
  const { data: autos } = await db.from('discounts').select('*').is('code', null).eq('is_active', true);
  const { data: coded } = codes.length ? await db.from('discounts').select('*').in('code', codes) : { data: [] as DiscountRow[] };
  const codeErrors: { code: string; message: string }[] = [];
  const applied: AppliedDiscount[] = [];
  let freeShipping = false;

  // Customer history (for eligibility / per-customer limits)
  let paidOrders: { id: string; discount_ids: string[] }[] | null = null;
  const history = async () => {
    if (paidOrders) return paidOrders;
    if (!ctx.email && !ctx.userId) return (paidOrders = []);
    const statuses = ['paid', 'partially_refunded', 'refunded'];
    const [byEmail, byUser] = await Promise.all([
      ctx.email ? db.from('orders').select('id, discount_ids').in('payment_status', statuses).eq('email', ctx.email).limit(200) : Promise.resolve({ data: [] }),
      ctx.userId ? db.from('orders').select('id, discount_ids').in('payment_status', statuses).eq('user_id', ctx.userId).limit(200) : Promise.resolve({ data: [] }),
    ]);
    const merged = new Map<string, { id: string; discount_ids: string[] }>();
    for (const o of [...(byEmail.data ?? []), ...(byUser.data ?? [])] as any[]) merged.set(o.id, o);
    return (paidOrders = [...merged.values()]);
  };

  const inWindow = (d: DiscountRow) => (!d.starts_at || d.starts_at <= now) && (!d.ends_at || d.ends_at >= now);
  const matches = (d: DiscountRow, l: PricedLine) => {
    if (d.applies_to === 'order') return true;
    if (d.applies_to === 'products') return d.target_ids.includes(l.product_id);
    if (d.applies_to === 'categories') return l.category_ids.some((c) => d.target_ids.includes(c));
    if (d.applies_to === 'collections') return l.collection_ids.some((c) => d.target_ids.includes(c));
    return false;
  };

  async function eligible(d: DiscountRow): Promise<string | null> {
    if (!d.is_active || !inWindow(d)) return 'This code has expired or is not active yet';
    if (d.usage_limit != null && d.used_count >= d.usage_limit) return 'This code has reached its usage limit';
    if (d.min_subtotal && subtotal < d.min_subtotal) return `Spend ${(d.min_subtotal / 100).toLocaleString('en-NG')} or more to use this code`;
    if (d.countries?.length && ctx.country && !d.countries.includes(ctx.country)) return 'This code is not available for your delivery country';
    if (d.eligibility === 'specific') {
      if (!ctx.email || !d.customer_emails.map((e) => e.toLowerCase()).includes(ctx.email.toLowerCase())) return 'This code is not valid for your account';
    }
    if (d.eligibility === 'new' || d.eligibility === 'existing' || d.per_customer_limit) {
      if (!ctx.email && !ctx.userId) return d.code ? null : 'skip'; // re-validated once an email is entered at checkout
      const h = await history();
      if (d.eligibility === 'new' && h.length > 0) return 'This code is for first orders only';
      if (d.eligibility === 'existing' && h.length === 0) return 'This code is for returning customers';
      if (d.per_customer_limit && h.filter((o) => o.discount_ids?.includes(d.id)).length >= d.per_customer_limit) return 'You have already used this code';
    }
    return null;
  }

  function evaluate(d: DiscountRow) {
    const target = lines.filter((l) => matches(d, l) && (d.applies_to !== 'order' || true) && !(d.applies_to !== 'order' && l.product_type === 'bundle_deal'));
    const qty = target.reduce((s, l) => s + l.quantity, 0);
    if (d.min_quantity && qty < d.min_quantity) return null;
    const cap = (n: number) => Math.max(0, d.max_discount ? Math.min(n, d.max_discount) : n);
    switch (d.kind) {
      case 'percentage': {
        if (d.applies_to === 'order') return { order: cap(Math.round(subtotal * Number(d.value) / 100)) };
        const perLine = target.map((l) => ({ l, amt: Math.round((l.line_subtotal - l.line_discount) * Number(d.value) / 100) }));
        return { lines: perLine, total: cap(perLine.reduce((s, x) => s + x.amt, 0)) };
      }
      case 'fixed': {
        const amt = Math.round(Number(d.value) * 100);
        if (d.applies_to === 'order') return { order: cap(Math.min(amt, subtotal)) };
        const base = target.reduce((s, l) => s + l.line_subtotal - l.line_discount, 0);
        const total = cap(Math.min(amt, base));
        return { lines: target.map((l) => ({ l, amt: base ? Math.round(total * (l.line_subtotal - l.line_discount) / base) : 0 })), total };
      }
      case 'tiered': {
        const tier = [...(d.tiers ?? [])].sort((a, b) => b.min_qty - a.min_qty).find((t) => qty >= t.min_qty);
        if (!tier) return null;
        const perLine = target.map((l) => ({ l, amt: Math.round((l.line_subtotal - l.line_discount) * tier.percent / 100) }));
        return { lines: perLine, total: cap(perLine.reduce((s, x) => s + x.amt, 0)), label: `${d.name} (${tier.percent}% off ${qty} items)` };
      }
      case 'buy_x_get_y': {
        const buy = d.buy_quantity ?? 1; const get = d.get_quantity ?? 1; const pct = Number(d.get_percent ?? 100);
        const units = target.flatMap((l) => Array.from({ length: l.quantity }, () => ({ l, price: l.unit_price })));
        units.sort((a, b) => a.price - b.price);
        const groups = Math.floor(units.length / (buy + get));
        const free = units.slice(0, groups * get);
        const perLine = new Map<PricedLine, number>();
        for (const u of free) perLine.set(u.l, (perLine.get(u.l) ?? 0) + Math.round(u.price * pct / 100));
        const arr = [...perLine.entries()].map(([l, amt]) => ({ l, amt }));
        const total = cap(arr.reduce((s, x) => s + x.amt, 0));
        return total ? { lines: arr, total } : null;
      }
      case 'free_shipping':
        return { freeShipping: true };
    }
    return null;
  }

  const apply = (d: DiscountRow, r: ReturnType<typeof evaluate>, label?: string) => {
    if (!r) return false;
    if ('freeShipping' in r && r.freeShipping) { freeShipping = true; applied.push({ id: 'ship:' + d.id, code: d.code, label: d.name, amount: 0, free_shipping: true }); return true; }
    if ('order' in r && r.order) { applied.push({ id: 'order:' + d.id, code: d.code, label: label || d.name, amount: r.order }); return true; }
    if ('lines' in r && r.lines && r.total) {
      // scale if capped
      const raw = r.lines.reduce((s, x) => s + x.amt, 0);
      const k = raw ? r.total / raw : 0;
      r.lines.forEach((x) => { x.l.line_discount += Math.round(x.amt * k); });
      applied.push({ id: 'line:' + d.id, code: d.code, label: ('label' in r && r.label) || label || d.name, amount: r.total });
      return true;
    }
    return false;
  };

  for (const d of (autos ?? []) as DiscountRow[]) {
    const err = await eligible(d);
    if (err) continue;
    apply(d, evaluate(d));
  }
  let codeApplied = false;
  for (const code of codes) {
    const d = ((coded ?? []) as DiscountRow[]).find((x) => x.code?.toUpperCase() === code);
    if (!d) { codeErrors.push({ code, message: 'This code is not valid' }); continue; }
    if (codeApplied && !d.combinable) { codeErrors.push({ code, message: 'Only one code can be used per order' }); continue; }
    const err = await eligible(d);
    if (err && err !== 'skip') { codeErrors.push({ code, message: err }); continue; }
    const r = evaluate(d);
    if (!r) { codeErrors.push({ code, message: 'Your bag does not qualify for this code yet' }); continue; }
    if (apply(d, r, `${d.name} (${d.code})`)) codeApplied = true;
    else codeErrors.push({ code, message: 'Your bag does not qualify for this code yet' });
  }
  return { discounts: applied, codeErrors, freeShipping };
}

// ---------------------------------------------------------------------------
// Shipping & tax
// ---------------------------------------------------------------------------
async function shippingOptions(country: string, state: string | null, orderValue: number, weightGrams: number, freeShipping: boolean) {
  const db = supabaseAdmin();
  const { data: zones } = await db.from('shipping_zones').select('*, methods:shipping_methods (*)').eq('is_active', true).order('sort');
  const st = (state || '').toLowerCase();
  const all = (zones ?? []) as any[];
  const byState = all.filter((z) => z.countries.includes(country) && z.states.length && st && z.states.some((s: string) => s.toLowerCase() === st));
  const byCountry = all.filter((z) => z.countries.includes(country) && !z.states.length);
  const world = all.filter((z) => z.countries.includes('*'));
  const zone = byState[0] ?? byCountry[0] ?? world[0];
  if (!zone) return { options: [] as ShippingOption[], freeInfo: null };

  const kg = Math.max(1, Math.ceil(weightGrams / 1000));
  const options: ShippingOption[] = (zone.methods as any[]).filter((m) => m.is_active).sort((a, b) => a.sort - b.sort).map((m) => {
    let price = Number(m.base_rate);
    if (m.rate_type === 'weight') price += Number(m.per_kg_rate) * (kg - 1);
    if (m.rate_type === 'order_value' && Array.isArray(m.rate_table)) {
      const tier = [...m.rate_table].sort((a: any, b: any) => b.min - a.min).find((t: any) => orderValue >= t.min);
      if (tier) price = Number(tier.rate);
    }
    const original = price;
    if (m.free_over != null && orderValue >= Number(m.free_over)) price = 0;
    if (freeShipping && m.service_level !== 'express') price = 0;
    return { id: m.id, name: m.name, carrier: m.carrier, service_level: m.service_level, price, original_price: original,
      min_days: m.min_days, max_days: m.max_days, zone: zone.name, free_over: m.free_over != null ? Number(m.free_over) : null };
  });
  const withFree = options.filter((o) => o.free_over && o.service_level !== 'pickup').sort((a, b) => a.free_over! - b.free_over!)[0];
  const freeInfo = withFree ? { threshold: withFree.free_over!, remaining: Math.max(0, withFree.free_over! - orderValue) } : null;
  return { options, freeInfo };
}

async function computeTax(country: string, state: string | null, taxable: number, shipping: number) {
  const { data } = await supabaseAdmin().from('tax_rules').select('*').eq('is_active', true).eq('country', country);
  const rules = (data ?? []).filter((r: any) => !r.state || (state && r.state.toLowerCase() === state.toLowerCase()));
  return rules.reduce((s: number, r: any) => s + Math.round((taxable + (r.applies_to_shipping ? shipping : 0)) * Number(r.rate_percent) / 100), 0);
}

// Collection "complete set" pricing: when every product of a deal-enabled collection is in the bag,
// the difference between the collection's regular (lowest-variant) total and its deal price is taken off once.
async function collectionDeals(lines: PricedLine[]): Promise<AppliedDiscount[]> {
  if (!lines.length) return [];
  const db = supabaseAdmin();
  const { data: cols } = await db.from('collections').select('id, name, deal_price, collection_products (product_id)').eq('deal_enabled', true).not('deal_price', 'is', null);
  const out: AppliedDiscount[] = [];
  const inCart = new Set(lines.filter((l) => l.product_type !== 'custom_unit').map((l) => l.product_id));
  for (const c of (cols ?? []) as any[]) {
    const ids: string[] = (c.collection_products ?? []).map((x: any) => x.product_id);
    if (!ids.length || !ids.every((id) => inCart.has(id))) continue;
    const { data: vs } = await db.from('product_variants').select('product_id, price').in('product_id', ids).eq('is_active', true);
    const regular = ids.reduce((s, id) => s + Math.min(...(vs ?? []).filter((v: any) => v.product_id === id).map((v: any) => Number(v.price))), 0);
    const saving = regular - Number(c.deal_price);
    if (Number.isFinite(saving) && saving > 0) out.push({ id: 'order:collection-' + c.id, code: null, label: `${c.name} — complete set`, amount: saving });
  }
  return out;
}
