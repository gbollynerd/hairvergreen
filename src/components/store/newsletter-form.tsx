'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { track } from '@/lib/analytics-client';
import { cn } from '@/lib/utils';

export function NewsletterForm({ source = 'footer', dark, cta = 'Subscribe', onDone }: { source?: string; dark?: boolean; cta?: string; onDone?: () => void }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  if (state === 'done') return <p className={cn('font-display text-[20px]', dark && 'text-primary-contrast')} role="status">Welcome to the list. We&apos;ll be in touch.</p>;
  return (
    <form className="w-full" onSubmit={async (e) => {
      e.preventDefault(); setState('busy');
      const r = await fetch('/api/newsletter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, source }) });
      if (r.ok) { setState('done'); track('newsletter_signup', { source }); onDone?.(); } else { setState('error'); setMsg((await r.json()).error ?? 'Something went wrong'); }
    }}>
      <div className={cn('flex border-b', dark ? 'border-primary-contrast/60' : 'border-ink/60')}>
        <label htmlFor={`nl-${source}`} className="sr-only">Email address</label>
        <input id={`nl-${source}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" autoComplete="email"
          className={cn('min-h-[48px] flex-1 bg-transparent text-[15px] outline-none', dark ? 'text-primary-contrast placeholder:text-primary-contrast/60' : 'placeholder:text-muted')} />
        <button type="submit" disabled={state === 'busy'} className={cn('flex items-center gap-2 caps', dark && 'text-primary-contrast')}>{cta} <ArrowRight size={14} /></button>
      </div>
      {state === 'error' && <p className="mt-2 text-[13px] text-sale" role="alert">{msg}</p>}
      <p className={cn('mt-3 text-[11px]', dark ? 'text-primary-contrast/60' : 'text-muted')}>By subscribing you agree to receive marketing emails. Unsubscribe at any time.</p>
    </form>
  );
}
