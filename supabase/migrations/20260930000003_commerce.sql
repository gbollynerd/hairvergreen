-- HairverGreen · 0003 · Commerce: addresses, carts, wishlists, discounts, campaigns,
-- shipping, tax, orders, payments, refunds, returns, expenses, subscribers.
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Addresses (registered customers)
-- ---------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  first_name text not null,
  last_name text not null,
  phone text,
  line1 text not null,
  line2 text,
  city text not null,
  state text,
  postal_code text,
  country text not null default 'NG',   -- ISO 3166-1 alpha-2
  is_default_shipping boolean not null default false,
  is_default_billing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger addresses_updated before update on public.addresses
  for each row execute function public.set_updated_at();
create index addresses_user_idx on public.addresses (user_id);

-- ---------------------------------------------------------------------------
-- Carts (server-side; id held in an httpOnly cookie). Used for abandoned-cart tracking.
-- ---------------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email citext,
  phone text,
  coupon_codes text[] not null default '{}',
  country text,
  status text not null default 'active' check (status in ('active','converted','abandoned','merged')),
  order_id uuid,
  recovery_token uuid not null default gen_random_uuid(),
  recovered_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index carts_user_idx on public.carts (user_id) where status = 'active';
create index carts_activity_idx on public.carts (status, last_activity_at desc);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0 and quantity <= 50),
  bundle_selection jsonb,          -- {bundle_item_id: variant_id}
  customization jsonb,
  saved_for_later boolean not null default false,
  created_at timestamptz not null default now()
);
create index cart_items_cart_idx on public.cart_items (cart_id);

-- ---------------------------------------------------------------------------
-- Wishlist (registered; guests keep a local list merged on login)
-- ---------------------------------------------------------------------------
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  price_at_add bigint,
  notify_restock boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table public.back_in_stock_requests (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  user_id uuid references auth.users(id) on delete set null,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email, product_id, variant_id)
);

-- ---------------------------------------------------------------------------
-- Campaigns & discounts
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  status text not null default 'draft' check (status in ('draft','scheduled','active','ended')),
  starts_at timestamptz,
  ends_at timestamptz,
  banner_id uuid references public.media(id) on delete set null,
  landing_page_id uuid,
  popup_id uuid,
  product_ids uuid[] not null default '{}',
  email_campaign_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger campaigns_updated before update on public.campaigns
  for each row execute function public.set_updated_at();

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code citext unique,                  -- null = automatic promotion
  description text,
  kind text not null check (kind in ('percentage','fixed','free_shipping','buy_x_get_y','tiered')),
  value numeric not null default 0,    -- percent (0-100) or fixed minor units
  applies_to text not null default 'order' check (applies_to in ('order','products','categories','collections')),
  target_ids uuid[] not null default '{}',
  min_subtotal bigint,
  max_discount bigint,
  min_quantity int,
  buy_quantity int,                    -- buy_x_get_y: buy N ...
  get_quantity int,                    -- ... get M
  get_percent numeric,                 -- ... at get_percent% off (100 = free)
  tiers jsonb,                         -- tiered: [{"min_qty":2,"percent":5},{"min_qty":3,"percent":10}]
  eligibility text not null default 'all' check (eligibility in ('all','new','existing','specific')),
  customer_emails citext[] not null default '{}',
  usage_limit int,
  per_customer_limit int,
  used_count int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  currencies text[] not null default '{}',
  countries text[] not null default '{}',
  combinable boolean not null default false,
  show_countdown boolean not null default false,
  is_flash_sale boolean not null default false,
  is_active boolean not null default true,
  campaign_id uuid references public.campaigns(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger discounts_updated before update on public.discounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Shipping & tax
-- ---------------------------------------------------------------------------
create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  countries text[] not null default '{}',   -- ISO codes; '*' = rest of world
  states text[] not null default '{}',      -- optional sub-regions (e.g. Lagos); empty = whole country
  sort int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.shipping_zones(id) on delete cascade,
  name text not null,
  description text,
  carrier text,
  service_level text not null default 'standard' check (service_level in ('standard','express','pickup')),
  rate_type text not null default 'flat' check (rate_type in ('flat','weight','order_value')),
  base_rate bigint not null default 0,
  per_kg_rate bigint not null default 0,
  rate_table jsonb,   -- order_value: [{"min":0,"rate":500000},{"min":20000000,"rate":0}]
  free_over bigint,
  min_days int,
  max_days int,
  sort int not null default 0,
  is_active boolean not null default true
);

create table public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  state text,
  rate_percent numeric(6,3) not null,
  tax_class text not null default 'standard',
  applies_to_shipping boolean not null default false,
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start 10001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('HG' || nextval('public.order_number_seq')),
  user_id uuid references auth.users(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  cart_id uuid,
  email citext not null,
  phone text,
  customer_name text,
  status text not null default 'pending_payment' check (status in (
    'pending_payment','paid','payment_failed','processing','ready_for_shipment','shipped',
    'delivered','cancelled','refund_requested','refunded','partially_refunded')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded','partially_refunded')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled','processing','ready','shipped','delivered','returned','cancelled')),
  requires_review boolean not null default false,
  review_status text check (review_status in ('pending','approved','changes_requested')),
  currency text not null default 'NGN',
  subtotal bigint not null default 0,
  discount_total bigint not null default 0,
  shipping_total bigint not null default 0,
  tax_total bigint not null default 0,
  total bigint not null default 0,
  refunded_total bigint not null default 0,
  cost_total bigint not null default 0,         -- COGS snapshot for profit reporting
  payment_fees bigint not null default 0,       -- processor fees
  display_currency text,
  fx_rate numeric,
  discount_codes text[] not null default '{}',
  discount_ids uuid[] not null default '{}',
  discount_breakdown jsonb not null default '[]'::jsonb,
  shipping_method jsonb,
  shipping_address jsonb,
  billing_address jsonb,
  shipping_country text,
  carrier text,
  tracking_number text,
  tracking_url text,
  customer_note text,
  payment_provider text,
  payment_reference text,
  payment_channel text,
  inventory_state text not null default 'none' check (inventory_state in ('none','reserved','released','committed','restocked')),
  reserved_until timestamptz,
  source text not null default 'web',
  utm jsonb,
  placed_at timestamptz not null default now(),
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();
create index orders_user_idx on public.orders (user_id, placed_at desc);
create index orders_email_idx on public.orders (email);
create index orders_status_idx on public.orders (status, placed_at desc);
create index orders_paid_idx on public.orders (paid_at) where paid_at is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_title text,
  sku text,
  image_url text,
  options jsonb not null default '{}'::jsonb,
  unit_price bigint not null,
  compare_at_price bigint,
  quantity int not null check (quantity > 0),
  line_discount bigint not null default 0,
  line_total bigint not null,
  unit_cost bigint not null default 0,
  bundle_components jsonb,    -- [{product_id, variant_id, name, variant_title, quantity}]
  customization jsonb,
  stock_allocations jsonb not null default '[]'::jsonb,  -- [{variant_id, quantity}] total for the line
  returned_quantity int not null default 0,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null,        -- created | payment_confirmed | status_changed | note | customer_note | email_sent | refund | return | tracking | review
  message text not null,
  is_internal boolean not null default true,
  data jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Payments, webhooks, refunds, returns
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  reference text not null unique,
  provider_transaction_id text,
  amount bigint not null,
  currency text not null,
  status text not null default 'initialized' check (status in ('initialized','pending','success','failed','abandoned','mismatch','reversed')),
  channel text,
  fees bigint,
  customer_email text,
  authorization_url text,
  raw jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payments_updated before update on public.payments
  for each row execute function public.set_updated_at();
create index payments_order_idx on public.payments (order_id);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_key text not null,         -- provider event id or sha256 of payload
  event_type text,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_key)
);

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  rma_number text not null unique default ('RMA' || lpad((floor(random()*1000000))::text, 6, '0')),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email citext not null,
  status text not null default 'requested' check (status in ('requested','approved','rejected','awaiting_item','received','refunded','exchanged','closed')),
  resolution text not null default 'refund' check (resolution in ('refund','exchange','store_credit')),
  reason text not null,
  items jsonb not null default '[]'::jsonb,   -- [{order_item_id, quantity, reason}]
  customer_note text,
  admin_note text,
  media jsonb not null default '[]'::jsonb,
  refund_amount bigint,
  restocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger return_requests_updated before update on public.return_requests
  for each row execute function public.set_updated_at();
create index return_requests_order_idx on public.return_requests (order_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  return_id uuid references public.return_requests(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  provider text,
  provider_refund_id text,
  amount bigint not null check (amount > 0),
  currency text not null default 'NGN',
  reason text,
  method text not null default 'original_payment' check (method in ('original_payment','manual','store_credit')),
  status text not null default 'pending' check (status in ('pending','processing','processed','failed')),
  restock boolean not null default false,
  raw jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index refunds_order_idx on public.refunds (order_id);

-- ---------------------------------------------------------------------------
-- Business expenses (for profit reporting)
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  category text not null,   -- advertising, shipping, packaging, salaries, rent, software, stock_purchase, other
  description text,
  amount bigint not null check (amount >= 0),
  currency text not null default 'NGN',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses (spent_on);

-- ---------------------------------------------------------------------------
-- Newsletter
-- ---------------------------------------------------------------------------
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  source text,
  consent_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);
