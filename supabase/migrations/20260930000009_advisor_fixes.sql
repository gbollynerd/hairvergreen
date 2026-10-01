-- HairverGreen · 0009 · Database advisor fixes
-- Pin search_path on helper/trigger functions.
alter function public.set_updated_at() set search_path = public, pg_catalog;
alter function public.slugify(text) set search_path = public, extensions, pg_catalog;
alter function public.variant_available(public.product_variants) set search_path = public, pg_catalog;
alter function public.products_search_trigger() set search_path = public, extensions, pg_catalog;
alter function public.variants_search_trigger() set search_path = public, extensions, pg_catalog;

-- Trigger functions are never called through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.refresh_product_rating() from public, anon, authenticated;

-- is_staff(uid) is only needed server-side; RLS uses has_permission(), which checks the caller's own id.
revoke execute on function public.is_staff(uuid) from public, anon, authenticated;
grant execute on function public.is_staff(uuid) to service_role;
