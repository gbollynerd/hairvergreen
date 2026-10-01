'use client';
import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Fades/slides content in once when it enters the viewport. Respects reduced-motion via CSS.
 * Visibility lives in React state (not a hand-added class) so re-renders never hide revealed content again.
 */
export function Reveal({ children, as: Tag = 'div', className, delay = 0, variant = 'fade' }: { children: ReactNode; as?: ElementType; className?: string; delay?: number; variant?: 'fade' | 'image' }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (!('IntersectionObserver' in window)) { setShown(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return (
    <Tag ref={ref} className={cn(variant === 'image' ? 'img-reveal' : 'reveal', shown && 'is-visible', className)} style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}>
      {children}
    </Tag>
  );
}
