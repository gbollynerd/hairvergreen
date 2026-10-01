import { NextResponse, type NextRequest } from 'next/server';
import { productsBySlugs, productsByIds, toCard } from '@/lib/data/catalog';
import { isUuid } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const slugs = (req.nextUrl.searchParams.get('slugs') || '').split(',').filter((s) => /^[a-z0-9-]{1,120}$/.test(s)).slice(0, 24);
  const ids = (req.nextUrl.searchParams.get('ids') || '').split(',').filter(isUuid).slice(0, 60);
  const list = ids.length ? await productsByIds(ids) : await productsBySlugs(slugs);
  return NextResponse.json({ products: list.map(toCard) }, { headers: { 'cache-control': 'public, s-maxage=60' } });
}
