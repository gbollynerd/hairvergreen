'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useStore } from '@/components/store/store-provider';
import { Dialog } from '@/components/ui/dialog';
import { Wordmark } from '@/components/ui/logo';
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from '@/components/ui/icons';
import type { NavItem } from './site-header';

export function MobileMenu({ nav, social }: { nav: NavItem[]; social: { instagram?: string; tiktok?: string; whatsapp?: string } }) {
  const { menuOpen, setMenuOpen, user, currencies, currency, setCurrency } = useStore();
  const [panel, setPanel] = useState<number | null>(null);
  const close = () => { setMenuOpen(false); setPanel(null); };
  return (
    <Dialog open={menuOpen} onClose={close} label="Menu" variant="drawer-left" className="flex flex-col bg-bg">
      <div className="flex h-16 items-center border-b border-line px-5 text-primary"><Wordmark /></div>
      <div className="relative flex-1 overflow-y-auto">
        {panel === null ? (
          <ul className="px-5 py-4">
            {nav.map((item, i) => (
              <li key={item.label} className="border-b border-line/70">
                {item.children?.length ? (
                  <button type="button" onClick={() => setPanel(i)} className="flex w-full items-center justify-between py-4 font-display text-[24px]">
                    {item.label}<ChevronRight size={18} strokeWidth={1.2} />
                  </button>
                ) : (
                  <Link href={item.href} onClick={close} className="block py-4 font-display text-[24px]">{item.label}</Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="animate-fade-in px-5 py-4">
            <button type="button" onClick={() => setPanel(null)} className="mb-2 flex items-center gap-2 caps text-muted"><ChevronLeft size={16} /> Back</button>
            <p className="eyebrow mb-3 mt-4">{nav[panel].label}</p>
            <ul>
              {nav[panel].children!.map((c) => (
                <li key={c.href + c.label}><Link href={c.href} onClick={close} className="block border-b border-line/70 py-3.5 text-[17px]">{c.label}</Link></li>
              ))}
              <li><Link href={nav[panel].href} onClick={close} className="block py-4 caps">Shop all</Link></li>
            </ul>
          </div>
        )}
      </div>
      <div className="space-y-4 border-t border-line p-5">
        <div className="flex gap-3">
          <Link href={user ? '/account' : '/login'} onClick={close} className="btn btn-outline btn-sm flex-1">{user ? 'My account' : 'Sign in'}</Link>
          <Link href="/track-order" onClick={close} className="btn btn-outline btn-sm flex-1">Track order</Link>
        </div>
        {currencies.length > 1 && (
          <label className="flex items-center justify-between text-[13px] text-muted">
            <span>Display currency</span>
            <select className="input !min-h-[38px] !w-auto !py-1" value={currency.code} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>)}
            </select>
          </label>
        )}
        <div className="flex gap-4 text-primary">
          {social.instagram && <a href={social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><InstagramIcon width={20} height={20} /></a>}
          {social.tiktok && <a href={social.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok"><TikTokIcon width={20} height={20} /></a>}
          {social.whatsapp && <a href={`https://wa.me/${social.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><WhatsAppIcon width={20} height={20} /></a>}
        </div>
      </div>
    </Dialog>
  );
}
