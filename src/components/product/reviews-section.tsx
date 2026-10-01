'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Review } from '@/lib/types';
import { Stars } from '@/components/ui/stars';
import { useStore } from '@/components/store/store-provider';
import { formatDate } from '@/lib/utils';
import { uploadFile } from '@/lib/upload-client';

export function ReviewsSection({ productId, productName, reviews, avg, count }: { productId: string; productName: string; reviews: Review[]; avg: number; count: number }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<number | null>(null);
  const [limit, setLimit] = useState(6);
  const dist = useMemo(() => [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length })), [reviews]);
  const list = reviews.filter((r) => !filter || r.rating === filter);
  return (
    <section id="reviews" className="container-x mt-20 scroll-mt-40 md:mt-28" aria-labelledby="reviews-h">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="eyebrow mb-3">Reviews</p>
          <h2 id="reviews-h" className="display-3">Client reviews</h2>
          {count > 0 ? (
            <>
              <div className="mt-6 flex items-center gap-4"><span className="font-display text-[56px] leading-none">{avg.toFixed(1)}</span><div><Stars value={avg} size={16} /><p className="mt-1 text-[13px] text-muted">{count} review{count === 1 ? '' : 's'}</p></div></div>
              <ul className="mt-6 space-y-2">
                {dist.map(({ n, c }) => (
                  <li key={n}><button type="button" onClick={() => setFilter(filter === n ? null : n)} aria-pressed={filter === n} className="flex w-full items-center gap-3 text-[13px]">
                    <span className="w-8">{n}★</span><span className="h-[3px] flex-1 bg-line"><span className="block h-full bg-accent-strong" style={{ width: `${count ? (c / count) * 100 : 0}%` }} /></span><span className="w-6 text-right text-muted">{c}</span>
                  </button></li>
                ))}
              </ul>
            </>
          ) : <p className="mt-4 text-muted">No reviews yet.</p>}
          <button type="button" onClick={() => setShowForm((v) => !v)} className="btn btn-outline mt-8">Write a review</button>
        </div>
        <div className="lg:col-span-8">
          {showForm && <ReviewForm productId={productId} productName={productName} onDone={() => setShowForm(false)} />}
          <ul className="divide-y divide-line border-y border-line">
            {list.slice(0, limit).map((r) => (
              <li key={r.id} className="py-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Stars value={r.rating} />
                  <span className="text-[12px] text-muted">{formatDate(r.created_at)}</span>
                </div>
                {r.title && <p className="mt-3 font-display text-[21px]">{r.title}</p>}
                <p className="mt-2 text-[15px] leading-7">{r.body}</p>
                {r.media?.length > 0 && (
                  <div className="mt-3 flex gap-2">{r.media.map((m, i) => m.kind === 'video'
                    ? <video key={i} src={m.url} className="h-24 w-24 object-cover" controls preload="none" />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img key={i} src={m.url} alt={`Photo from ${r.author_name}`} className="h-24 w-24 object-cover" loading="lazy" />)}</div>
                )}
                <p className="mt-3 text-[12px] uppercase tracking-[0.14em]">{r.author_name}{r.author_location && <span className="text-muted"> · {r.author_location}</span>}{r.is_verified && <span className="ml-2 text-accent-strong">✓ Verified purchase</span>}</p>
                {r.admin_response && <div className="mt-4 border-l-2 border-accent pl-4 text-[14px] text-muted"><p className="text-[11px] uppercase tracking-[0.16em] text-ink">Hairver Green replied</p><p className="mt-1">{r.admin_response}</p></div>}
              </li>
            ))}
          </ul>
          {list.length > limit && <button type="button" onClick={() => setLimit((l) => l + 6)} className="btn btn-outline mt-8">Show more reviews</button>}
        </div>
      </div>
    </section>
  );
}

function ReviewForm({ productId, productName, onDone }: { productId: string; productName: string; onDone: () => void }) {
  const { user, toast } = useStore();
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  if (!user) return <div className="mb-8 bg-panel p-6 text-[15px]">Please <Link href={`/login?next=${encodeURIComponent(location.pathname + '#reviews')}`} className="underline">sign in</Link> to review {productName}. Reviews are open to verified customers.</div>;
  return (
    <form className="mb-10 grid gap-4 bg-surface p-6 ring-1 ring-line" onSubmit={async (e) => {
      e.preventDefault();
      if (!rating) { toast('Please choose a star rating', 'error'); return; }
      setBusy(true);
      const fd = new FormData(e.currentTarget);
      try {
        const media = [];
        for (const f of files.slice(0, 4)) { const u = await uploadFile('review', f); if (u.publicUrl) media.push({ url: u.publicUrl, kind: f.type.startsWith('video') ? 'video' : 'image' }); }
        const r = await fetch('/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
          product_id: productId, rating, title: fd.get('title'), body: fd.get('body'), author_name: fd.get('author_name'), author_location: fd.get('author_location') || undefined, media }) });
        const d = await r.json();
        if (!r.ok) toast(d.error || 'Could not submit your review', 'error');
        else { toast('Thank you — your review will appear once approved.'); onDone(); }
      } finally { setBusy(false); }
    }}>
      <fieldset>
        <legend className="label mb-2">Your rating</legend>
        <div className="flex gap-1" role="radiogroup">{[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)} className={`text-[28px] leading-none ${n <= rating ? 'text-accent-strong' : 'text-line'}`}>★</button>
        ))}</div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field"><span className="label">Name shown</span><input name="author_name" required defaultValue={user.email.split('@')[0]} className="input" maxLength={80} /></label>
        <label className="field"><span className="label">Location (optional)</span><input name="author_location" className="input" maxLength={80} placeholder="Lagos" /></label>
      </div>
      <label className="field"><span className="label">Title</span><input name="title" className="input" maxLength={120} /></label>
      <label className="field"><span className="label">Your review</span><textarea name="body" required minLength={10} maxLength={3000} className="input" /></label>
      <label className="field"><span className="label">Photos or video (optional)</span><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="text-[13px]" /></label>
      <button type="submit" disabled={busy} className="btn btn-primary justify-self-start">{busy ? 'Submitting…' : 'Submit review'}</button>
    </form>
  );
}
