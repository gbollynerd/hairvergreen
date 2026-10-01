-- HairverGreen · 0006 · Reporting: sales, profit, customers, funnel.
-- Revenue is recognised on paid_at. Amounts are minor units (kobo).
--   net_sales    = order totals - tax - refunds
--   gross_profit = net_sales - cost of goods (variant cost snapshots) - payment fees
--   net_profit   = gross_profit - recorded business expenses
set search_path = public, extensions;

create or replace view public.customer_stats with (security_invoker = true) as
select c.id as customer_id,
       count(o.id) filter (where o.paid_at is not null) as orders_count,
       coalesce(sum(o.total - o.refunded_total) filter (where o.paid_at is not null), 0)::bigint as total_spent,
       max(o.paid_at) as last_order_at,
       min(o.paid_at) as first_order_at
from public.customers c
left join public.orders o on o.customer_id = c.id
group by c.id;

create or replace function public.report_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  with paid as (
    select * from public.orders
    where paid_at >= p_from and paid_at < p_to
      and payment_status in ('paid','refunded','partially_refunded')
  ),
  ref as (
    select coalesce(sum(amount),0)::bigint amt, count(*) n from public.refunds
    where status = 'processed' and coalesce(processed_at, created_at) >= p_from and coalesce(processed_at, created_at) < p_to
  ),
  exp as (
    select coalesce(sum(amount),0)::bigint amt from public.expenses where spent_on >= p_from::date and spent_on < p_to::date
  ),
  units as (
    select coalesce(sum(oi.quantity),0)::bigint n from public.order_items oi join paid on paid.id = oi.order_id
  ),
  firsts as (
    select customer_id, min(paid_at) first_paid from public.orders
    where paid_at is not null and customer_id is not null group by customer_id
  ),
  sess as (
    select count(distinct session_id) n from public.analytics_events where created_at >= p_from and created_at < p_to
  ),
  agg as (
    select count(*) orders, coalesce(sum(total),0)::bigint total, coalesce(sum(subtotal),0)::bigint subtotal,
           coalesce(sum(discount_total),0)::bigint discounts, coalesce(sum(shipping_total),0)::bigint shipping,
           coalesce(sum(tax_total),0)::bigint tax, coalesce(sum(cost_total),0)::bigint cogs,
           coalesce(sum(payment_fees),0)::bigint fees,
           count(distinct customer_id) customers
    from paid
  )
  select jsonb_build_object(
    'orders', agg.orders,
    'revenue', agg.total,
    'gross_sales', agg.subtotal,
    'discounts', agg.discounts,
    'shipping', agg.shipping,
    'tax', agg.tax,
    'refunds', ref.amt,
    'refund_count', ref.n,
    'net_sales', agg.total - agg.tax - ref.amt,
    'cogs', agg.cogs,
    'fees', agg.fees,
    'gross_profit', agg.total - agg.tax - ref.amt - agg.cogs - agg.fees,
    'expenses', exp.amt,
    'net_profit', agg.total - agg.tax - ref.amt - agg.cogs - agg.fees - exp.amt,
    'margin_pct', case when agg.total - agg.tax - ref.amt > 0
                   then round(100.0 * (agg.total - agg.tax - ref.amt - agg.cogs - agg.fees - exp.amt) / (agg.total - agg.tax - ref.amt), 1) else 0 end,
    'aov', case when agg.orders > 0 then agg.total / agg.orders else 0 end,
    'units', units.n,
    'customers', agg.customers,
    'new_customers', (select count(*) from firsts where first_paid >= p_from and first_paid < p_to),
    'sessions', sess.n,
    'conversion_pct', case when sess.n > 0 then round(100.0 * agg.orders / sess.n, 2) else 0 end,
    'pending_fulfilment', (select count(*) from public.orders where status in ('paid','processing','ready_for_shipment')),
    'awaiting_payment', (select count(*) from public.orders where status = 'pending_payment' and placed_at > now() - interval '2 days'),
    'open_returns', (select count(*) from public.return_requests where status in ('requested','approved','awaiting_item','received')),
    'review_required', (select count(*) from public.orders where requires_review and review_status = 'pending' and payment_status = 'paid'),
    'low_stock', (select count(*) from public.product_variants v join public.products p on p.id = v.product_id
                   where v.track_inventory and v.is_active and p.status = 'active'
                     and v.stock_on_hand - v.stock_reserved <= v.low_stock_threshold)
  )
  from agg, ref, exp, units, sess
$$;

create or replace function public.report_series(p_from timestamptz, p_to timestamptz, p_bucket text default 'day')
returns table (bucket date, revenue bigint, orders bigint, profit bigint, refunds bigint, new_customers bigint)
language sql stable security definer set search_path = public as $$
  with b as (
    select generate_series(date_trunc(p_bucket, p_from), date_trunc(p_bucket, p_to - interval '1 second'), ('1 ' || p_bucket)::interval)::date as bucket
  ),
  o as (
    select date_trunc(p_bucket, paid_at)::date bk, sum(total)::bigint rev, count(*)::bigint n,
           sum(total - tax_total - cost_total - payment_fees)::bigint prof
    from public.orders where paid_at >= p_from and paid_at < p_to and payment_status in ('paid','refunded','partially_refunded')
    group by 1
  ),
  r as (
    select date_trunc(p_bucket, coalesce(processed_at, created_at))::date bk, sum(amount)::bigint amt
    from public.refunds where status = 'processed' and coalesce(processed_at, created_at) >= p_from and coalesce(processed_at, created_at) < p_to
    group by 1
  ),
  c as (
    select date_trunc(p_bucket, first_paid)::date bk, count(*)::bigint n from (
      select customer_id, min(paid_at) first_paid from public.orders where paid_at is not null and customer_id is not null group by 1
    ) f where first_paid >= p_from and first_paid < p_to group by 1
  )
  select b.bucket, coalesce(o.rev,0), coalesce(o.n,0), coalesce(o.prof,0) - coalesce(r.amt,0), coalesce(r.amt,0), coalesce(c.n,0)
  from b left join o on o.bk = b.bucket left join r on r.bk = b.bucket left join c on c.bk = b.bucket
  order by b.bucket
$$;

create or replace function public.report_top_products(p_from timestamptz, p_to timestamptz, p_limit int default 10)
returns table (product_id uuid, name text, units bigint, revenue bigint, profit bigint)
language sql stable security definer set search_path = public as $$
  select oi.product_id, max(oi.product_name), sum(oi.quantity)::bigint, sum(oi.line_total - oi.line_discount)::bigint,
         sum(oi.line_total - oi.line_discount - oi.unit_cost * oi.quantity)::bigint
  from public.order_items oi join public.orders o on o.id = oi.order_id
  where o.paid_at >= p_from and o.paid_at < p_to and o.payment_status in ('paid','refunded','partially_refunded')
  group by oi.product_id order by 4 desc limit p_limit
$$;

create or replace function public.report_breakdown(p_from timestamptz, p_to timestamptz, p_dim text)
returns table (label text, orders bigint, revenue bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_dim = 'category' then
    return query
      select coalesce(c.name, 'Uncategorised'), count(distinct o.id)::bigint, sum(oi.line_total - oi.line_discount)::bigint
      from public.order_items oi join public.orders o on o.id = oi.order_id
      left join public.products p on p.id = oi.product_id left join public.categories c on c.id = p.category_id
      where o.paid_at >= p_from and o.paid_at < p_to and o.payment_status in ('paid','refunded','partially_refunded')
      group by 1 order by 3 desc;
  elsif p_dim = 'country' then
    return query
      select coalesce(o.shipping_country, 'Unknown'), count(*)::bigint, sum(o.total)::bigint
      from public.orders o where o.paid_at >= p_from and o.paid_at < p_to and o.payment_status in ('paid','refunded','partially_refunded')
      group by 1 order by 3 desc;
  elsif p_dim = 'channel' then
    return query
      select coalesce(o.payment_channel, o.payment_provider, 'Unknown'), count(*)::bigint, sum(o.total)::bigint
      from public.orders o where o.paid_at >= p_from and o.paid_at < p_to and o.payment_status in ('paid','refunded','partially_refunded')
      group by 1 order by 3 desc;
  elsif p_dim = 'expense' then
    return query
      select e.category, count(*)::bigint, sum(e.amount)::bigint from public.expenses e
      where e.spent_on >= p_from::date and e.spent_on < p_to::date group by 1 order by 3 desc;
  end if;
end $$;

create or replace function public.report_funnel(p_from timestamptz, p_to timestamptz)
returns table (step text, sessions bigint)
language sql stable security definer set search_path = public as $$
  select s.step, (select count(distinct session_id) from public.analytics_events
                  where name = s.step and created_at >= p_from and created_at < p_to)::bigint
  from (values ('page_view',1),('view_item',2),('add_to_cart',3),('begin_checkout',4),('purchase',5)) s(step, ord)
  order by s.ord
$$;

do $$ declare f text; begin
  foreach f in array array[
    'report_summary(timestamptz,timestamptz)',
    'report_series(timestamptz,timestamptz,text)',
    'report_top_products(timestamptz,timestamptz,int)',
    'report_breakdown(timestamptz,timestamptz,text)',
    'report_funnel(timestamptz,timestamptz)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
