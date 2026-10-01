'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function Countdown({ to, dark, large }: { to: string; dark?: boolean; large?: boolean }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now === null) return <div className={large ? 'h-[86px]' : 'h-[52px]'} aria-hidden />;
  const diff = Math.max(0, target - now);
  const parts: [string, number][] = [['Days', Math.floor(diff / 86400000)], ['Hours', Math.floor(diff / 3600000) % 24], ['Mins', Math.floor(diff / 60000) % 60], ['Secs', Math.floor(diff / 1000) % 60]];
  return (
    <div className="flex gap-3" role="timer" aria-label={`Ends in ${parts.map(([l, v]) => `${v} ${l}`).join(', ')}`}>
      {parts.map(([label, v]) => (
        <div key={label} className={cn('flex flex-col items-center border px-3 py-2', dark ? 'border-primary-contrast/30' : 'border-line', large && 'px-5 py-3')}>
          <span className={cn('font-display tabular-nums leading-none', large ? 'text-[40px]' : 'text-[26px]')}>{String(v).padStart(2, '0')}</span>
          <span className="mt-1 text-[9px] uppercase tracking-[0.2em] opacity-70">{label}</span>
        </div>
      ))}
    </div>
  );
}
