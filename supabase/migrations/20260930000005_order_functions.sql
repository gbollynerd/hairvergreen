-- HairverGreen · 0005 · Transactional functions for orders, inventory and payments.
-- These run with the service role from trusted server code. Execution is revoked from
-- anon/authenticated at the end of this file.
set search_path = public, extensions;

-- Log + apply an inventory movement on a locked variant row.
create or replace function public._move_stock(p_variant uuid, p_on_hand int, p_reserved int, p_reason text,
  p_order uuid default null, p_note text default null, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.product_variants
     set stock_on_hand = stock_on_hand + p_on_hand,
         stock_reserved = greatest(stock_reserved + p_reserved, 0)
   where id = p_variant;
  insert into public.inventory_movements (variant_id, delta_on_hand, delta_reserved, reason, order_id, note, actor_id)
  values (p_variant, p_on_hand, p_reserved, p_reason, p_order, p_note, p_actor);
end $$;

-- Manual stock adjustment by staff (delta or absolute set).
create or replace function public.adjust_stock(p_variant uuid, p_delta int, p_reason text, p_note text, p_actor uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_new int;
begin
  perform 1 from public.product_variants where id = p_variant for update;
  perform public._move_stock(p_variant, p_delta, 0, coalesce(p_reason, 'adjustment'), null, p_note, p_actor);
  select stock_on_hand into v_new from public.product_variants where id = p_variant;
  -- Clear back-in-stock notification state when inventory returns
  return v_new;
end $$;

-- Release reservations for one order (payment failed / abandoned / cancelled before payment).
create or replace function public.release_order_inventory(p_order uuid, p_reason text default 'order_released')
returns boolean language plpgsql security definer set search_path = public as $$
declare o record; a record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.inventory_state <> 'reserved' then return false; end if;
  for a in
    select (x->>'variant_id')::uuid as variant_id, sum((x->>'quantity')::int)::int as qty
      from public.order_items oi cross join lateral jsonb_array_elements(oi.stock_allocations) x
     where oi.order_id = p_order group by 1 order by 1
  loop
    perform 1 from public.product_variants where id = a.variant_id and track_inventory for update;
    if found then perform public._move_stock(a.variant_id, 0, -a.qty, p_reason, p_order); end if;
  end loop;
  update public.orders set inventory_state = 'released' where id = p_order;
  return true;
end $$;

-- Expire unpaid reservations older than their hold window.
create or replace function public.release_expired_reservations() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.orders
            where status = 'pending_payment' and inventory_state = 'reserved' and reserved_until < now()
            for update skip locked
  loop
    perform public.release_order_inventory(r.id, 'reservation_expired');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Create an order atomically. Pricing is computed by trusted server code from DB prices.
-- p: {user_id, email, phone, customer_name, currency, subtotal, discount_total, shipping_total, tax_total,
--     total, cost_total, display_currency, fx_rate, discount_codes[], discount_ids[], discount_breakdown,
--     shipping_method, shipping_address, billing_address, shipping_country, customer_note, requires_review,
--     cart_id, hold_minutes, utm,
--     items: [{product_id, variant_id, product_name, variant_title, sku, image_url, options, unit_price,
--              compare_at_price, quantity, line_discount, line_total, unit_cost, bundle_components,
--              customization, stock_allocations:[{variant_id, quantity}]}]}
create or replace function public.place_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_number text;
  v_customer uuid;
  it jsonb;
  a record;
  v record;
  v_hold int := coalesce((p->>'hold_minutes')::int, 60);
begin
  perform public.release_expired_reservations();

  insert into public.customers (email, full_name, phone, user_id, country)
  values (p->>'email', p->>'customer_name', p->>'phone',
    case when exists (select 1 from public.customers c where c.user_id = nullif(p->>'user_id','')::uuid) then null
         else nullif(p->>'user_id','')::uuid end,
    p->>'shipping_country')
  on conflict (email) do update set
    full_name = coalesce(public.customers.full_name, excluded.full_name),
    phone = coalesce(public.customers.phone, excluded.phone),
    user_id = coalesce(public.customers.user_id, excluded.user_id),
    country = coalesce(excluded.country, public.customers.country)
  returning id into v_customer;

  insert into public.orders (
    user_id, customer_id, cart_id, email, phone, customer_name, currency,
    subtotal, discount_total, shipping_total, tax_total, total, cost_total,
    display_currency, fx_rate, discount_codes, discount_ids, discount_breakdown,
    shipping_method, shipping_address, billing_address, shipping_country, customer_note,
    requires_review, review_status, inventory_state, reserved_until, utm)
  values (
    nullif(p->>'user_id','')::uuid, v_customer, nullif(p->>'cart_id','')::uuid, p->>'email', p->>'phone', p->>'customer_name',
    coalesce(p->>'currency','NGN'),
    (p->>'subtotal')::bigint, coalesce((p->>'discount_total')::bigint,0), coalesce((p->>'shipping_total')::bigint,0),
    coalesce((p->>'tax_total')::bigint,0), (p->>'total')::bigint, coalesce((p->>'cost_total')::bigint,0),
    p->>'display_currency', nullif(p->>'fx_rate','')::numeric,
    coalesce(array(select jsonb_array_elements_text(p->'discount_codes')), '{}'),
    coalesce(array(select (jsonb_array_elements_text(p->'discount_ids'))::uuid), '{}'),
    coalesce(p->'discount_breakdown','[]'::jsonb),
    p->'shipping_method', p->'shipping_address', coalesce(p->'billing_address', p->'shipping_address'),
    p->>'shipping_country', p->>'customer_note',
    coalesce((p->>'requires_review')::boolean,false),
    case when coalesce((p->>'requires_review')::boolean,false) then 'pending' end,
    'reserved', now() + make_interval(mins => v_hold), p->'utm')
  returning id, order_number into v_order_id, v_number;

  for it in select * from jsonb_array_elements(p->'items') loop
    insert into public.order_items (order_id, product_id, variant_id, product_name, variant_title, sku, image_url,
      options, unit_price, compare_at_price, quantity, line_discount, line_total, unit_cost,
      bundle_components, customization, stock_allocations)
    values (v_order_id, (it->>'product_id')::uuid, (it->>'variant_id')::uuid, it->>'product_name', it->>'variant_title',
      it->>'sku', it->>'image_url', coalesce(it->'options','{}'::jsonb), (it->>'unit_price')::bigint,
      nullif(it->>'compare_at_price','')::bigint, (it->>'quantity')::int, coalesce((it->>'line_discount')::bigint,0),
      (it->>'line_total')::bigint, coalesce((it->>'unit_cost')::bigint,0), it->'bundle_components', it->'customization',
      coalesce(it->'stock_allocations','[]'::jsonb));
  end loop;

  -- Reserve stock (locks variant rows in a stable order to avoid deadlocks)
  for a in
    select (x->>'variant_id')::uuid as variant_id, sum((x->>'quantity')::int)::int as qty
      from jsonb_array_elements(p->'items') i cross join lateral jsonb_array_elements(i->'stock_allocations') x
     group by 1 order by 1
  loop
    select * into v from public.product_variants where id = a.variant_id for update;
    if not found or not v.is_active then
      raise exception 'VARIANT_UNAVAILABLE:%', a.variant_id using errcode = 'P0001';
    end if;
    if v.track_inventory and not v.allow_backorder and (v.stock_on_hand - v.stock_reserved) < a.qty then
      raise exception 'INSUFFICIENT_STOCK:%', a.variant_id using errcode = 'P0001';
    end if;
    if v.track_inventory then
      perform public._move_stock(a.variant_id, 0, a.qty, 'order_reserved', v_order_id);
    end if;
  end loop;

  insert into public.order_events (order_id, type, message, is_internal)
  values (v_order_id, 'created', 'Order created — awaiting payment', false);

  if nullif(p->>'cart_id','') is not null then
    update public.carts set order_id = v_order_id where id = (p->>'cart_id')::uuid;
  end if;

  return jsonb_build_object('id', v_order_id, 'order_number', v_number);
end $$;

-- Idempotently mark an order paid after server-side verification with the provider.
-- Returns: paid | already_paid | amount_mismatch | not_found
create or replace function public.mark_order_paid(
  p_order uuid, p_provider text, p_reference text, p_amount bigint, p_currency text,
  p_channel text default null, p_fees bigint default null, p_raw jsonb default null, p_provider_txn text default null)
returns text language plpgsql security definer set search_path = public as $$
declare o record; a record; it record; v_email text;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then return 'not_found'; end if;

  if o.payment_status in ('paid','refunded','partially_refunded') then
    if o.payment_reference is distinct from p_reference then
      -- A second, separate successful charge for an already-paid order: record it and flag for refund.
      insert into public.payments (order_id, provider, reference, amount, currency, status, channel, fees, raw, paid_at, provider_transaction_id)
      values (p_order, p_provider, p_reference, p_amount, p_currency, 'success', p_channel, p_fees, p_raw, now(), p_provider_txn)
      on conflict (reference) do nothing;
      if found then
        insert into public.order_events (order_id, type, message, data)
        values (p_order, 'payment_issue', 'Duplicate payment received — refund the extra charge', jsonb_build_object('reference', p_reference, 'amount', p_amount));
        return 'duplicate_payment';
      end if;
    end if;
    return 'already_paid';
  end if;

  if p_amount <> o.total or upper(p_currency) <> upper(o.currency) then
    insert into public.payments (order_id, provider, reference, amount, currency, status, channel, raw, provider_transaction_id)
    values (p_order, p_provider, p_reference, p_amount, p_currency, 'mismatch', p_channel, p_raw, p_provider_txn)
    on conflict (reference) do update set status = 'mismatch', raw = excluded.raw, amount = excluded.amount;
    insert into public.order_events (order_id, type, message, data)
    values (p_order, 'payment_issue',
      format('Payment amount mismatch: expected %s %s, received %s %s', o.total, o.currency, p_amount, p_currency),
      jsonb_build_object('reference', p_reference));
    return 'amount_mismatch';
  end if;

  insert into public.payments (order_id, provider, reference, amount, currency, status, channel, fees, raw, paid_at, provider_transaction_id)
  values (p_order, p_provider, p_reference, p_amount, p_currency, 'success', p_channel, p_fees, p_raw, now(), p_provider_txn)
  on conflict (reference) do update set status = 'success', channel = excluded.channel, fees = excluded.fees,
    raw = excluded.raw, paid_at = now(), provider_transaction_id = excluded.provider_transaction_id;

  -- Commit inventory
  for a in
    select (x->>'variant_id')::uuid as variant_id, sum((x->>'quantity')::int)::int as qty
      from public.order_items oi cross join lateral jsonb_array_elements(oi.stock_allocations) x
     where oi.order_id = p_order group by 1 order by 1
  loop
    perform 1 from public.product_variants where id = a.variant_id and track_inventory for update;
    if found then
      if o.inventory_state = 'reserved' then
        perform public._move_stock(a.variant_id, -a.qty, -a.qty, 'order_paid', p_order);
      elsif o.inventory_state in ('released','none') then
        perform public._move_stock(a.variant_id, -a.qty, 0, 'order_paid', p_order,
          case when o.inventory_state = 'released' then 'Paid after reservation expired' end);
      end if;
    end if;
  end loop;

  update public.orders set
    status = 'paid', payment_status = 'paid', paid_at = now(),
    inventory_state = 'committed', payment_provider = p_provider, payment_reference = p_reference,
    payment_channel = p_channel, payment_fees = coalesce(p_fees, 0)
  where id = p_order;

  -- Sales counters
  for it in select product_id, sum(quantity) q from public.order_items where order_id = p_order and product_id is not null group by 1 loop
    update public.products set sales_count = sales_count + it.q where id = it.product_id;
  end loop;

  -- Discount usage
  if array_length(o.discount_ids, 1) > 0 then
    update public.discounts set used_count = used_count + 1 where id = any(o.discount_ids);
  end if;

  update public.carts set status = 'converted' where id = o.cart_id;

  insert into public.order_events (order_id, type, message, is_internal, data)
  values (p_order, 'payment_confirmed',
    format('Payment confirmed via %s%s', p_provider, coalesce(' (' || p_channel || ')', '')), false,
    jsonb_build_object('reference', p_reference, 'amount', p_amount));

  if o.requires_review then
    insert into public.order_events (order_id, type, message, is_internal)
    values (p_order, 'review', 'Customization review required before production', false);
  end if;
  return 'paid';
end $$;

create or replace function public.mark_order_payment_failed(p_order uuid, p_provider text, p_reference text, p_raw jsonb default null)
returns text language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then return 'not_found'; end if;
  if o.payment_status <> 'pending' then return 'ignored'; end if;
  insert into public.payments (order_id, provider, reference, amount, currency, status, raw)
  values (p_order, p_provider, p_reference, o.total, o.currency, 'failed', p_raw)
  on conflict (reference) do update set status = 'failed', raw = excluded.raw;
  update public.orders set status = 'payment_failed', payment_status = 'failed' where id = p_order;
  perform public.release_order_inventory(p_order, 'payment_failed');
  insert into public.order_events (order_id, type, message, is_internal)
  values (p_order, 'payment_failed', 'Payment failed or was abandoned', false);
  return 'failed';
end $$;

-- Cancel an order. Releases reservations; optionally restocks committed inventory.
create or replace function public.cancel_order(p_order uuid, p_restock boolean, p_actor uuid, p_actor_name text, p_reason text)
returns text language plpgsql security definer set search_path = public as $$
declare o record; a record;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then return 'not_found'; end if;
  if o.status in ('cancelled','refunded') then return 'already_cancelled'; end if;

  if o.inventory_state = 'reserved' then
    perform public.release_order_inventory(p_order, 'order_cancelled');
  elsif o.inventory_state = 'committed' and p_restock then
    for a in
      select (x->>'variant_id')::uuid as variant_id, sum((x->>'quantity')::int)::int as qty
        from public.order_items oi cross join lateral jsonb_array_elements(oi.stock_allocations) x
       where oi.order_id = p_order group by 1 order by 1
    loop
      perform 1 from public.product_variants where id = a.variant_id and track_inventory for update;
      if found then perform public._move_stock(a.variant_id, a.qty, 0, 'cancel_restock', p_order, null, p_actor); end if;
    end loop;
    update public.orders set inventory_state = 'restocked' where id = p_order;
  end if;

  update public.orders set status = 'cancelled', fulfillment_status = 'cancelled', cancelled_at = now()
   where id = p_order;
  insert into public.order_events (order_id, type, message, actor_id, actor_name, is_internal)
  values (p_order, 'status_changed', 'Order cancelled' || coalesce(': ' || p_reason, ''), p_actor, p_actor_name, false);
  return 'cancelled';
end $$;

-- Restock specific returned items. p_items: [{order_item_id, quantity}]
create or replace function public.restock_order_items(p_order uuid, p_items jsonb, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare it jsonb; oi record; x jsonb; per_unit numeric;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    select * into oi from public.order_items where id = (it->>'order_item_id')::uuid and order_id = p_order for update;
    if not found then continue; end if;
    for x in select * from jsonb_array_elements(oi.stock_allocations) loop
      per_unit := (x->>'quantity')::numeric / oi.quantity;
      perform 1 from public.product_variants where id = (x->>'variant_id')::uuid and track_inventory for update;
      if found then
        perform public._move_stock((x->>'variant_id')::uuid, round(per_unit * (it->>'quantity')::int)::int, 0,
          'restock_return', p_order, null, p_actor);
      end if;
    end loop;
    update public.order_items set returned_quantity = least(quantity, returned_quantity + (it->>'quantity')::int)
     where id = oi.id;
  end loop;
end $$;

-- Recompute refunded totals/payment status after a refund is processed.
create or replace function public.apply_refund_totals(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_ref bigint; o record;
begin
  select * into o from public.orders where id = p_order for update;
  select coalesce(sum(amount),0) into v_ref from public.refunds where order_id = p_order and status = 'processed';
  update public.orders set
    refunded_total = v_ref,
    payment_status = case when v_ref = 0 then payment_status when v_ref >= total then 'refunded' else 'partially_refunded' end,
    status = case when v_ref = 0 then status when v_ref >= total then 'refunded' else 'partially_refunded' end
  where id = p_order;
end $$;

revoke execute on function public._move_stock(uuid,int,int,text,uuid,text,uuid) from public, anon, authenticated;
revoke execute on function public.adjust_stock(uuid,int,text,text,uuid) from public, anon, authenticated;
revoke execute on function public.release_order_inventory(uuid,text) from public, anon, authenticated;
revoke execute on function public.release_expired_reservations() from public, anon, authenticated;
revoke execute on function public.place_order(jsonb) from public, anon, authenticated;
revoke execute on function public.mark_order_paid(uuid,text,text,bigint,text,text,bigint,jsonb,text) from public, anon, authenticated;
revoke execute on function public.mark_order_payment_failed(uuid,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.cancel_order(uuid,boolean,uuid,text,text) from public, anon, authenticated;
revoke execute on function public.restock_order_items(uuid,jsonb,uuid) from public, anon, authenticated;
revoke execute on function public.apply_refund_totals(uuid) from public, anon, authenticated;
grant execute on function public._move_stock(uuid,int,int,text,uuid,text,uuid) to service_role;
grant execute on function public.adjust_stock(uuid,int,text,text,uuid) to service_role;
grant execute on function public.release_order_inventory(uuid,text) to service_role;
grant execute on function public.release_expired_reservations() to service_role;
grant execute on function public.place_order(jsonb) to service_role;
grant execute on function public.mark_order_paid(uuid,text,text,bigint,text,text,bigint,jsonb,text) to service_role;
grant execute on function public.mark_order_payment_failed(uuid,text,text,jsonb) to service_role;
grant execute on function public.cancel_order(uuid,boolean,uuid,text,text) to service_role;
grant execute on function public.restock_order_items(uuid,jsonb,uuid) to service_role;
grant execute on function public.apply_refund_totals(uuid) to service_role;
