import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card } from '@/components/admin/ui';
import { ActionForm, Submit, Field, Toggle, TagsInput, ListEditor, MediaField, ActionButton } from '@/components/admin/client';
import { DEFAULT_THEME, DEFAULT_STORE } from '@/lib/data/content';
import { DEFAULT_CUSTOM_UNIT, type CustomUnitConfig } from '@/lib/commerce/custom-unit';
import { COUNTRIES, cn } from '@/lib/utils';
import { saveSetting, resetTheme } from './actions';
import { ColorField, CustomUnitEditor } from './settings-client';

const TABS: [string, string, string][] = [
  ['store', 'Store details', 'settings.edit'], ['theme', 'Theme', 'theme.edit'], ['checkout', 'Checkout', 'settings.edit'], ['currencies', 'Currencies', 'settings.edit'],
  ['custom_unit', 'Custom unit pricing', 'settings.edit'], ['seo', 'SEO', 'settings.edit'], ['analytics', 'Analytics & pixels', 'settings.edit'],
  ['notifications', 'Notifications', 'settings.edit'], ['reviews', 'Reviews', 'settings.edit'], ['integrations', 'Integrations', 'settings.edit'],
];
const COLOR_LABELS: Record<string, string> = { primary: 'Primary (emerald)', primary_contrast: 'Text on primary', accent: 'Accent (champagne gold)', accent_strong: 'Accent strong (antique gold)', background: 'Page background', surface: 'Cards & panels', panel: 'Soft panel (parchment)', text: 'Text', muted: 'Muted text', border: 'Borders', sale: 'Sale & errors' };
const FONTS = ['Cormorant Garamond', 'Playfair Display', 'Bodoni Moda', 'Libre Caslon Display', 'EB Garamond', 'Jost', 'Inter', 'Montserrat', 'Manrope', 'DM Sans'];

export default async function Settings({ searchParams }: PageProps<'/admin/settings'>) {
  const staff = await requireStaffPage(['settings.edit', 'theme.edit']);
  const sp = await searchParams;
  const tabs = TABS.filter(([, , p]) => staff.permissions.has(p));
  const tab = tabs.find(([k]) => k === sp.tab)?.[0] ?? tabs[0][0];
  const { data } = await supabaseAdmin().from('settings').select('key, value');
  const S = Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, any>;

  return (
    <>
      <PageHeader title="Settings & theme" description="Store-wide configuration. Changes apply to the storefront within a minute." />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col">
          {tabs.map(([k, label]) => <Link key={k} href={`/admin/settings?tab=${k}`} aria-current={tab === k ? 'page' : undefined} className={cn('whitespace-nowrap px-3 py-2 text-[13px]', tab === k ? 'bg-surface font-medium ring-1 ring-line' : 'text-muted hover:text-ink')}>{label}</Link>)}
        </nav>
        <div className="min-w-0">
          {tab === 'store' && (() => { const s = { ...DEFAULT_STORE, ...(S.store ?? {}) }; return (
            <Card title="Store details"><ActionForm action={saveSetting} className="grid gap-4 md:grid-cols-2"><Hidden k="store" />
              <Field label="Store name"><input name="name" defaultValue={s.name} className="input" /></Field>
              <Field label="Short name"><input name="short_name" defaultValue={s.short_name} className="input" /></Field>
              <Field label="Tagline" className="md:col-span-2"><input name="tagline" defaultValue={s.tagline} className="input" /></Field>
              <Field label="Customer service email"><input name="email" type="email" defaultValue={s.email} className="input" /></Field>
              <Field label="Phone"><input name="phone" defaultValue={s.phone} className="input" /></Field>
              <Field label="WhatsApp number" hint="International format, e.g. 2348012345678"><input name="whatsapp" defaultValue={s.whatsapp} className="input" /></Field>
              <Field label="Support hours"><input name="support_hours" defaultValue={s.support_hours} className="input" /></Field>
              <Field label="Address" className="md:col-span-2"><input name="address" defaultValue={s.address} className="input" /></Field>
              <Field label="City"><input name="city" defaultValue={s.city} className="input" /></Field>
              <Field label="Country"><select name="country" defaultValue={s.country} className="input">{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></Field>
              <Field label="Instagram URL"><input name="instagram" defaultValue={s.instagram} className="input" /></Field>
              <Field label="TikTok URL"><input name="tiktok" defaultValue={s.tiktok} className="input" /></Field>
              <div className="md:col-span-2"><Submit>Save store details</Submit></div>
            </ActionForm></Card>); })()}

          {tab === 'theme' && (() => { const t = { ...DEFAULT_THEME, ...(S.theme ?? {}), colors: { ...DEFAULT_THEME.colors, ...(S.theme?.colors ?? {}) }, fonts: { ...DEFAULT_THEME.fonts, ...(S.theme?.fonts ?? {}) } }; return (
            <ActionForm action={saveSetting} className="grid gap-6"><Hidden k="theme" />
              <Card title="Colours" actions={<ActionButton variant="link" confirm="Reset all theme settings to the Hairver Green brand guide?" action={resetTheme}>Reset to brand defaults</ActionButton>}>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Object.keys(DEFAULT_THEME.colors).map((k) => <ColorField key={k} name={`c_${k}`} label={COLOR_LABELS[k] ?? k} defaultValue={t.colors[k]} />)}</div>
                <p className="mt-4 text-[12px] text-muted">Brand guide: keep gold for accents and fine detail — never large fills. Check text contrast when changing backgrounds.</p>
              </Card>
              <Card title="Typography & style"><div className="grid gap-4 md:grid-cols-2">
                <Field label="Display font"><select name="font_display" defaultValue={t.fonts.display} className="input">{FONTS.map((f) => <option key={f}>{f}</option>)}</select></Field>
                <Field label="Body font"><select name="font_body" defaultValue={t.fonts.body} className="input">{FONTS.map((f) => <option key={f}>{f}</option>)}</select></Field>
                <Field label="Corner radius"><select name="radius" defaultValue={t.radius} className="input"><option value="none">Square (brand)</option><option value="sm">Subtle</option><option value="md">Soft</option><option value="lg">Round</option></select></Field>
                <Field label="Buttons"><select name="button_style" defaultValue={t.button_style} className="input"><option value="solid">Solid</option><option value="outline">Outline</option></select></Field>
                <Field label="Animations"><select name="animations" defaultValue={t.animations} className="input"><option value="subtle">Subtle</option><option value="expressive">Expressive</option><option value="none">Off</option></select></Field>
              </div><p className="mt-3 text-[12px] text-muted">Cormorant Garamond and Jost are self-hosted. Other fonts load from Google Fonts.</p></Card>
              <Card title="Logo & favicon"><div className="grid gap-4 md:grid-cols-2">
                <Field label="Logo image (optional)" hint="Leave empty to use the built-in Hairver Green wordmark"><MediaField name="logo_media_url" defaultUrl={t.logo_media_url} kind="image" /></Field>
                <Field label="Favicon (optional)" hint="Square PNG or SVG, at least 512×512"><MediaField name="favicon_url" defaultUrl={t.favicon_url} kind="image" /></Field>
              </div></Card>
              <div><Submit>Save theme</Submit></div>
            </ActionForm>); })()}

          {tab === 'checkout' && (() => { const c = { guest_checkout: true, hold_minutes: 60, require_phone: true, terms_page: '/policies/terms', order_note: true, ...(S.checkout ?? {}) }; return (
            <Card title="Checkout"><ActionForm action={saveSetting} className="grid gap-4"><Hidden k="checkout" />
              <Toggle name="guest_checkout" defaultChecked={c.guest_checkout} label="Allow guest checkout" />
              <Toggle name="require_phone" defaultChecked={c.require_phone} label="Require a phone number" />
              <Toggle name="order_note" defaultChecked={c.order_note} label="Allow order notes" />
              <Field label="Hold stock for unpaid orders (minutes)" hint="Reserved stock is released if payment is not completed in time"><input type="number" name="hold_minutes" min={15} max={1440} defaultValue={c.hold_minutes} className="input max-w-[140px]" /></Field>
              <Field label="Terms page"><input name="terms_page" defaultValue={c.terms_page} className="input max-w-sm" /></Field>
              <div><Submit>Save checkout settings</Submit></div>
            </ActionForm></Card>); })()}

          {tab === 'currencies' && (() => { const c = S.currencies ?? { display: [] }; return (
            <Card title="Display currencies"><ActionForm action={saveSetting} className="grid gap-4"><Hidden k="currencies" />
              <p className="text-[13px] text-muted">Customers can view prices in these currencies. Payments are always charged in Naira (NGN). Rate = Naira per one unit of the currency — update it regularly.</p>
              <ListEditor name="display" defaultValue={(c.display ?? []).filter((d: any) => d.code !== 'NGN')} addLabel="Add currency" fields={[{ key: 'code', label: 'Code', placeholder: 'USD' }, { key: 'symbol', label: 'Symbol', placeholder: '$' }, { key: 'rate', label: 'Naira per unit', type: 'number' }]} />
              <div><Submit>Save currencies</Submit></div>
            </ActionForm></Card>); })()}

          {tab === 'custom_unit' && (
            <Card title="Custom unit pricing"><ActionForm action={saveSetting} className="grid gap-4"><Hidden k="custom_unit" />
              <p className="text-[13px] text-muted">The configurator price is the Custom Unit product price, plus extra length beyond the base, plus each option&apos;s surcharge. Options marked “Review” flag the order for staff confirmation before production. Keep the group keys (hair, texture, length, lace, density, colour…) unchanged — the configurator steps use them.</p>
              <CustomUnitEditor initial={(S.custom_unit as CustomUnitConfig) ?? DEFAULT_CUSTOM_UNIT} />
              <div><Submit>Save pricing</Submit></div>
            </ActionForm></Card>)}

          {tab === 'seo' && (() => { const s = { title_template: '%s · Hairver Green', default_title: '', default_description: '', og_image: null, ...(S.seo ?? {}) }; return (
            <Card title="Search engines & sharing"><ActionForm action={saveSetting} className="grid gap-4"><Hidden k="seo" />
              <Field label="Title template" hint="%s is replaced with the page title"><input name="title_template" defaultValue={s.title_template} className="input" /></Field>
              <Field label="Homepage title"><input name="default_title" defaultValue={s.default_title} maxLength={70} className="input" /></Field>
              <Field label="Default meta description"><textarea name="default_description" defaultValue={s.default_description} maxLength={320} className="input !min-h-[80px]" /></Field>
              <Field label="Default share image" hint="1200×630 recommended"><MediaField name="og_image" defaultUrl={s.og_image} kind="image" /></Field>
              <p className="text-[12px] text-muted">The sitemap is published at /sitemap.xml and robots rules at /robots.txt. Submit the sitemap in Google Search Console.</p>
              <div><Submit>Save SEO</Submit></div>
            </ActionForm></Card>); })()}

          {tab === 'analytics' && (() => { const a = { ga4_id: '', meta_pixel_id: '', tiktok_pixel_id: '', gsc_verification: '', ...(S.analytics ?? {}) }; return (
            <Card title="Analytics & pixels"><ActionForm action={saveSetting} className="grid gap-4"><Hidden k="analytics" />
              <Field label="Google Analytics 4 measurement ID" hint="Looks like G-XXXXXXXXXX"><input name="ga4_id" defaultValue={a.ga4_id} className="input max-w-sm" /></Field>
              <Field label="Meta (Facebook/Instagram) Pixel ID"><input name="meta_pixel_id" defaultValue={a.meta_pixel_id} className="input max-w-sm" /></Field>
              <Field label="TikTok Pixel ID"><input name="tiktok_pixel_id" defaultValue={a.tiktok_pixel_id} className="input max-w-sm" /></Field>
              <Field label="Google Search Console verification code" hint="Only the content value of the meta tag"><input name="gsc_verification" defaultValue={a.gsc_verification} className="input max-w-sm" /></Field>
              <p className="text-[12px] text-muted">Tracking scripts load only after a visitor accepts cookies. First-party store analytics (the dashboard funnel) work without these.</p>
              <div><Submit>Save analytics</Submit></div>
            </ActionForm></Card>); })()}

          {tab === 'notifications' && (() => { const n = { order_alert_emails: [], low_stock_emails: [], from_name: 'Hairver Green', ...(S.notifications ?? {}) }; return (
            <Card title="Staff notifications"><ActionForm action={saveSetting} className="grid gap-4"><Hidden k="notifications" />
              <Field label="New order alerts go to"><TagsInput name="order_alert_emails" defaultValue={n.order_alert_emails} placeholder="email, press Enter" /></Field>
              <Field label="Low stock alerts go to"><TagsInput name="low_stock_emails" defaultValue={n.low_stock_emails} placeholder="email, press Enter" /></Field>
              <Field label="Email sender name"><input name="from_name" defaultValue={n.from_name} className="input max-w-sm" /></Field>
              <p className="text-[12px] text-muted">Customer emails (order confirmation, shipping, refunds) are sent automatically through Resend once RESEND_API_KEY is set.</p>
              <div><Submit>Save notifications</Submit></div>
            </ActionForm></Card>); })()}

          {tab === 'reviews' && (() => { const r = { reviews_enabled: true, verified_only: false, ...(S.social_proof ?? {}) }; return (
            <Card title="Reviews"><ActionForm action={saveSetting} className="grid gap-4"><Hidden k="social_proof" />
              <Toggle name="reviews_enabled" defaultChecked={r.reviews_enabled} label="Show reviews on product pages" />
              <Toggle name="verified_only" defaultChecked={r.verified_only} label="Only verified buyers can leave reviews" />
              <p className="text-[12px] text-muted">All reviews are held for moderation before they appear.</p>
              <div><Submit>Save</Submit></div>
            </ActionForm></Card>); })()}

          {tab === 'integrations' && (
            <Card title="Integrations">
              <div className="grid gap-4 text-[14px]">
                <Status label="Paystack payments" ok={!!process.env.PAYSTACK_SECRET_KEY} hint="Set PAYSTACK_SECRET_KEY and NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in Vercel. Webhook URL: /api/webhooks/paystack" />
                <Status label="Email (Resend)" ok={!!process.env.RESEND_API_KEY} hint="Set RESEND_API_KEY and EMAIL_FROM in Vercel, and verify your sending domain in Resend." />
                <Status label="Scheduled maintenance" ok={!!process.env.CRON_SECRET} hint="Set CRON_SECRET in Vercel. Releases expired stock holds daily." />
                <p className="text-[12px] text-muted">Secret keys live only in environment variables — they are never stored in the database or shown in the browser.</p>
              </div>
            </Card>)}
        </div>
      </div>
    </>
  );
}

function Hidden({ k }: { k: string }) {
  return <input type="hidden" name="key" value={k} />;
}

function Status({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return <div className="flex gap-3"><span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', ok ? 'bg-[#1E7A54]' : 'bg-sale')} aria-hidden /><div><p className="font-medium">{label} · {ok ? 'Connected' : 'Not configured'}</p><p className="text-[12px] text-muted">{hint}</p></div></div>;
}
