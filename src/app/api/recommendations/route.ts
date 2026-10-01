import { NextResponse, type NextRequest } from 'next/server';
import { getRelated, toCard, getCatalog } from '@/lib/data/catalog';
import { isUuid } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('ids') || '').split(',').filter(isUuid).slice(0, 6);
  const seen = new Set(ids);
  const out: ReturnType<typeof toCard>[] = [];
  for (const id of ids) {
    const r = await getRelated(id);
    for (const p of [...r.boughtTogether, ...r.crossSells, ...r.related]) {
      if (!seen.has(p.id) && p.in_stock) { seen.add(p.id); out.push(toCard(p)); }
    }
  }
  if (out.length < 4) {
    const { entries } = await getCatalog();
    for (const e of [...entries].sort((a, b) => b.sales_count - a.sales_count)) {
      if (!seen.has(e.id) && e.in_stock) { seen.add(e.id); out.push(toCard(e)); }
      if (out.length >= 6) break;
    }
  }
  return NextResponse.json({ products: out.slice(0, 6) }, { headers: { 'cache-control': 'public, s-maxage=120' } });
}
