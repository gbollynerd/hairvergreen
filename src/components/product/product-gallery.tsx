'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Expand, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProductMedia } from '@/lib/types';
import { Media, Video } from '@/components/ui/media';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function ProductGallery({ media, selection, name, compact }: { media: ProductMedia[]; selection: Record<string, string>; name: string; compact?: boolean }) {
  // Show images tagged for the current selection (e.g. texture) first; untagged images are shared.
  const items = useMemo(() => {
    const matches = (m: ProductMedia) => Object.entries(m.option_match || {}).every(([k, v]) => selection[k] === v);
    const tagged = media.filter((m) => Object.keys(m.option_match || {}).length > 0);
    const hit = tagged.filter(matches);
    const shared = media.filter((m) => !Object.keys(m.option_match || {}).length);
    const list = hit.length ? [...hit, ...shared] : media;
    return list.length ? list : media;
  }, [media, selection]);
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const key = items.map((i) => i.id).join();

  useEffect(() => { setIdx(0); track.current?.scrollTo({ left: 0 }); }, [key]);

  const goTo = (i: number) => {
    setIdx(i);
    const el = track.current;
    if (el) el.scrollTo({ left: el.clientWidth * i, behavior: 'smooth' });
  };
  const onScroll = () => {
    const el = track.current; if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(i);
  };

  if (!items.length) return <div className="aspect-[4/5] bg-panel" />;

  return (
    <div className={cn('grid gap-3', !compact && 'md:grid-cols-[76px_1fr]')}>
      {!compact && items.length > 1 && (
        <div className="order-2 flex gap-2 overflow-x-auto scrollbar-none md:order-1 md:flex-col md:overflow-visible" role="tablist" aria-label="Product images">
          {items.map((m, i) => (
            <button key={m.id} type="button" role="tab" aria-selected={i === idx} aria-label={`Image ${i + 1} of ${items.length}`} onClick={() => goTo(i)}
              className={cn('relative aspect-[4/5] w-16 shrink-0 overflow-hidden bg-panel transition-opacity md:w-full', i === idx ? 'ring-1 ring-primary' : 'opacity-70 hover:opacity-100')}>
              <Media src={m.media.url} alt="" fill sizes="80px" />
            </button>
          ))}
        </div>
      )}
      <div className="relative order-1 md:order-2">
        <div ref={track} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none" aria-live="polite">
          {items.map((m, i) => (
            <div key={m.id} className="relative aspect-[4/5] w-full shrink-0 snap-center overflow-hidden bg-panel">
              {m.media.kind === 'video' ? <Video src={m.media.url} /> : (
                <button type="button" className="absolute inset-0 cursor-zoom-in" onClick={() => { setIdx(i); setZoom(true); }} aria-label={`Open image ${i + 1} fullscreen`}>
                  <Media src={m.media.url} alt={m.alt || m.media.alt || name} fill priority={i === 0 && !compact} sizes="(min-width:1024px) 55vw, 100vw" />
                </button>
              )}
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <>
            <button type="button" onClick={() => goTo(Math.max(0, idx - 1))} className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center bg-surface/80 md:grid" aria-label="Previous image"><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => goTo(Math.min(items.length - 1, idx + 1))} className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center bg-surface/80 md:grid" aria-label="Next image"><ChevronRight size={18} /></button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden" aria-hidden>
              {items.map((m, i) => <span key={m.id} className={cn('h-[3px] transition-all', i === idx ? 'w-6 bg-primary' : 'w-3 bg-primary/30')} />)}
            </div>
          </>
        )}
        <button type="button" onClick={() => setZoom(true)} className="absolute right-3 top-3 grid h-10 w-10 place-items-center bg-surface/80" aria-label="View fullscreen"><Expand size={16} strokeWidth={1.4} /></button>
      </div>

      <Dialog open={zoom} onClose={() => setZoom(false)} label={`${name} images`} variant="full" className="bg-surface">
        <ZoomViewer items={items} start={idx} name={name} />
      </Dialog>
    </div>
  );
}

function ZoomViewer({ items, start, name }: { items: ProductMedia[]; start: number; name: string }) {
  const [i, setI] = useState(start);
  const [z, setZ] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const m = items[i];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((x) => Math.min(items.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length]);
  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden" onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`); }}>
        <button type="button" className={cn('absolute inset-0', z ? 'cursor-zoom-out' : 'cursor-zoom-in')} onClick={() => setZ((v) => !v)} aria-label={z ? 'Zoom out' : 'Zoom in'}>
          <div className="absolute inset-0 transition-transform duration-500" style={{ transform: z ? 'scale(2.2)' : 'none', transformOrigin: origin }}>
            {m.media.kind === 'video' ? <Video src={m.media.url} className="object-contain" /> : <Media src={m.media.url} alt={m.alt || m.media.alt || name} fill sizes="100vw" className="!object-contain" />}
          </div>
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-line p-3">
        {items.map((x, n) => (
          <button key={x.id} type="button" onClick={() => { setI(n); setZ(false); }} className={cn('relative h-16 w-12 overflow-hidden bg-panel', n === i ? 'ring-1 ring-primary' : 'opacity-60')} aria-label={`Image ${n + 1}`}>
            <Media src={x.media.url} alt="" fill sizes="48px" />
          </button>
        ))}
      </div>
    </div>
  );
}
