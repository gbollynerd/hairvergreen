'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Hit = { group: string; title: string; sub?: string; href: string };
export type Destination = { label: string; href: string; group: string; keywords?: string };

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s#-]/g, '');

/** Admin-wide search: jump to any admin screen, or find orders, products, customers and more. Opens with ⌘K / Ctrl+K or "/". */
export function SearchPalette({ destinations }: { destinations: Destination[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => { setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)); }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === '/' && !typing && !open) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => { if (open) { setTimeout(() => input.current?.focus(), 30); } else { setQ(''); setHits([]); setActive(0); } }, [open]);

  // Records from the server (debounced)
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const d = await r.json();
        setHits(Array.isArray(d.hits) ? d.hits : []);
      } catch { /* aborted or offline */ }
      setLoading(false);
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  // Admin screens matching the text (instant, no network)
  const pages = useMemo<Hit[]>(() => {
    const term = norm(q.trim());
    if (!term) return destinations.slice(0, 8).map((d) => ({ group: 'Go to', title: d.label, sub: d.group, href: d.href }));
    const words = term.split(/\s+/);
    return destinations
      .filter((d) => { const hay = norm(`${d.label} ${d.group} ${d.keywords ?? ''}`); return words.every((w) => hay.includes(w)); })
      .slice(0, 6).map((d) => ({ group: 'Go to', title: d.label, sub: d.group, href: d.href }));
  }, [q, destinations]);

  const all = useMemo(() => [...pages, ...hits], [pages, hits]);
  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const go = (h?: Hit) => { if (!h) return; setOpen(false); router.push(h.href); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(all.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(all[active]); }
  };

  let lastGroup = '';
  const term = q.trim();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Search admin"
        className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-line bg-bg/60 px-3 text-left text-[13px] text-muted hover:border-primary sm:max-w-sm">
        <Search size={15} className="shrink-0" />
        <span className="truncate">Search orders, products, customers…</span>
        <kbd className="ml-auto hidden shrink-0 border border-line bg-surface px-1.5 text-[11px] sm:inline">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} label="Search admin" variant="modal" hideClose className="!max-w-2xl !overflow-hidden !p-0 mt-[6vh] self-start sm:mt-[12vh]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-muted" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} placeholder="Order number, customer, email, product, SKU, page…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none" aria-label="Search" role="combobox" aria-expanded aria-controls="admin-search-results" aria-activedescendant={all[active] ? `ash-${active}` : undefined} />
          {loading && <Loader2 size={16} className="animate-spin text-muted" aria-label="Searching" />}
          <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-muted underline">Esc</button>
        </div>
        <div ref={list} id="admin-search-results" role="listbox" className="max-h-[min(60vh,520px)] overflow-y-auto py-2">
          {all.map((h, i) => {
            const header = h.group !== lastGroup ? (lastGroup = h.group) : null;
            return (
              <div key={`${h.href}-${i}`}>
                {header && <p className="px-4 pb-1 pt-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted">{header}</p>}
                <button type="button" id={`ash-${i}`} data-i={i} role="option" aria-selected={i === active}
                  onMouseMove={() => setActive(i)} onClick={() => go(h)}
                  className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left', i === active && 'bg-panel')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px]">{h.title}</span>
                    {h.sub && <span className="block truncate text-[12px] text-muted">{h.sub}</span>}
                  </span>
                  {i === active && <CornerDownLeft size={14} className="shrink-0 text-muted" aria-hidden />}
                </button>
              </div>
            );
          })}
          {term.length >= 2 && !loading && hits.length === 0 && pages.length === 0 && (
            <p className="px-4 py-10 text-center text-[14px] text-muted">Nothing found for “{term}”.</p>
          )}
          {term.length === 1 && <p className="px-4 py-3 text-[12px] text-muted">Keep typing to search records…</p>}
        </div>
        <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-muted sm:flex">
          <span>↑ ↓ to move</span><span>Enter to open</span><span>Esc to close</span><span className="ml-auto">Press / anywhere to search</span>
        </div>
      </Dialog>
    </>
  );
}
