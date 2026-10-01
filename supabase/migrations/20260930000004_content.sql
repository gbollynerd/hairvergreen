-- HairverGreen · 0004 · Content: pages & sections (page builder), blog, navigation,
-- popups, announcements, social gallery, consultations, analytics events, contact messages.
set search_path = public, extensions;

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,          -- 'home' is the homepage
  title text not null,
  kind text not null default 'page' check (kind in ('home','page','policy','landing')),
  status text not null default 'draft' check (status in ('draft','published')),
  body text,                          -- optional rich-text body (policies)
  seo_title text,
  seo_description text,
  og_image_id uuid references public.media(id) on delete set null,
  noindex boolean not null default false,
  published_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger pages_updated before update on public.pages
  for each row execute function public.set_updated_at();

-- Each section is a block: type + settings JSON (heading, text, media, CTA, layout, spacing, etc.)
create table public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  type text not null,
  name text,
  sort int not null default 0,
  is_visible boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger page_sections_updated before update on public.page_sections
  for each row execute function public.set_updated_at();
create index page_sections_page_idx on public.page_sections (page_id, sort);

alter table public.campaigns add constraint campaigns_landing_fk
  foreign key (landing_page_id) references public.pages(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Hair Journal
-- ---------------------------------------------------------------------------
create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort int not null default 0
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text not null default '',
  category_id uuid references public.blog_categories(id) on delete set null,
  tags text[] not null default '{}',
  featured_image_id uuid references public.media(id) on delete set null,
  gallery jsonb not null default '[]'::jsonb,
  video_url text,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  status text not null default 'draft' check (status in ('draft','review','scheduled','published')),
  published_at timestamptz,
  related_product_ids uuid[] not null default '{}',
  related_post_ids uuid[] not null default '{}',
  reading_minutes int,
  seo_title text,
  seo_description text,
  noindex boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger blog_posts_updated before update on public.blog_posts
  for each row execute function public.set_updated_at();
create index blog_posts_published_idx on public.blog_posts (status, published_at desc);

-- ---------------------------------------------------------------------------
-- Navigation menus: items = [{label, href, children:[...], highlight?, image?}]
-- ---------------------------------------------------------------------------
create table public.menus (
  key text primary key,     -- main | footer_shop | footer_care | footer_brand | footer_legal | mobile_bottom
  name text not null,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger menus_updated before update on public.menus
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Popups & announcement bar
-- ---------------------------------------------------------------------------
create table public.popups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'newsletter' check (kind in ('welcome','newsletter','exit_intent','promotion','flash_sale','free_shipping','back_in_stock','campaign')),
  title text not null,
  body text,
  image_id uuid references public.media(id) on delete set null,
  cta_label text,
  cta_href text,
  coupon_code text,
  collect_email boolean not null default true,
  trigger text not null default 'delay' check (trigger in ('delay','exit_intent','scroll','page_load')),
  delay_seconds int not null default 8,
  scroll_percent int not null default 40,
  frequency_days int not null default 7,
  audience text not null default 'all' check (audience in ('all','new_visitors','returning_visitors','guests','customers')),
  devices text[] not null default '{desktop,mobile}',
  page_paths text[] not null default '{}',   -- empty = all pages; supports prefix match e.g. '/products/*'
  starts_at timestamptz,
  ends_at timestamptz,
  style jsonb not null default '{}'::jsonb,  -- {layout:'split'|'center', background:'emerald'|'ivory', animation:'fade'|'slide'}
  is_active boolean not null default false,
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger popups_updated before update on public.popups
  for each row execute function public.set_updated_at();

alter table public.campaigns add constraint campaigns_popup_fk
  foreign key (popup_id) references public.popups(id) on delete set null;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  href text,
  background text,
  text_color text,
  starts_at timestamptz,
  ends_at timestamptz,
  dismissible boolean not null default true,
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Social gallery (curated Instagram/TikTok posts linked to products)
-- ---------------------------------------------------------------------------
create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'instagram' check (platform in ('instagram','tiktok','other')),
  media_id uuid references public.media(id) on delete set null,
  image_url text,
  permalink text,
  caption text,
  product_ids uuid[] not null default '{}',
  sort int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Consultations & custom-unit requests
-- ---------------------------------------------------------------------------
create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'consultation' check (kind in ('consultation','custom_unit','service')),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email citext not null,
  phone text,
  contact_method text check (contact_method in ('email','phone','whatsapp','instagram')),
  desired_look text,
  texture text,
  length text,
  budget text,
  configuration jsonb,             -- custom-unit configurator selections
  estimated_price bigint,
  reference_media jsonb not null default '[]'::jsonb,
  preferred_at timestamptz,
  status text not null default 'new' check (status in ('new','contacted','scheduled','in_progress','completed','cancelled')),
  scheduled_for timestamptz,
  admin_notes text,
  assigned_to uuid references auth.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger consultations_updated before update on public.consultations
  for each row execute function public.set_updated_at();

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext not null,
  phone text,
  subject text,
  message text not null,
  order_number text,
  status text not null default 'new' check (status in ('new','replied','closed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- First-party analytics events (lightweight funnel for the internal dashboard)
-- ---------------------------------------------------------------------------
create table public.analytics_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  user_id uuid,
  name text not null,        -- page_view | view_item | add_to_cart | begin_checkout | purchase | add_to_wishlist | search | select_variant | apply_coupon | newsletter_signup
  path text,
  product_id uuid,
  value bigint,
  properties jsonb,
  country text,
  device text,
  referrer text,
  created_at timestamptz not null default now()
);
create index analytics_events_created_idx on public.analytics_events (created_at desc);
create index analytics_events_name_idx on public.analytics_events (name, created_at desc);
