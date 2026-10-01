import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ product_ids: [] });
  const sb = await createSupabaseServer();
  const { data } = await sb.from('wishlist_items').select('product_id').order('created_at', { ascending: false });
  return NextResponse.json({ product_ids: (data ?? []).map((r) => r.product_id) });
}

const Body = z.union([
  z.object({ action: z.enum(['add', 'remove']), product_id: z.uuid(), notify_restock: z.boolean().optional() }),
  z.object({ action: z.literal('merge'), product_ids: z.array(z.uuid()).max(100) }),
]);

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to save your wishlist' }, { status: 401 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const sb = await createSupabaseServer(); // RLS: users can only touch their own rows
  const b = p.data;
  if (b.action === 'merge') {
    if (b.product_ids.length) await sb.from('wishlist_items').upsert(b.product_ids.map((id) => ({ user_id: user.id, product_id: id })), { onConflict: 'user_id,product_id', ignoreDuplicates: true });
  } else if (b.action === 'add') {
    const { data: prod } = await sb.from('products').select('price').eq('id', b.product_id).maybeSingle();
    await sb.from('wishlist_items').upsert({ user_id: user.id, product_id: b.product_id, price_at_add: prod?.price ?? null, notify_restock: b.notify_restock ?? false }, { onConflict: 'user_id,product_id' });
  } else {
    await sb.from('wishlist_items').delete().eq('product_id', b.product_id);
  }
  return NextResponse.json({ ok: true });
}
