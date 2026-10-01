'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Announcement } from '@/lib/types';

export function AnnouncementBar({ items }: { items: Announcement[] }) {
  const [i, setI] = useState(0);
  const [hidden, setHidden] = useState(false);
  useEffect(() => { try { if (sessionStorage.getItem('hg_ann_closed') === '1') setHidden(true); } catch {} }, []);
  useEffect(() => {
    if (items.length < 2) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length || hidden) return null;
  const a = items[i];
  const style = { background: a.background || 'var(--hg-primary)', color: a.text_color || 'var(--hg-primary-contrast)' };
  return (
    <div className="relative z-[51] text-center text-[11px] uppercase tracking-[0.22em]" style={style} role="region" aria-label="Announcements">
      <div className="container-x flex min-h-[36px] items-center justify-center py-2" aria-live="polite">
        <p key={a.id} className="animate-fade-in px-8">{a.href ? <Link href={a.href} className="hover:opacity-80">{a.message}</Link> : a.message}</p>
      </div>
      {a.dismissible && (
        <button type="button" onClick={() => { setHidden(true); try { sessionStorage.setItem('hg_ann_closed', '1'); } catch {} }}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center opacity-70 hover:opacity-100" aria-label="Dismiss announcement">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
