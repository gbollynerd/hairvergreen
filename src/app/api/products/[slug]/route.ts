import { NextResponse } from 'next/server';
import { getProduct, getAttrMap } from '@/lib/data/catalog';

export async function GET(_req: Request, ctx: RouteContext<'/api/products/[slug]'>) {
  const { slug } = await ctx.params;
  const product = await getProduct(slug);
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Never expose cost prices to the browser
  const safe = { ...product, variants: product.variants.map(({ cost_price: _c, ...v }) => v) };
  return NextResponse.json({ product: safe, attrs: await getAttrMap() }, { headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
