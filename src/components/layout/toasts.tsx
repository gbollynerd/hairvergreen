'use client';
import { useStore } from '@/components/store/store-provider';
import { cn } from '@/lib/utils';

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-8" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={cn('animate-fade-up pointer-events-auto px-5 py-3 text-[13px] tracking-wide shadow-lg', t.tone === 'error' ? 'bg-sale text-white' : 'bg-primary text-primary-contrast')}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
