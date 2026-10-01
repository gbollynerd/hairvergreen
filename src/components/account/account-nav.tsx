'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [['/account', 'Overview'], ['/account/orders', 'Orders'], ['/account/wishlist', 'Wishlist'], ['/account/addresses', 'Addresses'], ['/account/details', 'Account details'], ['/account/notifications', 'Notifications']];

export function AccountNav() {
  const path = usePathname();
  return (
    <nav aria-label="Account" className="-mx-4 flex gap-1 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:flex-col lg:px-0">
      {LINKS.map(([href, label]) => {
        const active = href === '/account' ? path === href : path.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('shrink-0 border-b-2 px-3 py-2 text-[14px] lg:border-b-0 lg:border-l-2 lg:px-4', active ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink')}>{label}</Link>;
      })}
      <form action="/auth/signout" method="post" className="shrink-0"><button className="px-3 py-2 text-left text-[14px] text-muted hover:text-ink lg:px-4">Sign out</button></form>
    </nav>
  );
}
