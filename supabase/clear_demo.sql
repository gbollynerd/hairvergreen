-- HairverGreen · Clear demo data before launch
-- Run in Supabase → SQL Editor once you have added your real content.
-- Read each block first. Everything here is permanent.

begin;

-- 1. Test orders, payments, carts and analytics from pre-launch testing
delete from public.refunds;
delete from public.return_requests;
delete from public.payments;
delete from public.order_events;
delete from public.order_items;
delete from public.orders;
delete from public.cart_items;
delete from public.carts;
delete from public.analytics_events;
delete from public.webhook_events;
alter sequence if exists public.order_number_seq restart with 10001;

-- 2. Sample reviews, demo journal posts and demo social posts
delete from public.reviews where author_name = 'Sample review';
delete from public.blog_posts where 'demo' = any(tags);
delete from public.social_posts where caption like 'Demo post%';

commit;

-- 3. OPTIONAL — remove all demo products and their artwork.
--    Only run this after you have created your real products.
-- begin;
-- delete from public.products where id in (select product_id from public.product_media pm join public.media m on m.id = pm.media_id where 'demo' = any(m.tags));
-- delete from public.media where 'demo' = any(tags);
-- commit;
