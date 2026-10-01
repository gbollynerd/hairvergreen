'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import { useStore } from '@/components/store/store-provider';
import { Dialog } from '@/components/ui/dialog';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/store/price';
import { track } from '@/lib/analytics-client';
import type { ProductCardData } from '@/lib/types';

const RECENT = 'hg_recent_searches';

export function SearchOverlay({ popular }: { popular: string[] }) {
  const { searchOpen, setSearchOpen } = useStore();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ products: ProductCardData[]; categories: { name: string; slug: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const router = useRouter();
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => { if (searchOpen) try { setRecent(JSON.parse(localStorage.getItem(RECENT) || '[]')); } catch {} }, [searchOpen]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      ctrl.current?.abort(); ctrl.current = new AbortController();
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.current.signal });
        setResults(await r.json());
      } catch { /* aborted */ } finally { setLoading(false); }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const close = () => { setSearchOpen(false); setQ(''); setResults(null); };
  const go = (term: string) => {
    const t = term.trim(); if (!t) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    try { localStorage.setItem(RECENT, JSON.stringify(next)); } catch {}
    track('search', { search_term: t });
    close(); router.push(`/search?q=${encodeURIComponent(t)}`);
  };

  return (
    <Dialog open={searchOpen} onClose={close} label="Search Hairver Green" variant="full" hideClose className="bg-bg">
      <div className="container-x pt-6 md:pt-10">
        <form onSubmit={(e) => { e.preventDefault(); go(q); }} role="search" className="flex items-center gap-3 border-b border-ink/70 pb-3">
          <Search size={22} strokeWidth={1.2} aria-hidden />
          <label htmlFor="site-search" className="sr-only">Search Hairver Green</label>
          <input id="site-search" data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Hairver Green"
            className="w-full bg-transparent font-display text-[28px] outline-none placeholder:text-muted/60 md:text-[42px]" autoComplete="off" enterKeyHint="search" />
          <button type="button" onClick={close} className="grid h-11 w-11 shrink-0 place-items-center" aria-label="Close search"><X size={22} strokeWidth={1.3} /></button>
        </form>

        {!results && (
          <div className="grid gap-10 py-10 md:grid-cols-2">
            <div>
              <p className="eyebrow mb-4">Popular searches</p>
              <div className="flex flex-wrap gap-2">{popular.map((p) => <button key={p} type="button" onClick={() => go(p)} className="chip">{p}</button>)}</div>
            </div>
            {recent.length > 0 && (
              <div>
                <div className="mb-4 flex items-center justify-between"><p className="eyebrow">Recent</p>
                  <button type="button" className="text-[12px] text-muted underline" onClick={() => { setRecent([]); try { localStorage.removeItem(RECENT); } catch {} }}>Clear</button></div>
                <ul className="space-y-2">{recent.map((r) => <li key={r}><button type="button" onClick={() => go(r)} className="text-[16px] hover:text-accent-strong">{r}</button></li>)}</ul>
              </div>
            )}
          </div>
        )}

        {results && (
          <div className="py-8" aria-live="polite">
            {loading && <p className="text-muted">Searching…</p>}
            {results.categories.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">{results.categories.map((c) => <Link key={c.slug} href={`/shop?category=${c.slug}`} onClick={close} className="chip">{c.name}</Link>)}</div>
            )}
            {results.products.length === 0 && !loading ? (
              <div className="py-6">
                <p className="font-display text-2xl">No results for “{q}”.</p>
                <p className="mt-2 text-muted">Try a texture or length — for example:</p>
                <div className="mt-4 flex flex-wrap gap-2">{popular.map((p) => <button key={p} type="button" onClick={() => go(p)} className="chip">{p}</button>)}</div>
              </div>
            ) : (
              <>
                <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {results.products.map((p) => (
                    <li key={p.id}>
                      <Link href={`/products/${p.slug}`} onClick={close} className="group block">
                        <div className="relative aspect-[4/5] overflow-hidden bg-panel"><Media src={p.images[0]?.url} alt={p.name} fill sizes="25vw" className="zoom-on-hover" /></div>
                        <p className="mt-2 font-display text-[17px] leading-snug">{p.name}</p>
                        <Price amount={p.price_min} compareAt={p.compare_at} from={p.price_max > p.price_min} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {results.products.length > 0 && (
                  <button type="button" onClick={() => go(q)} className="btn btn-outline mt-8">See all results <ArrowRight size={14} /></button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
