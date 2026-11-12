'use client';
import { useEffect, useRef, useState } from 'react';
import { InstagramIcon, TikTokIcon } from '@/components/ui/icons';
import { IG_EMBED_HEADER, IG_EMBED_MIN_WIDTH } from '@/lib/social-embed';
import { cn } from '@/lib/utils';

/**
 * One Instagram or TikTok post, shown and played on the site through the platform's own embed.
 * Works for photos and videos alike. The embed only loads once the tile is close to the screen.
 * Instagram's embed is framed so only its media shows (its profile bar and footer are clipped);
 * TikTok's player already fills its frame. `still` marks a photo post: clicks on it are blocked so it cannot link out.
 */
export function SocialEmbedTile({ platform, embedUrl, label, alt, still }: { platform: 'instagram' | 'tiktok'; embedUrl: string; label: string; alt: string; still?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setActive(true); io.disconnect(); }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, []);

  const ig = platform === 'instagram';
  const Icon = ig ? InstagramIcon : TikTokIcon;
  const base = Math.max(width, IG_EMBED_MIN_WIDTH);
  const scale = width ? width / base : 1;

  return (
    <div ref={box} className={cn('relative aspect-[4/5] overflow-hidden', ig ? 'bg-panel' : 'bg-black')}>
      {!loaded && <div className="absolute inset-0 grid place-items-center text-muted" aria-hidden><Icon width={26} height={26} className="animate-pulse" /></div>}
      {active && width > 0 && (
        <iframe
          src={embedUrl} title={`${alt} — ${ig ? 'Instagram' : 'TikTok'}`} loading="lazy" scrolling="no" allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share" onLoad={() => setLoaded(true)}
          className={cn('absolute left-0 border-0 transition-opacity duration-500', ig ? 'origin-top-left bg-white' : 'top-0 h-full w-full bg-black', loaded ? 'opacity-100' : 'opacity-0')}
          style={ig ? { width: base, height: base * 1.25 + IG_EMBED_HEADER, top: -IG_EMBED_HEADER * scale, transform: `scale(${scale})` } : undefined}
        />
      )}
      {/* Instagram makes a photo one big link to itself. A photo has nothing to play, so a clear layer swallows the click. */}
      {still && <div className="absolute inset-0" aria-hidden />}
      {ig && (
        <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 bg-surface/90 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-ink">
          <Icon width={12} height={12} /> {label}
        </span>
      )}
    </div>
  );
}
