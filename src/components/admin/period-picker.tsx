'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const OPTIONS: [string, string][] = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['ytd', 'Year to date'], ['12m', '12 months']];

export function PeriodPicker() {
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams();
  const cur = sp.get('range') ?? '30d';
  const go = (p: URLSearchParams) => router.push(`${path}?${p.toString()}`);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
      {OPTIONS.map(([k, l]) => (
        <button key={k} type="button" aria-pressed={cur === k} onClick={() => { const p = new URLSearchParams(sp.toString()); p.set('range', k); p.delete('from'); p.delete('to'); go(p); }}
          className="chip !min-h-[34px] text-[12px]">{l}</button>
      ))}
      <form className="flex w-full flex-wrap items-center gap-1 sm:w-auto" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const p = new URLSearchParams(sp.toString()); p.set('range', 'custom'); p.set('from', String(fd.get('from'))); p.set('to', String(fd.get('to'))); go(p); }}>
        <label className="sr-only" htmlFor="pf">From</label><input id="pf" name="from" type="date" required defaultValue={sp.get('from') ?? ''} className="input !min-h-[34px] !w-auto min-w-0 flex-1 !py-0 !text-[12px] sm:flex-none" />
        <label className="sr-only" htmlFor="pt">To</label><input id="pt" name="to" type="date" required defaultValue={sp.get('to') ?? ''} className="input !min-h-[34px] !w-auto min-w-0 flex-1 !py-0 !text-[12px] sm:flex-none" />
        <button className="btn btn-outline btn-sm !min-h-[34px]">Apply</button>
      </form>
    </div>
  );
}
