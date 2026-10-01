'use client';
import { useState } from 'react';

export function ContactForm() {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState('');
  if (state === 'done') return <div className="bg-panel p-10"><p className="font-display text-[28px]">Thank you.</p><p className="mt-2 text-muted">Your message is with our team — we&apos;ll reply by email shortly.</p></div>;
  return (
    <form className="grid gap-5" onSubmit={async (e) => {
      e.preventDefault(); setState('busy'); setErr('');
      const body = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      Object.keys(body).forEach((k) => { if (!body[k]) delete body[k]; });
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) setState('done'); else { setState('idle'); setErr((await r.json()).error ?? 'Something went wrong'); }
    }}>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="field"><span className="label">Name *</span><input name="name" required className="input" autoComplete="name" /></label>
        <label className="field"><span className="label">Email *</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
        <label className="field"><span className="label">Phone</span><input name="phone" className="input" autoComplete="tel" /></label>
        <label className="field"><span className="label">Order number</span><input name="order_number" className="input" placeholder="HG10001" /></label>
      </div>
      <label className="field"><span className="label">Subject</span><input name="subject" className="input" /></label>
      <label className="field"><span className="label">Message *</span><textarea name="message" required minLength={5} className="input min-h-[160px]" /></label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {err && <p className="text-[13px] text-sale" role="alert">{err}</p>}
      <button type="submit" disabled={state === 'busy'} className="btn btn-primary justify-self-start">{state === 'busy' ? 'Sending…' : 'Send message'}</button>
    </form>
  );
}
