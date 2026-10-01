'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Copy, Check } from 'lucide-react';
import type { Popup } from '@/lib/types';
import { Dialog } from '@/components/ui/dialog';
import { Media } from '@/components/ui/media';
import { NewsletterForm } from './newsletter-form';
import { useStore } from './store-provider';
import { cn } from '@/lib/utils';

const seenKey = (id: string) => `hg_popup_${id}`;
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

function pathMatches(patterns: string[], path: string) {
  if (!patterns.length) return true;
  return patterns.some((p) => p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : p === path);
}

export function PopupManager({ popups }: { popups: Popup[] }) {
  const pathname = usePathname();
  const { user, cartOpen, searchOpen, menuOpen } = useStore();
  const [active, setActive] = useState<Popup | null>(null);

  useEffect(() => {
    if (pathname.startsWith('/checkout') || pathname.startsWith('/account') || pathname.startsWith('/admin')) return;
    const visits = Number(get('hg_visits') || '0');
    if (!sessionStorage.getItem('hg_visit_counted')) { set('hg_visits', String(visits + 1)); sessionStorage.setItem('hg_visit_counted', '1'); }
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const candidate = popups.find((p) => {
      if (!pathMatches(p.page_paths, pathname)) return false;
      if (!p.devices.includes(mobile ? 'mobile' : 'desktop')) return false;
      if (p.audience === 'new_visitors' && visits > 1) return false;
      if (p.audience === 'returning_visitors' && visits <= 1) return false;
      if (p.audience === 'guests' && user) return false;
      if (p.audience === 'customers' && !user) return false;
      const last = Number(get(seenKey(p.id)) || 0);
      return Date.now() - last > p.frequency_days * 86400_000;
    });
    if (!candidate) return;
    let fired = false;
    const fire = () => { if (fired) return; fired = true; set(seenKey(candidate.id), String(Date.now())); setActive(candidate); cleanup(); };
    const timers: ReturnType<typeof setTimeout>[] = [];
    const onScroll = () => { const pct = (window.scrollY / Math.max(1, document.body.scrollHeight - innerHeight)) * 100; if (pct >= candidate.scroll_percent) fire(); };
    const onLeave = (e: MouseEvent) => { if (e.clientY <= 0) fire(); };
    const cleanup = () => { timers.forEach(clearTimeout); window.removeEventListener('scroll', onScroll); document.removeEventListener('mouseout', onLeave); };
    if (candidate.trigger === 'page_load') timers.push(setTimeout(fire, 800));
    if (candidate.trigger === 'delay') timers.push(setTimeout(fire, Math.max(2, candidate.delay_seconds) * 1000));
    if (candidate.trigger === 'scroll') window.addEventListener('scroll', onScroll, { passive: true });
    if (candidate.trigger === 'exit_intent') { if (mobile) timers.push(setTimeout(fire, 25000)); else document.addEventListener('mouseout', onLeave); }
    return cleanup;
  }, [pathname, popups, user]);

  const [unlocked, setUnlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!active || cartOpen || searchOpen || menuOpen) return null;
  const dark = active.style?.background === 'emerald';
  const img = active.image?.url;
  return (
    <Dialog open onClose={() => setActive(null)} label={active.title} variant="modal" className={cn('!max-w-[760px] !p-0', dark && '!bg-primary !text-primary-contrast')}>
      <div className={cn('grid', img && active.style?.layout !== 'center' ? 'md:grid-cols-2' : '')}>
        {img && active.style?.layout !== 'center' && <div className="relative hidden min-h-[380px] bg-panel md:block"><Media src={img} alt="" fill sizes="380px" /></div>}
        <div className="flex flex-col justify-center p-8 md:p-10">
          <p className={cn('eyebrow', dark && '!text-accent')}>Hairver Green</p>
          <h2 className="mt-3 font-display text-[34px] leading-tight">{active.title}</h2>
          {active.body && <p className={cn('mt-3 text-[15px]', dark ? 'text-primary-contrast/75' : 'text-muted')}>{active.body}</p>}
          <div className="mt-6">
            {unlocked && active.coupon_code ? (
              <div>
                <p className="text-[13px]">Your code:</p>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(active.coupon_code!); setCopied(true); }} className="mt-2 flex w-full items-center justify-between border border-dashed border-current px-4 py-3 font-display text-[24px] tracking-[0.2em]">
                  {active.coupon_code} {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
                <p className="mt-2 text-[12px] opacity-70">Apply it in your bag at checkout.</p>
              </div>
            ) : active.collect_email ? (
              <NewsletterForm source={`popup:${active.kind}`} dark={dark} cta={active.cta_label || 'Subscribe'} onDone={() => setUnlocked(true)} />
            ) : active.cta_href ? (
              <Link href={active.cta_href} onClick={() => setActive(null)} className={cn('btn', dark ? 'btn-light' : 'btn-primary')}>{active.cta_label || 'Shop now'}</Link>
            ) : null}
          </div>
          <button type="button" onClick={() => setActive(null)} className="mt-5 self-start text-[12px] underline opacity-70">No thanks</button>
        </div>
      </div>
    </Dialog>
  );
}
