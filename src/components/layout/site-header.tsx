'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search, User, Heart, ShoppingBag, Menu, ChevronDown } from 'lucide-react';
import { useStore } from '@/components/store/store-provider';
import { Wordmark } from '@/components/ui/logo';
import { Media } from '@/components/ui/media';
import type { MenuItem } from '@/lib/types';
import { cn } from '@/lib/utils';

export type NavItem = MenuItem & { children?: MenuItem[] };

export function SiteHeader({ nav, logoUrl }: { nav: NavItem[]; logoUrl?: string | null }) {
  const { cart, setCartOpen, setSearchOpen, setMenuOpen, wishlist, user } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const pathname = usePathname();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => setOpen(null), [pathname]);

  const count = cart?.item_count ?? 0;
  const enter = (i: number) => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(i); };
  const leave = () => { closeTimer.current = setTimeout(() => setOpen(null), 140); };

  return (
    <header className={cn('sticky top-0 z-50 border-b bg-bg/95 backdrop-blur transition-[border-color,box-shadow] duration-500', scrolled ? 'border-line shadow-[0_1px_18px_rgba(15,61,46,0.06)]' : 'border-transparent')}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:bg-surface focus:px-4 focus:py-2">Skip to content</a>
      <div className="container-x grid h-[64px] grid-cols-[1fr_auto_1fr] items-center md:h-[76px]">
        <div className="flex items-center gap-1">
          <button type="button" className="grid h-11 w-11 place-items-center lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={22} strokeWidth={1.3} /></button>
          <button type="button" className="grid h-11 w-11 place-items-center lg:w-auto lg:gap-2 lg:px-1 lg:flex lg:items-center" onClick={() => setSearchOpen(true)} aria-label="Search">
            <Search size={20} strokeWidth={1.3} /><span className="hidden caps text-muted lg:inline">Search</span>
          </button>
        </div>
        <Link href="/" aria-label="Hairver Green — home" className="text-primary"><Wordmark logoUrl={logoUrl} /></Link>
        <div className="flex items-center justify-end gap-0.5">
          <Link href={user ? '/account' : '/login'} className="hidden h-11 w-11 place-items-center sm:grid" aria-label={user ? 'Your account' : 'Sign in'}><User size={20} strokeWidth={1.3} /></Link>
          <Link href="/wishlist" className="relative grid h-11 w-11 place-items-center" aria-label={`Wishlist (${wishlist.length})`}>
            <Heart size={20} strokeWidth={1.3} />
            {wishlist.length > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent-strong" aria-hidden />}
          </Link>
          <button type="button" onClick={() => setCartOpen(true)} className="relative grid h-11 w-11 place-items-center" aria-label={`Shopping bag, ${count} item${count === 1 ? '' : 's'}`}>
            <ShoppingBag size={20} strokeWidth={1.3} />
            {count > 0 && <span className="absolute right-0.5 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-contrast">{count}</span>}
          </button>
        </div>
      </div>

      <nav aria-label="Main" className="hidden border-t border-line/70 lg:block" onMouseLeave={leave}>
        <ul className="container-x flex justify-center gap-7 xl:gap-10">
          {nav.map((item, i) => {
            const has = !!item.children?.length;
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
            return (
              <li key={item.label} onMouseEnter={() => enter(i)} className="relative">
                <Link href={item.href} className={cn('flex h-12 items-center gap-1 caps text-[11px] tracking-[0.2em] transition-colors hover:text-accent-strong', active && 'text-accent-strong')}
                  aria-expanded={has ? open === i : undefined} aria-haspopup={has ? 'true' : undefined}
                  onFocus={() => enter(i)}>
                  {item.label}{has && <ChevronDown size={12} strokeWidth={1.4} className={cn('transition-transform', open === i && 'rotate-180')} />}
                </Link>
              </li>
            );
          })}
        </ul>
        {open !== null && nav[open]?.children?.length ? (
          <div className="absolute inset-x-0 top-full border-y border-line bg-surface animate-fade-in" onMouseEnter={() => enter(open)} onMouseLeave={leave}>
            <div className="container-x grid grid-cols-12 gap-8 py-10">
              <div className="col-span-8 grid grid-cols-3 gap-x-8 gap-y-3">
                <p className="eyebrow col-span-3 mb-2">{nav[open].label}</p>
                {nav[open].children!.map((c) => (
                  <Link key={c.href + c.label} href={c.href} className="font-display text-[22px] leading-tight hover:text-accent-strong" onBlur={(e) => { if (!e.currentTarget.closest('div')?.contains(e.relatedTarget as Node)) leave(); }}>
                    {c.label}
                  </Link>
                ))}
                <Link href={nav[open].href} className="col-span-3 mt-4 caps text-muted link-underline w-fit">Shop all {nav[open].label.toLowerCase()}</Link>
              </div>
              {nav[open].feature && (
                <Link href={nav[open].feature!.href} className="group col-span-4 block">
                  <div className="relative aspect-[16/10] overflow-hidden bg-panel"><Media src={nav[open].feature!.image} alt="" fill sizes="30vw" className="zoom-on-hover" /></div>
                  <p className="mt-3 font-display text-xl">{nav[open].feature!.title}</p>
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </nav>
    </header>
  );
}
