import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Badge, FilterBar, FilterSelect, FilterInput, Pagination, EmptyState } from '@/components/admin/ui';
import { ActionForm, Submit } from '@/components/admin/client';
import { Stars } from '@/components/ui/stars';
import { formatDateTime } from '@/lib/utils';
import { moderateReview, bulkModerate } from './actions';

const PER = 25;
const TONE: Record<string, string> = { pending: 'gold', approved: 'green', rejected: 'red', hidden: 'gray' };

export default async function Reviews({ searchParams }: PageProps<'/admin/reviews'>) {
  await requireStaffPage('reviews.moderate');
  const sp = await searchParams;
  const status = typeof sp.status === 'string' ? sp.status : 'pending';
  const rating = typeof sp.rating === 'string' ? sp.rating : '';
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const page = Math.max(1, Number(sp.page) || 1);
  const db = supabaseAdmin();
  let query = db.from('reviews').select('*, product:product_id (name, slug)', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PER, page * PER - 1);
  if (status && status !== 'all') query = query.eq('status', status);
  if (rating) query = query.eq('rating', Number(rating));
  if (q) {
    const safe = q.replace(/[%,()]/g, ' ');
    query = query.or(`author_name.ilike.%${safe}%,body.ilike.%${safe}%,title.ilike.%${safe}%`);
  }
  const [{ data: reviews, count }, { data: counts }] = await Promise.all([query, db.from('reviews').select('status')]);
  const tally = (counts ?? []).reduce<Record<string, number>>((a, r: any) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
  const href = (p: number) => `/admin/reviews?${new URLSearchParams({ status, rating, q, page: String(p) })}`;

  return (
    <>
      <PageHeader title="Reviews" description="Approve reviews before they appear on the storefront. Respond publicly, feature the best ones on the homepage, or hide anything inappropriate." />
      <div className="mb-5 flex flex-wrap gap-2 text-[13px]">
        {['pending', 'approved', 'rejected', 'hidden', 'all'].map((s) => (
          <Link key={s} href={`/admin/reviews?status=${s}`} className={`border px-3 py-1.5 ${status === s ? 'border-primary bg-primary text-primary-contrast' : 'border-line bg-surface'}`}>
            {s[0].toUpperCase() + s.slice(1)}{s !== 'all' && ` (${tally[s] ?? 0})`}
          </Link>
        ))}
      </div>
      <FilterBar>
        <input type="hidden" name="status" value={status} />
        <FilterInput name="q" label="Search" value={q} placeholder="Name or text" />
        <FilterSelect name="rating" label="Rating" value={rating} options={[['5', '5 stars'], ['4', '4 stars'], ['3', '3 stars'], ['2', '2 stars'], ['1', '1 star']]} />
        <button className="btn btn-outline btn-sm">Filter</button>
      </FilterBar>

      {!reviews?.length ? <EmptyState title="No reviews here" text={status === 'pending' ? 'You are all caught up.' : 'Try a different filter.'} /> : (
        <>
          <ActionForm id="bulk-reviews" action={bulkModerate} className="mb-3 flex flex-wrap items-center gap-2 border border-line bg-surface px-4 py-3 text-[13px]">
            <span id="bulk-label" className="text-muted">With selected:</span>
            <select name="status" className="input !min-h-[36px] !w-auto !py-1 !text-[13px]" aria-labelledby="bulk-label" defaultValue="">
              <option value="" disabled>Choose…</option><option value="approved">Approve</option><option value="rejected">Reject</option><option value="hidden">Hide</option><option value="pending">Back to pending</option><option value="delete">Delete permanently</option>
            </select>
            <Submit variant="outline">Apply</Submit>
            <span className="text-[12px] text-muted">Tick the boxes on each review below.</span>
          </ActionForm>
          <ul className="space-y-3">
            {reviews.map((r: any) => (
              <li key={r.id} className="border border-line bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" name="ids" value={r.id} form="bulk-reviews" className="mt-1 h-4 w-4 accent-[var(--color-primary)]" aria-label={`Select review by ${r.author_name}`} />
                    <span>
                      <span className="flex flex-wrap items-center gap-2"><Stars value={r.rating} /><Badge tone={TONE[r.status]}>{r.status}</Badge>{r.is_verified && <Badge tone="green">Verified buyer</Badge>}{r.is_featured && <Badge tone="purple">Featured</Badge>}</span>
                      <span className="mt-1 block text-[13px]"><strong>{r.author_name}</strong>{r.author_location && ` · ${r.author_location}`} · <span className="text-muted">{formatDateTime(r.created_at)}</span></span>
                      <span className="block text-[12px] text-muted">on <Link href={`/products/${r.product?.slug}`} target="_blank" className="underline">{r.product?.name}</Link>{r.order_id && <> · <Link href={`/admin/orders/${r.order_id}`} className="underline">order</Link></>}</span>
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['approved', 'rejected', 'hidden'] as const).filter((s) => s !== r.status).map((s) => (
                      <ActionForm key={s} action={moderateReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={s} /><Submit variant={s === 'approved' ? 'primary' : 'outline'}>{s === 'approved' ? 'Approve' : s === 'rejected' ? 'Reject' : 'Hide'}</Submit></ActionForm>
                    ))}
                    <ActionForm action={moderateReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="is_featured_present" value="1" />{!r.is_featured && <input type="hidden" name="is_featured" value="on" />}<Submit variant="outline">{r.is_featured ? 'Unfeature' : 'Feature'}</Submit></ActionForm>
                  </div>
                </div>
                {r.title && <p className="mt-3 font-display text-[20px]">{r.title}</p>}
                <p className="mt-1 whitespace-pre-line text-[14px]">{r.body}</p>
                {Array.isArray(r.media) && r.media.length > 0 && (
                  <div className="mt-3 flex gap-2">{r.media.map((m: any, i: number) => <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 overflow-hidden bg-panel">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={m.url} alt="Customer upload" className="h-full w-full object-cover" /></a>)}</div>
                )}
                <details className="mt-4 text-[13px]" open={!!r.admin_response}>
                  <summary className="cursor-pointer text-muted">{r.admin_response ? 'Public response' : 'Write a public response'}</summary>
                  <ActionForm action={moderateReview} className="mt-2 grid gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <textarea name="admin_response" defaultValue={r.admin_response ?? ''} maxLength={2000} className="input !min-h-[70px] !text-[13px]" placeholder="Thank you for your review…" aria-label="Public response" />
                    <div><Submit variant="outline">Save response</Submit></div>
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
          <Pagination page={page} total={count ?? 0} perPage={PER} href={href} />
        </>
      )}
    </>
  );
}

