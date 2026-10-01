-- HairverGreen · 0007 · Row-level security and storage buckets.
-- Model: every table has RLS enabled. The storefront reads public catalogue/content through
-- the anon key under the policies below; customers read/write their own rows. All staff/admin
-- mutations go through server code that checks granular permissions and then uses the
-- service-role key (which bypasses RLS). Nothing privileged is reachable from the browser.
set search_path = public, extensions;

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Public catalogue & content ----------
create policy "public read visible categories" on public.categories for select using (is_visible);
create policy "public read attributes" on public.attribute_values for select using (true);
create policy "public read media" on public.media for select using (true);
create policy "public read active products" on public.products for select
  using (status = 'active' and (publish_at is null or publish_at <= now()));
create policy "public read variants of active products" on public.product_variants for select
  using (is_active and exists (select 1 from public.products p where p.id = product_id
         and p.status = 'active' and (p.publish_at is null or p.publish_at <= now())));
create policy "public read product media" on public.product_media for select
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy "public read product relations" on public.product_relations for select using (true);
create policy "public read collections" on public.collections for select using (is_visible);
create policy "public read collection products" on public.collection_products for select using (true);
create policy "public read bundles" on public.bundles for select using (true);
create policy "public read bundle items" on public.bundle_items for select using (true);
create policy "public read approved reviews" on public.reviews for select using (status = 'approved');
create policy "public read shipping zones" on public.shipping_zones for select using (is_active);
create policy "public read shipping methods" on public.shipping_methods for select using (is_active);
create policy "public read published pages" on public.pages for select using (status = 'published');
create policy "public read sections" on public.page_sections for select
  using (is_visible and exists (select 1 from public.pages pg where pg.id = page_id and pg.status = 'published'));
create policy "public read blog categories" on public.blog_categories for select using (true);
create policy "public read published posts" on public.blog_posts for select
  using (status = 'published' and (published_at is null or published_at <= now()));
create policy "public read menus" on public.menus for select using (true);
create policy "public read active popups" on public.popups for select using (is_active);
create policy "public read active announcements" on public.announcements for select using (is_active);
create policy "public read social posts" on public.social_posts for select using (is_visible);
create policy "public read public settings" on public.settings for select using (is_public);

-- ---------- Customer-owned data ----------
create policy "own profile read" on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "own customer read" on public.customers for select using (user_id = auth.uid());
create policy "own addresses" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own wishlist" on public.wishlist_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own orders" on public.orders for select using (user_id = auth.uid());
create policy "own order items" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "own order public events" on public.order_events for select
  using (not is_internal and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "own returns" on public.return_requests for select using (user_id = auth.uid());
create policy "own reviews" on public.reviews for select using (user_id = auth.uid());
create policy "own consultations" on public.consultations for select using (user_id = auth.uid());
create policy "own refunds" on public.refunds for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 104857600,
    array['image/jpeg','image/png','image/webp','image/avif','image/gif','image/svg+xml','video/mp4','video/webm','video/quicktime']),
  ('customer-uploads', 'customer-uploads', false, 20971520,
    array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime'])
on conflict (id) do nothing;
