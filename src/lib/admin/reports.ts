import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type Period = { from: Date; to: Date; bucket: 'day' | 'week' | 'month'; label: string; key: string };

// Periods are computed in Lagos time (UTC+1).
export function parsePeriod(sp: Record<string, string | string[] | undefined>): Period {
  const key = typeof sp.range === 'string' ? sp.range : '30d';
  const now = new Date();
  const lagosMidnight = (d: Date) => { const x = new Date(d.getTime() + 3600_000); x.setUTCHours(0, 0, 0, 0); return new Date(x.getTime() - 3600_000); };
  const to = new Date(lagosMidnight(now).getTime() + 86400_000);
  const days = (n: number) => new Date(to.getTime() - n * 86400_000);
  if (key === 'custom' && typeof sp.from === 'string' && typeof sp.to === 'string') {
    const f = new Date(sp.from + 'T00:00:00+01:00'); const t = new Date(new Date(sp.to + 'T00:00:00+01:00').getTime() + 86400_000);
    if (!isNaN(+f) && !isNaN(+t) && t > f) { const span = (t.getTime() - f.getTime()) / 86400_000; return { from: f, to: t, bucket: span > 120 ? 'month' : span > 45 ? 'week' : 'day', label: `${sp.from} → ${sp.to}`, key }; }
  }
  switch (key) {
    case 'today': return { from: days(1), to, bucket: 'day', label: 'Today', key };
    case '7d': return { from: days(7), to, bucket: 'day', label: 'Last 7 days', key };
    case '90d': return { from: days(90), to, bucket: 'week', label: 'Last 90 days', key };
    case '12m': return { from: days(365), to, bucket: 'month', label: 'Last 12 months', key };
    case 'ytd': { const y = new Date(Date.UTC(now.getUTCFullYear(), 0, 1) - 3600_000); return { from: y, to, bucket: 'month', label: 'Year to date', key }; }
    default: return { from: days(30), to, bucket: 'day', label: 'Last 30 days', key: '30d' };
  }
}

export function previousPeriod(p: Period): Period {
  const span = p.to.getTime() - p.from.getTime();
  return { ...p, from: new Date(p.from.getTime() - span), to: p.from };
}

export type Summary = Record<string, number>;

export async function getReport(p: Period) {
  const db = supabaseAdmin();
  const args = { p_from: p.from.toISOString(), p_to: p.to.toISOString() };
  const prev = previousPeriod(p);
  const [summary, prevSummary, series, top, byCat, byCountry, byChannel, byExpense, funnel] = await Promise.all([
    db.rpc('report_summary', args), db.rpc('report_summary', { p_from: prev.from.toISOString(), p_to: prev.to.toISOString() }),
    db.rpc('report_series', { ...args, p_bucket: p.bucket }), db.rpc('report_top_products', { ...args, p_limit: 8 }),
    db.rpc('report_breakdown', { ...args, p_dim: 'category' }), db.rpc('report_breakdown', { ...args, p_dim: 'country' }),
    db.rpc('report_breakdown', { ...args, p_dim: 'channel' }), db.rpc('report_breakdown', { ...args, p_dim: 'expense' }),
    db.rpc('report_funnel', args),
  ]);
  return {
    summary: (summary.data ?? {}) as Summary, prev: (prevSummary.data ?? {}) as Summary,
    series: (series.data ?? []) as { bucket: string; revenue: number; orders: number; profit: number; refunds: number; new_customers: number }[],
    top: (top.data ?? []) as { product_id: string; name: string; units: number; revenue: number; profit: number }[],
    byCategory: (byCat.data ?? []) as { label: string; orders: number; revenue: number }[],
    byCountry: (byCountry.data ?? []) as { label: string; orders: number; revenue: number }[],
    byChannel: (byChannel.data ?? []) as { label: string; orders: number; revenue: number }[],
    byExpense: (byExpense.data ?? []) as { label: string; orders: number; revenue: number }[],
    funnel: (funnel.data ?? []) as { step: string; sessions: number }[],
  };
}

export function delta(cur: number, prev: number) {
  if (!prev) return cur ? { text: 'New this period', tone: 'up' as const } : { text: 'No change', tone: 'neutral' as const };
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return { text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}% vs previous period`, tone: pct >= 0 ? ('up' as const) : ('down' as const) };
}
