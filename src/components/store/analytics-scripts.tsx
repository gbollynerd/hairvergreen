'use client';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics-client';

const ID = /^[A-Za-z0-9-_]+$/;

const KEY = 'hg_consent';
function readConsent(): 'accepted' | 'declined' | null {
  try { const v = localStorage.getItem(KEY); return v === 'accepted' || v === 'declined' ? v : null; } catch { return null; }
}

/** Third-party pixels load only after the visitor accepts marketing cookies. First-party analytics are cookieless. */
export function AnalyticsScripts({ ga4, meta, tiktok }: { ga4?: string; meta?: string; tiktok?: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const hasPixels = !!(ga4 || meta || tiktok);
  const [consent, setConsent] = useState<'accepted' | 'declined' | null | undefined>(undefined);
  useEffect(() => { setConsent(readConsent()); }, []);
  const decide = (v: 'accepted' | 'declined') => { try { localStorage.setItem(KEY, v); } catch {} setConsent(v); };
  const allowed = consent === 'accepted';
  useEffect(() => {
    try {
      const utm = new URLSearchParams([...search.entries()].filter(([k]) => k.startsWith('utm_') || k === 'gclid' || k === 'fbclid' || k === 'ttclid'));
      if ([...utm.keys()].length) sessionStorage.setItem('hg_utm', utm.toString());
    } catch {}
    track('page_view', {});
    window.fbq?.('track', 'PageView');
    window.ttq?.page();
    window.gtag?.('event', 'page_view', { page_path: pathname });
  }, [pathname, search, allowed]);
  return (
    <>
      {hasPixels && consent === null && (
        <div role="region" aria-label="Cookie preferences" className="fixed inset-x-3 bottom-20 z-[70] mx-auto max-w-xl border border-line bg-surface p-5 text-[13px] shadow-xl md:bottom-5">
          <p>We use cookies to measure our marketing and show you relevant ads. You can say no — the store works the same either way. See our <Link href="/policies/cookie-policy" className="underline">cookie policy</Link>.</p>
          <div className="mt-4 flex gap-2"><button type="button" onClick={() => decide('accepted')} className="btn btn-primary btn-sm">Accept</button><button type="button" onClick={() => decide('declined')} className="btn btn-outline btn-sm">Decline</button></div>
        </div>
      )}
      {allowed && ga4 && ID.test(ga4) && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga4}',{send_page_view:false});`}</Script>
        </>
      )}
      {allowed && meta && ID.test(meta) && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${meta}');`}</Script>
      )}
      {allowed && tiktok && ID.test(tiktok) && (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktok}');}(window,document,'ttq');`}</Script>
      )}
    </>
  );
}
