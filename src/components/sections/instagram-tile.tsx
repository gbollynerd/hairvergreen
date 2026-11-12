'use client';
import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { Media } from '@/components/ui/media';
import { InstagramIcon } from '@/components/ui/icons';
import { IG_EMBED_HEADER, IG_EMBED_MIN_WIDTH } from '@/lib/instagram';
import { cn } from '@/lib/utils';

/**
 * One Instagram post or reel, played on the site through Instagram's own embed.
 * The embed is framed so only its media shows (profile bar and footer are clipped) and it is only
 * loaded when the tile is close to the screen. With a cover image, nothing loads until it is tapped.
 */
export function InstagramTile({ embedUrl, kind, cover, alt }: { embedUrl: string; kind: 'reel' | 'post'; cover?: string | null; alt: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    let io: IntersectionObserver | undefined;
    if (!cover) {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { setActive(true); io?.disconnect(); }
      }, { rootMargin: '400px' });
      io.observe(el);
    }
    return () => { ro.disconnect(); io?.disconnect(); };
  }, [cover]);

  const base = Math.max(width, IG_EMBED_MIN_WIDTH);
  const scale = width ? width / base : 1;
  const label = kind === 'reel' ? 'Reel' : 'Post';

  return (
    <div ref={box} className="relative aspect-[4/5] overflow-hidden bg-panel">
      {!loaded && !cover && (
        <div className="absolute inset-0 grid place-items-center text-muted" aria-hidden><InstagramIcon width={26} height={26} className="animate-pulse" /></div>
      )}
      {active && width > 0 && (
        <iframe
          src={embedUrl} title={`${alt} — Instagram ${label.toLowerCase()}`} loading="lazy" scrolling="no" allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share" onLoad={() => setLoaded(true)}
          className={cn('absolute left-0 origin-top-left border-0 bg-white transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
          style={{ width: base, height: base * 1.25 + IG_EMBED_HEADER, top: -IG_EMBED_HEADER * scale, transform: `scale(${scale})` }}
        />
      )}
      {cover && !loaded && (
        <button type="button" onClick={() => setActive(true)} className="group absolute inset-0 block" aria-label={`Play ${alt}`}>
          <Media src={cover} alt={alt} fill sizes="(min-width:768px) 25vw, 72vw" className="zoom-on-hover" />
          <span className="absolute inset-0 grid place-items-center bg-[#0b1f18]/10">
            <span className={cn('grid h-14 w-14 place-items-center rounded-full bg-surface/90 text-ink transition-transform duration-500 group-hover:scale-110', active && 'animate-pulse')}>
              {kind === 'reel' ? <Play size={20} strokeWidth={1.4} className="translate-x-[1px]" /> : <InstagramIcon width={20} height={20} />}
            </span>
          </span>
        </button>
      )}
      <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 bg-surface/90 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-ink">
        <InstagramIcon width={12} height={12} /> {label}
      </span>
    </div>
  );
}
