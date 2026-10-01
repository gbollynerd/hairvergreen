'use client';
import { useState } from 'react';
import { uploadFile } from '@/lib/upload-client';

export function ConsultationForm({ kind }: { kind: 'consultation' | 'service' | 'custom_unit' }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  if (state === 'done') return <div className="bg-panel p-10"><p className="font-display text-[28px]">Thank you — we&apos;ve got your request.</p><p className="mt-2 text-muted">A member of our team will contact you shortly to confirm a time.</p></div>;
  return (
    <form className="grid gap-5" onSubmit={async (e) => {
      e.preventDefault(); setState('busy'); setErr('');
      const fd = new FormData(e.currentTarget);
      try {
        const reference_media = [];
        for (const f of files.slice(0, 4)) { const u = await uploadFile('consultation', f); reference_media.push({ bucket: u.bucket, path: u.path, name: f.name }); }
        const body = { kind, name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone') || undefined, contact_method: fd.get('contact_method'),
          desired_look: fd.get('desired_look') || undefined, texture: fd.get('texture') || undefined, length: fd.get('length') || undefined,
          budget: fd.get('budget') || undefined, preferred_at: fd.get('preferred_at') || undefined, reference_media, website: fd.get('website') || undefined };
        const r = await fetch('/api/consultations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error((await r.json()).error || 'Something went wrong');
        setState('done');
      } catch (x) { setErr(x instanceof Error ? x.message : 'Something went wrong'); setState('idle'); }
    }}>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="field"><span className="label">Name *</span><input name="name" required className="input" autoComplete="name" /></label>
        <label className="field"><span className="label">Email *</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
        <label className="field"><span className="label">Phone</span><input name="phone" className="input" autoComplete="tel" /></label>
        <label className="field"><span className="label">Preferred contact</span><select name="contact_method" className="input"><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="email">Email</option><option value="instagram">Instagram DM</option></select></label>
      </div>
      <label className="field"><span className="label">Describe the look you want</span><textarea name="desired_look" className="input" maxLength={2000} /></label>
      <div className="grid gap-5 md:grid-cols-3">
        <label className="field"><span className="label">Texture</span><select name="texture" className="input"><option value="">Not sure</option>{['Straight', 'Body Wave', 'Loose Wave', 'Deep Wave', 'Curly', 'Kinky'].map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="field"><span className="label">Length</span><select name="length" className="input"><option value="">Not sure</option>{[10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30].map((l) => <option key={l}>{l}&quot;</option>)}</select></label>
        <label className="field"><span className="label">Budget</span><select name="budget" className="input"><option value="">Prefer not to say</option><option>Under ₦300,000</option><option>₦300,000 – ₦600,000</option><option>₦600,000 – ₦1,000,000</option><option>Over ₦1,000,000</option></select></label>
      </div>
      <label className="field"><span className="label">Preferred date & time</span><input name="preferred_at" type="datetime-local" className="input" /></label>
      <label className="field"><span className="label">Reference photos (optional)</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="text-[13px]" /></label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {err && <p className="text-[13px] text-sale" role="alert">{err}</p>}
      <button disabled={state === 'busy'} className="btn btn-primary justify-self-start">{state === 'busy' ? 'Sending…' : 'Request consultation'}</button>
    </form>
  );
}
