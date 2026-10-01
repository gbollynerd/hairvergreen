'use client';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProductCardData } from '@/lib/types';
import { ProductCard } from '@/components/store/product-card';

export function ProductRail({ items }: { items: ProductCardData[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: 'smooth' });
  return (
    <div className="relative">
      <div ref={ref} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none md:mx-0 md:gap-6 md:px-0">
        {items.map((p, i) => (
          <div key={p.id} className="w-[68%] shrink-0 snap-start sm:w-[42%] md:w-[31%] xl:w-[23.5%]"><ProductCard p={p} priority={i < 2} sizes="(min-width:1280px) 24vw, (min-width:768px) 31vw, 68vw" /></div>
        ))}
      </div>
      {items.length > 4 && (
        <div className="mt-6 hidden justify-end gap-2 md:flex">
          <button type="button" onClick={() => scroll(-1)} className="grid h-11 w-11 place-items-center border border-line hover:border-primary" aria-label="Scroll left"><ChevronLeft size={18} strokeWidth={1.3} /></button>
          <button type="button" onClick={() => scroll(1)} className="grid h-11 w-11 place-items-center border border-line hover:border-primary" aria-label="Scroll right"><ChevronRight size={18} strokeWidth={1.3} /></button>
        </div>
      )}
    </div>
  );
}
