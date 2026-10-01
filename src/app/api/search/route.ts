import { NextResponse, type NextRequest } from 'next/server';
import { listProducts, searchProductIds, toCard, getCatalog } from '@/lib/data/catalog';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const rl = await rateLimit('search', 120);
  if (!rl.ok) return NextResponse.json({ products: [] }, { status: 429 });
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ products: [], categories: [] });
  const ids = await searchProductIds(q, 8);
  const { items } = await listProducts({}, ids);
  const { categories } = await getCatalog();
  const ql = q.toLowerCase();
  const cats = categories.filter((c) => c.is_visible && c.name.toLowerCase().includes(ql)).slice(0, 4).map((c) => ({ name: c.name, slug: c.slug, parent_id: c.parent_id }));
  return NextResponse.json({ products: items.slice(0, 8).map(toCard), categories: cats }, { headers: { 'cache-control': 'public, s-maxage=60' } });
}
