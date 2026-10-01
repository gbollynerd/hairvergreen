-- HairverGreen · 0002 · Catalogue: media, categories, attributes, products, variants,
-- inventory, relations, collections, bundles, reviews, search.
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Media library
-- ---------------------------------------------------------------------------
create table public.media_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.media_folders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.media_folders(id) on delete set null,
  bucket text not null default 'media',
  path text,                     -- storage object path (null for external/demo URLs)
  url text not null,             -- public URL used for rendering
  kind text not null default 'image' check (kind in ('image','video','file')),
  mime_type text,
  filename text,
  title text,
  alt text not null default '',
  width int,
  height int,
  size_bytes bigint,
  duration_seconds numeric,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger media_updated before update on public.media
  for each row execute function public.set_updated_at();
create index media_created_idx on public.media (created_at desc);
create index media_tags_idx on public.media using gin (tags);

-- ---------------------------------------------------------------------------
-- Categories (hierarchical)
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  image_id uuid references public.media(id) on delete set null,
  sort int not null default 0,
  is_visible boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_updated before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Attribute values (admin-configurable textures, lengths, colours, lace, density, construction)
-- Variant option keys reference attribute_values.attribute; values reference slug.
-- ---------------------------------------------------------------------------
create table public.attribute_values (
  id uuid primary key default gen_random_uuid(),
  attribute text not null check (attribute ~ '^[a-z_]+$'),
  label text not null,
  slug text not null,
  sort int not null default 0,
  swatch text,               -- hex colour or image URL
  description text,
  image_id uuid references public.media(id) on delete set null,
  show_in_nav boolean not null default true,
  unique (attribute, slug)
);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sku text,
  product_type text not null default 'hair'
    check (product_type in ('hair','wig','bundle_deal','accessory','custom_unit','service','gift_card')),
  category_id uuid references public.categories(id) on delete set null,
  brand text not null default 'HairverGreen',
  status text not null default 'draft' check (status in ('draft','active','hidden','archived')),
  publish_at timestamptz,
  short_description text,
  description text,                          -- sanitised HTML
  details jsonb not null default '{}'::jsonb, -- hair info: origin, grade, lace_info, density_info, care, shipping_note, returns_note, faq[]
  tags text[] not null default '{}',
  option_keys text[] not null default '{}',  -- ordered attribute keys used for variants, e.g. {texture,length}
  -- Pricing fallback for display; authoritative prices live on variants.
  price bigint not null default 0 check (price >= 0),
  compare_at_price bigint check (compare_at_price is null or compare_at_price >= 0),
  is_featured boolean not null default false,
  is_new boolean not null default false,
  requires_review boolean not null default false,  -- orders need "Customization Review Required"
  weight_grams int not null default 0,
  dimensions jsonb,
  shipping_class text not null default 'standard',
  tax_class text not null default 'standard',
  seo_title text,
  seo_description text,
  og_image_id uuid references public.media(id) on delete set null,
  noindex boolean not null default false,
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  sales_count int not null default 0,
  search_text text not null default '',
  search_vector tsvector,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();
create index products_status_idx on public.products (status, publish_at);
create index products_category_idx on public.products (category_id);
create index products_search_idx on public.products using gin (search_vector);
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create index products_tags_idx on public.products using gin (tags);

-- Every product has at least one variant (a "default" variant when it has no options).
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique,
  title text not null default 'Default',
  options jsonb not null default '{}'::jsonb,  -- {"texture":"body-wave","length":"20"}
  price bigint not null check (price >= 0),
  compare_at_price bigint check (compare_at_price is null or compare_at_price >= 0),
  cost_price bigint check (cost_price is null or cost_price >= 0),
  weight_grams int,
  image_id uuid references public.media(id) on delete set null,
  is_active boolean not null default true,
  position int not null default 0,
  -- Inventory
  track_inventory boolean not null default true,
  stock_on_hand int not null default 0,
  stock_reserved int not null default 0 check (stock_reserved >= 0),
  low_stock_threshold int not null default 3,
  allow_backorder boolean not null default false,
  restock_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger variants_updated before update on public.product_variants
  for each row execute function public.set_updated_at();
create index variants_product_idx on public.product_variants (product_id, position);
create index variants_options_idx on public.product_variants using gin (options);

create or replace function public.variant_available(v public.product_variants) returns int
language sql immutable as $$
  select case when not v.track_inventory then 999999 else greatest(v.stock_on_hand - v.stock_reserved, 0) end
$$;

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  delta_on_hand int not null default 0,
  delta_reserved int not null default 0,
  reason text not null,   -- adjustment | order_reserved | order_released | order_paid | restock_return | cancel_restock
  order_id uuid,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);

-- Gallery. option_match (e.g. {"texture":"body-wave"}) scopes an image to matching variant selections.
create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  option_match jsonb not null default '{}'::jsonb,
  sort int not null default 0,
  alt text
);
create index product_media_product_idx on public.product_media (product_id, sort);

create table public.product_relations (
  product_id uuid not null references public.products(id) on delete cascade,
  related_id uuid not null references public.products(id) on delete cascade,
  kind text not null check (kind in ('related','upsell','cross_sell','bought_together')),
  sort int not null default 0,
  primary key (product_id, related_id, kind),
  check (product_id <> related_id)
);

-- ---------------------------------------------------------------------------
-- Collections
-- ---------------------------------------------------------------------------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tagline text,
  description text,
  image_id uuid references public.media(id) on delete set null,
  is_visible boolean not null default true,
  is_featured boolean not null default false,
  sort int not null default 0,
  -- Optional "collection price" deal for buying every product in the collection together
  deal_enabled boolean not null default false,
  deal_price bigint,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger collections_updated before update on public.collections
  for each row execute function public.set_updated_at();

create table public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort int not null default 0,
  primary key (collection_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Bundles: a product of type bundle_deal composed of component products/variants.
--   pricing_mode fixed        -> bundle product's variant price is charged
--   pricing_mode percent_off  -> sum(chosen components) * (1 - value/100)
--   pricing_mode amount_off   -> sum(chosen components) - value
-- A bundle item with variant_id NULL lets the customer choose the variant (Build Your Bundle).
-- ---------------------------------------------------------------------------
create table public.bundles (
  product_id uuid primary key references public.products(id) on delete cascade,
  pricing_mode text not null default 'fixed' check (pricing_mode in ('fixed','percent_off','amount_off')),
  value bigint not null default 0,
  headline text,
  created_at timestamptz not null default now()
);

create table public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_product_id uuid not null references public.bundles(product_id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  is_optional boolean not null default false,
  label text,
  sort int not null default 0
);
create index bundle_items_bundle_idx on public.bundle_items (bundle_product_id, sort);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid,
  author_name text not null,
  author_location text,
  rating int not null check (rating between 1 and 5),
  title text,
  body text not null,
  media jsonb not null default '[]'::jsonb,   -- [{url, kind}]
  is_verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected','hidden')),
  admin_response text,
  responded_at timestamptz,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);
create index reviews_product_idx on public.reviews (product_id, status, created_at desc);

create or replace function public.refresh_product_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where product_id = pid and status = 'approved'), 0),
    rating_count = (select count(*) from public.reviews where product_id = pid and status = 'approved')
  where p.id = pid;
  return null;
end $$;
create trigger reviews_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- ---------------------------------------------------------------------------
-- Search text maintenance: product name, tags, SKU, category, option labels
-- (e.g. "20 inch", "body wave") so "20 inch body wave" matches.
-- ---------------------------------------------------------------------------
create or replace function public.rebuild_product_search(pid uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  txt text;
begin
  select concat_ws(' ',
      p.name, p.sku, p.brand, p.product_type, replace(p.product_type, '_', ' '),
      array_to_string(p.tags, ' '),
      p.short_description,
      c.name, pc.name,
      (select string_agg(distinct concat_ws(' ', v.sku, v.title), ' ') from public.product_variants v where v.product_id = p.id),
      (select string_agg(distinct
          case when av.attribute = 'length' then av.label || ' ' || av.slug || ' inch ' || av.slug || 'in' else av.label end, ' ')
         from public.product_variants v
         cross join lateral jsonb_each_text(v.options) o
         join public.attribute_values av on av.attribute = o.key and av.slug = o.value
        where v.product_id = p.id)
    )
    into txt
  from public.products p
  left join public.categories c on c.id = p.category_id
  left join public.categories pc on pc.id = c.parent_id
  where p.id = pid;

  update public.products set
    search_text = lower(coalesce(txt, '')),
    search_vector = to_tsvector('simple', extensions.unaccent(lower(coalesce(txt, ''))))
  where id = pid;
end $$;

create or replace function public.products_search_trigger() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name or new.tags is distinct from old.tags
     or new.sku is distinct from old.sku or new.short_description is distinct from old.short_description
     or new.category_id is distinct from old.category_id or new.product_type is distinct from old.product_type then
    perform public.rebuild_product_search(new.id);
  end if;
  return null;
end $$;
create trigger products_search after insert or update on public.products
  for each row execute function public.products_search_trigger();

create or replace function public.variants_search_trigger() returns trigger
language plpgsql as $$
begin
  perform public.rebuild_product_search(coalesce(new.product_id, old.product_id));
  return null;
end $$;
create trigger variants_search after insert or update of options, sku, title or delete on public.product_variants
  for each row execute function public.variants_search_trigger();

-- Returns ranked product ids for a free-text query. Tries full-text AND match with prefixes,
-- then falls back to trigram similarity on name / search_text.
create or replace function public.search_products(q text, lim int default 24)
returns table (product_id uuid, rank real)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  cleaned text := trim(regexp_replace(lower(extensions.unaccent(coalesce(q, ''))), '[^a-z0-9 ]+', ' ', 'g'));
  tsq tsquery;
begin
  if cleaned = '' then return; end if;
  select to_tsquery('simple', string_agg(w || ':*', ' & ')) into tsq
  from unnest(regexp_split_to_array(cleaned, '\s+')) w where w <> '';

  return query
    select p.id, ts_rank(p.search_vector, tsq)
    from public.products p
    where p.status = 'active' and (p.publish_at is null or p.publish_at <= now())
      and p.search_vector @@ tsq
    order by 2 desc, p.sales_count desc
    limit lim;
  if found then return; end if;

  return query
    select p.id, greatest(similarity(p.name, cleaned), word_similarity(cleaned, p.search_text))::real as r
    from public.products p
    where p.status = 'active' and (p.publish_at is null or p.publish_at <= now())
      and (p.name % cleaned or cleaned <% p.search_text)
    order by r desc
    limit lim;
end $$;
