'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Background/section video: shows the thumbnail (or first frame), then plays muted on a loop
 * only while it is on screen. Visitors who prefer reduced motion get the still with play controls instead.
 */
export function Video({ src, poster, className, controls }: { src: string; poster?: string | null; className?: string; controls?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    if (mq.matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
    }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, [src]);
  return (
    <video ref={ref} src={poster ? src : `${src}#t=0.1`} poster={poster ?? undefined} muted loop playsInline preload="metadata"
      controls={controls || reduced} className={cn('h-full w-full object-cover', className)} />
  );
}
