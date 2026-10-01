'use server';
import { revalidateTag } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, str, bool, int, json, refreshStore, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';
import { DEFAULT_THEME } from '@/lib/data/content';
import { DEFAULT_CUSTOM_UNIT, type CustomUnitConfig } from '@/lib/commerce/custom-unit';

const PUBLIC = new Set(['store', 'theme', 'checkout', 'currencies', 'seo', 'analytics', 'shipping', 'social_proof', 'custom_unit']);
const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = (v: string, re: RegExp) => (re.test(v) ? v : '');
const httpsOrPath = (v: string) => (!v ? null : v.startsWith('/') && !v.startsWith('//') ? v : /^https:\/\//i.test(v) ? v.slice(0, 500) : null);
const emails = (v: string[]) => v.map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)).slice(0, 10);

function build(key: string, fd: FormData, prev: Record<string, any>): Record<string, unknown> {
  switch (key) {
    case 'store': return {
      ...prev, name: str(fd, 'name') || 'Hairver Green', short_name: str(fd, 'short_name'), tagline: str(fd, 'tagline'), email: str(fd, 'email'),
      phone: str(fd, 'phone'), whatsapp: str(fd, 'whatsapp').replace(/[^\d+]/g, ''), address: str(fd, 'address'), city: str(fd, 'city'), country: str(fd, 'country') || 'NG',
      instagram: httpsOrPath(str(fd, 'instagram')) ?? '', tiktok: httpsOrPath(str(fd, 'tiktok')) ?? '', support_hours: str(fd, 'support_hours'),
    };
    case 'checkout': return { ...prev, guest_checkout: bool(fd, 'guest_checkout'), require_phone: bool(fd, 'require_phone'), order_note: bool(fd, 'order_note'),
      hold_minutes: Math.min(1440, Math.max(15, int(fd, 'hold_minutes', 60))), terms_page: str(fd, 'terms_page').startsWith('/') ? str(fd, 'terms_page') : '/policies/terms' };
    case 'currencies': {
      const rows = json<{ code: string; symbol: string; rate: number }[]>(fd, 'display', []);
      const display = [{ code: 'NGN', symbol: '₦', rate: 1 }, ...rows.filter((r) => /^[A-Z]{3}$/.test(r.code) && r.code !== 'NGN' && Number(r.rate) > 0).map((r) => ({ code: r.code, symbol: String(r.symbol ?? '').slice(0, 4), rate: Number(r.rate) }))];
      return { ...prev, base: 'NGN', display };
    }
    case 'seo': return { ...prev, title_template: str(fd, 'title_template').includes('%s') ? str(fd, 'title_template') : '%s · Hairver Green', default_title: str(fd, 'default_title'), default_description: str(fd, 'default_description').slice(0, 320), og_image: httpsOrPath(str(fd, 'og_image')) };
    case 'analytics': return { ga4_id: ID(str(fd, 'ga4_id'), /^G-[A-Z0-9]{4,15}$/), meta_pixel_id: ID(str(fd, 'meta_pixel_id'), /^\d{6,20}$/), tiktok_pixel_id: ID(str(fd, 'tiktok_pixel_id'), /^[A-Z0-9]{6,30}$/), gsc_verification: ID(str(fd, 'gsc_verification'), /^[A-Za-z0-9_-]{10,100}$/) };
    case 'notifications': return { ...prev, order_alert_emails: emails(json<string[]>(fd, 'order_alert_emails', [])), low_stock_emails: emails(json<string[]>(fd, 'low_stock_emails', [])), from_name: str(fd, 'from_name') || 'Hairver Green' };
    case 'shipping': return { ...prev, free_shipping_banner: bool(fd, 'free_shipping_banner') };
    case 'social_proof': return { reviews_enabled: bool(fd, 'reviews_enabled'), verified_only: bool(fd, 'verified_only') };
    case 'theme': {
      const colors: Record<string, string> = {};
      for (const k of Object.keys(DEFAULT_THEME.colors)) { const v = str(fd, `c_${k}`); colors[k] = HEX.test(v) ? v : (prev.colors?.[k] ?? DEFAULT_THEME.colors[k]); }
      const font = (v: string, d: string) => (v.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 60) || d);
      const pick = <T extends string>(v: string, opts: T[], d: T) => (opts.includes(v as T) ? (v as T) : d);
      return {
        colors, fonts: { display: font(str(fd, 'font_display'), 'Cormorant Garamond'), body: font(str(fd, 'font_body'), 'Jost') },
        radius: pick(str(fd, 'radius'), ['none', 'sm', 'md', 'lg'], 'none'), button_style: pick(str(fd, 'button_style'), ['solid', 'outline'], 'solid'),
        product_card: pick(str(fd, 'product_card'), ['editorial', 'minimal'], 'editorial'), animations: pick(str(fd, 'animations'), ['subtle', 'none', 'expressive'], 'subtle'),
        logo_media_url: httpsOrPath(str(fd, 'logo_media_url')), favicon_url: httpsOrPath(str(fd, 'favicon_url')),
      };
    }
    case 'custom_unit': {
      const c = json<CustomUnitConfig>(fd, 'config', DEFAULT_CUSTOM_UNIT);
      const groups = (Array.isArray(c.groups) ? c.groups : []).slice(0, 20).map((g) => ({
        key: String(g.key ?? '').replace(/[^a-z0-9_]/g, '').slice(0, 30), label: String(g.label ?? '').slice(0, 60), required: !!g.required, multiple: !!g.multiple,
        options: (Array.isArray(g.options) ? g.options : []).slice(0, 40).map((o) => ({ value: String(o.value ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40), label: String(o.label ?? '').slice(0, 80), price: Math.max(0, Math.round(Number(o.price) || 0)), ...(o.review ? { review: true } : {}) })).filter((o) => o.value && o.label),
      })).filter((g) => g.key && g.label && g.options.length);
      if (!groups.length) throw new Error('Add at least one option group');
      return { base_length: Math.max(8, Math.min(40, Math.round(Number(c.base_length) || 14))), per_inch: Math.max(0, Math.round(Number(c.per_inch) || 0)), groups };
    }
    default: throw new Error('Unknown setting');
  }
}

export async function saveSetting(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const key = str(fd, 'key');
  return guarded(key === 'theme' ? 'theme.edit' : 'settings.edit', async (staff) => {
    const db = supabaseAdmin();
    const { data: row } = await db.from('settings').select('value').eq('key', key).maybeSingle();
    const prev = (row?.value ?? {}) as Record<string, any>;
    const value = build(key, fd, prev);
    const { error } = await db.from('settings').upsert({ key, value, is_public: PUBLIC.has(key), updated_at: new Date().toISOString(), updated_by: staff.id });
    if (error) throw error;
    await audit(staff, { action: 'update', entityType: 'settings', entityId: key, summary: `Updated ${key} settings`, before: prev, after: value });
    refreshStore('all');
    try { revalidateTag('settings', 'max'); } catch { /* ignore */ }
    return { ok: true, message: 'Settings saved' };
  });
}

export async function resetTheme(): Promise<ActionResult> {
  return guarded('theme.edit', async (staff) => {
    await supabaseAdmin().from('settings').upsert({ key: 'theme', value: DEFAULT_THEME, is_public: true, updated_at: new Date().toISOString(), updated_by: staff.id });
    await audit(staff, { action: 'reset', entityType: 'settings', entityId: 'theme', summary: 'Reset theme to brand defaults' });
    refreshStore('all');
    return { ok: true, message: 'Theme reset to the Hairver Green brand defaults' };
  });
}
