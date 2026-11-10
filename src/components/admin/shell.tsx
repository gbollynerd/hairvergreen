'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, BarChart3, ShoppingBag, RotateCcw, CreditCard, ShoppingCart, Package, Boxes, Layers, FolderTree, Star, Users, CalendarClock, Mail, Send, Percent, Megaphone, MessageSquare, Bell, Camera, FileText, BookOpen, Image as ImageIcon, Menu as MenuIcon, Truck, Receipt, UserCog, Shield, Settings, ScrollText, ExternalLink, X, PanelLeft, Wallet, Globe } from 'lucide-react';
import { Mark } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { SearchPalette, type Destination } from './search-palette';

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; perm: string | string[] };
const NAV: { group: string; items: Item[] }[] = [
  { group: 'Overview', items: [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
    { href: '/admin/analytics', label: 'Sales & profit', icon: BarChart3, perm: 'analytics.view' },
    { href: '/admin/expenses', label: 'Expenses', icon: Wallet, perm: 'expenses.manage' },
  ] },
  { group: 'Sales', items: [
    { href: '/admin/orders', label: 'Orders', icon: ShoppingBag, perm: 'orders.view' },
    { href: '/admin/returns', label: 'Returns & refunds', icon: RotateCcw, perm: 'returns.manage' },
    { href: '/admin/payments', label: 'Payments', icon: CreditCard, perm: 'payments.view' },
    { href: '/admin/carts', label: 'Abandoned carts', icon: ShoppingCart, perm: 'carts.view' },
  ] },
  { group: 'Catalogue', items: [
    { href: '/admin/products', label: 'Products', icon: Package, perm: 'products.view' },
    { href: '/admin/products?type=bundle_deal', label: 'Bundles', icon: Layers, perm: 'products.view' },
    { href: '/admin/inventory', label: 'Inventory', icon: Boxes, perm: 'inventory.view' },
    { href: '/admin/categories', label: 'Categories & attributes', icon: FolderTree, perm: 'categories.manage' },
    { href: '/admin/collections', label: 'Collections', icon: Layers, perm: 'collections.manage' },
    { href: '/admin/reviews', label: 'Reviews', icon: Star, perm: 'reviews.moderate' },
  ] },
  { group: 'Customers', items: [
    { href: '/admin/customers', label: 'Customers', icon: Users, perm: 'customers.view' },
    { href: '/admin/consultations', label: 'Consultations', icon: CalendarClock, perm: 'consultations.manage' },
    { href: '/admin/messages', label: 'Messages', icon: Mail, perm: 'messages.view' },
    { href: '/admin/newsletter', label: 'Newsletter', icon: Send, perm: 'newsletter.view' },
  ] },
  { group: 'Marketing', items: [
    { href: '/admin/discounts', label: 'Discounts & coupons', icon: Percent, perm: ['coupons.edit', 'coupons.create'] },
    { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone, perm: 'campaigns.manage' },
    { href: '/admin/popups', label: 'Popups', icon: MessageSquare, perm: 'popups.manage' },
    { href: '/admin/announcements', label: 'Announcement bar', icon: Bell, perm: 'popups.manage' },
    { href: '/admin/social', label: 'Social gallery', icon: Camera, perm: 'social.manage' },
  ] },
  { group: 'Content', items: [
    { href: '/admin/pages', label: 'Pages & homepage', icon: FileText, perm: 'content.edit' },
    { href: '/admin/journal', label: 'Hair Journal', icon: BookOpen, perm: ['blog.create', 'blog.edit_any'] },
    { href: '/admin/media', label: 'Media library', icon: ImageIcon, perm: 'media.upload' },
    { href: '/admin/navigation', label: 'Navigation', icon: MenuIcon, perm: 'navigation.manage' },
  ] },
  { group: 'Operations', items: [
    { href: '/admin/shipping-methods', label: 'Delivery methods', icon: Truck, perm: 'shipping.manage' },
    { href: '/admin/shipping-zones', label: 'Shipping zones', icon: Globe, perm: 'shipping.manage' },
    { href: '/admin/taxes', label: 'Taxes', icon: Receipt, perm: 'taxes.manage' },
  ] },
  { group: 'Administration', items: [
    { href: '/admin/users', label: 'Staff', icon: UserCog, perm: 'users.manage' },
    { href: '/admin/roles', label: 'Roles & permissions', icon: Shield, perm: 'roles.manage' },
    { href: '/admin/settings', label: 'Settings & theme', icon: Settings, perm: ['settings.edit', 'theme.edit'] },
    { href: '/admin/audit', label: 'Audit log', icon: ScrollText, perm: 'audit.view' },
  ] },
];

// Extra search keywords and deep links (settings tabs, create screens) for the admin search.
const KEYWORDS: Record<string, string> = {
  '/admin/shipping-methods': 'delivery shipping rates courier dhl gig dispatch pickup express standard free shipping',
  '/admin/shipping-zones': 'delivery countries states regions lagos abuja international',
  '/admin/discounts': 'coupons promo codes sale offers',
  '/admin/analytics': 'reports revenue profit sales statement',
  '/admin/expenses': 'costs spending profit',
  '/admin/pages': 'homepage hero sections page builder about faq policies',
  '/admin/navigation': 'menu footer links header',
  '/admin/users': 'team staff invite employees',
  '/admin/roles': 'permissions access',
  '/admin/media': 'images videos photos uploads library thumbnails',
  '/admin/inventory': 'stock quantity low stock',
  '/admin/returns': 'refunds rma exchanges',
  '/admin/carts': 'abandoned recovery reminders',
  '/admin/payments': 'paystack transactions',
  '/admin/audit': 'history log changes activity',
};
const EXTRA: (Destination & { perm: string | string[] })[] = [
  { label: 'Settings · Store details', href: '/admin/settings?tab=store', group: 'Settings', keywords: 'whatsapp phone email address instagram contact', perm: 'settings.edit' },
  { label: 'Settings · Theme', href: '/admin/settings?tab=theme', group: 'Settings', keywords: 'colours colors fonts logo favicon brand', perm: 'theme.edit' },
  { label: 'Settings · Checkout', href: '/admin/settings?tab=checkout', group: 'Settings', keywords: 'guest phone stock hold terms', perm: 'settings.edit' },
  { label: 'Settings · Currencies', href: '/admin/settings?tab=currencies', group: 'Settings', keywords: 'usd gbp eur exchange rate dollar pound', perm: 'settings.edit' },
  { label: 'Settings · Custom unit pricing', href: '/admin/settings?tab=custom_unit', group: 'Settings', keywords: 'configurator lace density surcharge', perm: 'settings.edit' },
  { label: 'Settings · SEO', href: '/admin/settings?tab=seo', group: 'Settings', keywords: 'google search meta title description share image', perm: 'settings.edit' },
  { label: 'Settings · Analytics & pixels', href: '/admin/settings?tab=analytics', group: 'Settings', keywords: 'google analytics ga4 meta facebook tiktok pixel', perm: 'settings.edit' },
  { label: 'Settings · Notifications', href: '/admin/settings?tab=notifications', group: 'Settings', keywords: 'email alerts low stock new order', perm: 'settings.edit' },
  { label: 'Settings · Integrations', href: '/admin/settings?tab=integrations', group: 'Settings', keywords: 'paystack resend keys email payments', perm: 'settings.edit' },
  { label: 'New delivery method', href: '/admin/shipping-methods/new', group: 'Create', keywords: 'add shipping rate', perm: 'shipping.manage' },
  { label: 'New discount code', href: '/admin/discounts/new', group: 'Create', keywords: 'add coupon promo', perm: 'coupons.create' },
];

export function AdminShell({ staff, children }: { staff: { email: string; name: string | null; roles: string[]; permissions: string[] }; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const can = (p: string | string[]) => (Array.isArray(p) ? p : [p]).some((x) => staff.permissions.includes(x));
  const destinations: Destination[] = [
    ...NAV.flatMap((g) => g.items.filter((i) => can(i.perm)).map((i) => ({ label: i.label, href: i.href, group: g.group, keywords: KEYWORDS[i.href.split('?')[0]] }))),
    ...EXTRA.filter((e) => can(e.perm)).map(({ perm: _p, ...e }) => e),
  ];
  const nav = (
    <nav aria-label="Admin" className="space-y-6 px-3 py-5">
      {NAV.map((g) => {
        const items = g.items.filter((i) => can(i.perm));
        if (!items.length) return null;
        return (
          <div key={g.group}>
            <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.2em] text-primary-contrast/45">{g.group}</p>
            <ul className="space-y-0.5">{items.map((i) => {
              const base = i.href.split('?')[0];
              const active = i.href === '/admin' ? path === '/admin' : path.startsWith(base);
              const Icon = i.icon;
              return <li key={i.href}><Link href={i.href} prefetch={false} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined}
                className={cn('flex items-center gap-3 px-3 py-2 text-[13px] transition-colors', active ? 'bg-primary-contrast/10 text-primary-contrast' : 'text-primary-contrast/70 hover:bg-primary-contrast/5 hover:text-primary-contrast')}>
                <Icon size={16} strokeWidth={1.4} />{i.label}</Link></li>;
            })}</ul>
          </div>
        );
      })}
    </nav>
  );
  return (
    <div className="lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen overflow-y-auto bg-primary lg:block">
        <Link href="/admin" className="flex items-center gap-3 border-b border-primary-contrast/10 px-6 py-5 text-accent"><Mark className="h-8 w-auto" /><span className="wordmark text-[12px] text-primary-contrast">Hairver Green</span></Link>
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-primary animate-drawer-left">
            <div className="flex items-center justify-between border-b border-primary-contrast/10 px-5 py-4 text-primary-contrast"><span className="wordmark text-[12px]">Hairver Green</span><button onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
            {nav}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur md:gap-6 md:px-8">
          <button type="button" className="shrink-0 lg:hidden" onClick={() => setOpen(true)} aria-label="Open admin menu"><PanelLeft size={20} /></button>
          <SearchPalette destinations={destinations} />
          <div className="ml-auto flex shrink-0 items-center gap-4 text-[13px]">
            <Link href="/" target="_blank" className="inline-flex items-center gap-1.5 hover:underline" aria-label="View store"><span className="max-sm:hidden">View store</span> <ExternalLink size={13} /></Link>
            <span className="hidden text-muted xl:inline">{staff.email}</span>
            <form action="/auth/signout" method="post"><button className="underline">Sign out</button></form>
          </div>
        </header>
        <main className="admin-main px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
