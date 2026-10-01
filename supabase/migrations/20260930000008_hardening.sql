-- HairverGreen · 0008 · Hardening: keep permission lookups server-side only.
revoke execute on function public.user_permissions(uuid) from public, anon, authenticated;
grant execute on function public.user_permissions(uuid) to service_role;
revoke execute on function public.rebuild_product_search(uuid) from public, anon, authenticated;
grant execute on function public.rebuild_product_search(uuid) to service_role;

-- Guest order access: a secret token included in confirmation links/emails.
alter table public.orders add column if not exists access_token uuid not null default gen_random_uuid();
create index if not exists orders_number_idx on public.orders (order_number);
