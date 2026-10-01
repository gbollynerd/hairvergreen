import Link from 'next/link';
import type { MenuItem, StoreSettings } from '@/lib/types';
import { Mark } from '@/components/ui/logo';
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from '@/components/ui/icons';
import { NewsletterForm } from '@/components/store/newsletter-form';
import { CurrencySelect } from '@/components/store/currency-select';

export function SiteFooter({ menus, store }: { menus: Record<string, MenuItem[]>; store: StoreSettings }) {
  const cols: [string, string][] = [['Shop', 'footer_shop'], ['Customer Care', 'footer_care'], ['Hairver Green', 'footer_brand'], ['Legal', 'footer_legal']];
  return (
    <footer className="mt-24 bg-primary text-primary-contrast">
      <div className="container-x grid gap-12 py-16 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Mark className="h-14 w-auto text-accent" />
          <p className="wordmark mt-5 text-[18px]">Hairver Green</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-accent">Luxury Hair House · Lagos</p>
          <p className="mt-8 font-display text-[26px] leading-tight">Be the first to know.</p>
          <p className="mt-2 text-[14px] text-primary-contrast/70">New drops, exclusive offers and hair care notes.</p>
          <div className="mt-5 max-w-md"><NewsletterForm dark source="footer" /></div>
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:col-span-8 lg:pl-10">
          {cols.map(([title, key]) => (
            <nav key={key} aria-label={title}>
              <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-accent">{title}</p>
              <ul className="space-y-2.5 text-[14px] text-primary-contrast/80">
                {(menus[key] ?? []).map((i) => <li key={i.href + i.label}><Link href={i.href} className="link-underline hover:text-primary-contrast">{i.label}</Link></li>)}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-primary-contrast/15">
        <div className="container-x flex flex-col gap-5 py-6 text-[12px] text-primary-contrast/60 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Hairver Green · {store.address}</p>
          <div className="flex items-center gap-5">
            <CurrencySelect />
            {store.instagram && <a href={store.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:text-accent"><InstagramIcon width={18} height={18} /></a>}
            {store.tiktok && <a href={store.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="hover:text-accent"><TikTokIcon width={18} height={18} /></a>}
            {store.whatsapp && <a href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="hover:text-accent"><WhatsAppIcon width={18} height={18} /></a>}
          </div>
          <p>Secure payments by Paystack</p>
        </div>
      </div>
    </footer>
  );
}
