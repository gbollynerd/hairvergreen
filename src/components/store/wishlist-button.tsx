'use client';
import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useStore } from './store-provider';
import { cn } from '@/lib/utils';

export function WishlistButton({ productId, name, className, size = 18, withLabel }: { productId: string; name?: string; className?: string; size?: number; withLabel?: boolean }) {
  const { inWishlist, toggleWishlist } = useStore();
  const [pop, setPop] = useState(false);
  const on = inWishlist(productId);
  return (
    <button type="button" aria-pressed={on} aria-label={on ? `Remove ${name ?? 'item'} from wishlist` : `Save ${name ?? 'item'} to wishlist`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPop(true); toggleWishlist(productId, name); setTimeout(() => setPop(false), 450); }}
      className={cn('inline-flex items-center gap-2 transition-opacity hover:opacity-80', className)}>
      <Heart size={size} strokeWidth={1.3} className={cn(pop && 'animate-heart', on ? 'fill-current text-sale' : '')} />
      {withLabel && <span className="caps">{on ? 'Saved' : 'Wishlist'}</span>}
    </button>
  );
}
