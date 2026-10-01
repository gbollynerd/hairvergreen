import { Suspense } from 'react';
import { getSettings, getMenus, getAnnouncements, getPopups } from '@/lib/data/content';
import { getAttributes } from '@/lib/data/catalog';
import { StoreProvider } from '@/components/store/store-provider';
import { SiteHeader, type NavItem } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { AnnouncementBar } from '@/components/layout/announcement-bar';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { SearchOverlay } from '@/components/layout/search-overlay';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { Toasts } from '@/components/layout/toasts';
import { CartDrawer } from '@/components/store/cart-drawer';
import { QuickView } from '@/components/product/quick-view';
import { PopupManager } from '@/components/store/popup-manager';
import { AnalyticsScripts } from '@/components/store/analytics-scripts';
import { OrganizationJsonLd } from '@/components/seo/json-ld';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/layout/setup-notice';

export default async function StoreLayout({ children }: LayoutProps<'/'>) {
  if (!isConfigured()) return <SetupNotice />;
  const [settings, menus, announcements, popups, attributes] = await Promise.all([getSettings(), getMenus(), getAnnouncements(), getPopups(), getAttributes()]);

  // Expand "auto" menu items (Shop by Texture / Length) from the admin-managed attribute values
  const nav: NavItem[] = (menus.main ?? []).map((item) => {
    if (item.auto === 'texture' || item.auto === 'length') {
      const children = attributes.filter((a) => a.attribute === item.auto && a.show_in_nav)
        .map((a) => ({ label: item.auto === 'length' ? `${a.label} hair` : a.label, href: `/shop?${item.auto}=${a.slug}` }));
      return { ...item, children };
    }
    return item;
  });

  return (
    <StoreProvider currencies={settings.currencies.display}>
      <OrganizationJsonLd store={settings.store} />
      <AnnouncementBar items={announcements} />
      <SiteHeader nav={nav} logoUrl={settings.theme.logo_media_url} />
      <main id="main" className="min-h-[60vh] pb-[60px] md:pb-0">{children}</main>
      <SiteFooter menus={menus} store={settings.store} />
      <MobileMenu nav={nav} social={{ instagram: settings.store.instagram, tiktok: settings.store.tiktok, whatsapp: settings.store.whatsapp }} />
      <SearchOverlay popular={['Body Wave', 'Straight', '20 inch', 'Glueless', 'Custom Unit', 'Donor hair']} />
      <CartDrawer />
      <QuickView />
      <PopupManager popups={popups} />
      <MobileBottomNav />
      <Toasts />
      <Suspense fallback={null}>
        <AnalyticsScripts ga4={settings.analytics.ga4_id} meta={settings.analytics.meta_pixel_id} tiktok={settings.analytics.tiktok_pixel_id} />
      </Suspense>
    </StoreProvider>
  );
}
