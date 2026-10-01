'use client';
import { useStore } from './store-provider';

// Displays the collection's "complete set" saving. The pricing engine applies the same saving
// automatically when every piece in the collection is in the bag.
export function CollectionDeal({ name, regular, price }: { name: string; regular: number; price: number; products?: unknown }) {
  const { money } = useStore();
  return (
    <div className="mb-10 flex flex-col gap-3 border border-accent/60 bg-surface px-6 py-5 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="eyebrow">The complete set</p>
        <p className="mt-1 font-display text-[24px]">Own the full {name}</p>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[15px]">
        <span>Regular total <s className="text-muted">{money(regular)}</s></span>
        <span className="font-medium">Collection price {money(price)}</span>
        <span className="text-sale">Save {money(regular - price)} when you add every piece</span>
      </div>
    </div>
  );
}
