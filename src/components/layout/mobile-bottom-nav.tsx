'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Heart, User, ShoppingBag } from 'lucide-react';
import { useStore } from '@/components/store/store-provider';

export function MobileBottomNav() {
  const { setSearchOpen, setCartOpen, cart, user } = useStore();
  const pathname = usePathname();
  if (pathname.startsWith('/products/') || pathname.startsWith('/checkout')) return null;
  const count = cart?.item_count ?? 0;
  const item = 'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-[0.14em]';
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 flex h-[60px] border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <Link href="/" className={item}><Home size={19} strokeWidth={1.3} />Home</Link>
      <button type="button" onClick={() => setSearchOpen(true)} className={item}><Search size={19} strokeWidth={1.3} />Search</button>
      <Link href="/wishlist" className={item}><Heart size={19} strokeWidth={1.3} />Saved</Link>
      <Link href={user ? '/account' : '/login'} className={item}><User size={19} strokeWidth={1.3} />Account</Link>
      <button type="button" onClick={() => setCartOpen(true)} className={`${item} relative`}>
        <ShoppingBag size={19} strokeWidth={1.3} />Bag
        {count > 0 && <span className="absolute right-[calc(50%-18px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] text-primary-contrast">{count}</span>}
      </button>
    </nav>
  );
}
