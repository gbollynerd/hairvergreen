import { createSupabaseServer } from '@/lib/supabase/server';
import { productsByIds, toCard } from '@/lib/data/catalog';
import { AccountWishlist } from '@/components/account/account-wishlist';

export default async function AccountWishlistPage() {
  const sb = await createSupabaseServer();
  const { data } = await sb.from('wishlist_items').select('product_id, price_at_add, notify_restock, created_at').order('created_at', { ascending: false });
  const rows = data ?? [];
  const products = await productsByIds(rows.map((r) => r.product_id));
  const items = rows.map((r) => ({ ...r, product: products.find((p) => p.id === r.product_id) })).filter((r) => r.product)
    .map((r) => ({ product: toCard(r.product!), price_at_add: r.price_at_add as number | null, notify_restock: r.notify_restock as boolean }));
  return <AccountWishlist items={items} />;
}
