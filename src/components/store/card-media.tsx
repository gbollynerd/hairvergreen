'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import type { CardMedia } from '@/lib/types';
import { Media, MediaThumb } from '@/components/ui/media';
import { cn } from '@/lib/utils';

/**
 * The picture area of a product card.
 * - First item is a video: show its thumbnail; play it (muted, looping) on hover on desktop,
 *   or automatically while the card is on screen on touch devices.
 * - Second item is a video: it fades in and plays on hover (desktop).
 * - Otherwise: the second image fades in on hover, as before.
 * Videos only load when they are about to play, and nothing autoplays for visitors who prefer reduced motion.
 */
export function CardMediaView({ images, name, sizes, priority }: { images: CardMedia[]; name: string; sizes: string; priority?: boolean }) {
  const first = images[0];
  const second = images[1];
  const video = first?.kind === 'video' ? first : second?.kind === 'video' ? second : null;
  const videoIsPrimary = video === first;

  const wrap = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);   // should be playing
  const [loaded, setLoaded] = useState(false);   // src attached
  const [playing, setPlaying] = useState(false); // first frame is actually showing

  // Touch devices (no hover): autoplay primary videos while visible.
  useEffect(() => {
    if (!video || !videoIsPrimary || !wrap.current) return;
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (canHover || reduced) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting && e.intersectionRatio >= 0.6), { threshold: [0, 0.6, 1] });
    io.observe(wrap.current);
    return () => io.disconnect();
  }, [video, videoIsPrimary]);

  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    if (active) {
      if (!loaded) setLoaded(true);
      const p = v.play();
      if (p) p.catch(() => {});
    } else {
      v.pause();
    }
  }, [active, loaded]);

  const onEnter = () => {
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: hover)').matches) setActive(true);
  };
  const onLeave = () => { if (window.matchMedia('(hover: hover)').matches) { setActive(false); setPlaying(false); if (vid.current) vid.current.currentTime = 0; } };

  return (
    <div ref={wrap} className="absolute inset-0" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <MediaThumb item={first} alt={first?.alt ?? name} sizes={sizes} priority={priority} className={cn(!video && 'zoom-on-hover')} />

      {/* Second image swap (only when there's no video to play) */}
      {!video && second && <Media src={second.url} alt="" fill sizes={sizes} className="opacity-0 transition-opacity duration-700 group-hover:opacity-100 max-md:hidden" />}

      {video && (
        <video
          ref={vid}
          src={loaded ? video.url : undefined}
          poster={video.poster ?? undefined}
          muted loop playsInline preload="none"
          aria-hidden
          onPlaying={() => setPlaying(true)}
          className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-500', playing && active ? 'opacity-100' : 'opacity-0', !videoIsPrimary && 'max-md:hidden')}
        />
      )}

      {video && videoIsPrimary && (
        <span className={cn('pointer-events-none absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-surface/85 text-ink transition-opacity', playing && active && 'opacity-0')} aria-hidden>
          <Play size={13} strokeWidth={1.6} className="ml-0.5" fill="currentColor" />
        </span>
      )}
    </div>
  );
}
