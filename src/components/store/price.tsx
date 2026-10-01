'use client';
import { useStore } from './store-provider';
import { percentOff } from '@/lib/money';
import { cn } from '@/lib/utils';

export function Price({ amount, compareAt, from, className, size = 'md', showSave }: {
  amount: number; compareAt?: number | null; from?: boolean; className?: string; size?: 'sm' | 'md' | 'lg'; showSave?: boolean;
}) {
  const { money } = useStore();
  const off = percentOff(amount, compareAt);
  const cls = size === 'lg' ? 'text-[22px]' : size === 'sm' ? 'text-[13px]' : 'text-[15px]';
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      {from && <span className="text-[11px] uppercase tracking-[0.16em] text-muted">From</span>}
      <span className={cn(cls, off ? 'text-sale' : 'text-ink', 'font-medium tabular-nums')}>{money(amount)}</span>
      {off > 0 && (
        <>
          <s className={cn(size === 'lg' ? 'text-[16px]' : 'text-[13px]', 'text-muted tabular-nums')} aria-label={`was ${money(compareAt!)}`}>{money(compareAt!)}</s>
          {showSave && <span className="text-[11px] uppercase tracking-[0.14em] text-sale">Save {money(compareAt! - amount)}</span>}
        </>
      )}
    </span>
  );
}
