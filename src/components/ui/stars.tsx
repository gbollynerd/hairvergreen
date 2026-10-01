import { cn } from '@/lib/utils';

export function Stars({ value, size = 13, className, label = true }: { value: number; size?: number; className?: string; label?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={cn('inline-flex items-center', className)} {...(label ? { role: 'img', 'aria-label': `Rated ${value.toFixed(1)} out of 5` } : { 'aria-hidden': true })}>
      <span className="relative inline-block leading-none" style={{ fontSize: size, letterSpacing: 2 }}>
        <span className="text-line">★★★★★</span>
        <span className="absolute inset-0 overflow-hidden text-accent-strong" style={{ width: `${pct}%` }}>★★★★★</span>
      </span>
    </span>
  );
}
