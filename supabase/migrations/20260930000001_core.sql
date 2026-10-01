-- HairverGreen · 0001 · Core: extensions, helpers, RBAC, profiles, settings, audit
-- All money columns across the schema are BIGINT minor units (kobo for NGN).

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists unaccent with schema extensions;

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.slugify(v text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(v, ''))), '[^a-z0-9]+', '-', 'g'))
$$;

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
create table public.permissions (
  key text primary key,
  grp text not null,
  description text not null default ''
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- Effective permission keys for a user. super_admin implicitly holds every permission.
create or replace function public.user_permissions(uid uuid) returns setof text
language sql stable security definer set search_path = public as $$
  select p.key from public.permissions p
  where exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = uid and r.key = 'super_admin'
  )
  union
  select rp.permission_key from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  where ur.user_id = uid
$$;

create or replace function public.has_permission(perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.user_permissions(auth.uid()) k where k = perm
  )
$$;

create or replace function public.is_staff(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select uid is not null and exists (select 1 from public.user_roles where user_id = uid)
$$;

-- ---------------------------------------------------------------------------
-- Profiles & customers
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext,
  full_name text,
  phone text,
  birthday date,
  marketing_email boolean not null default false,
  marketing_sms boolean not null default false,
  notify_order_updates boolean not null default true,
  notify_promotions boolean not null default false,
  notify_restock boolean not null default true,
  preferred_currency text not null default 'NGN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- A customer record exists for every buyer (guest or registered), keyed by email.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email citext not null unique,
  full_name text,
  phone text,
  country text,
  accepts_marketing boolean not null default false,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, marketing_email)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'marketing_email')::boolean, false)
  )
  on conflict (id) do nothing;

  if new.email is not null then
    insert into public.customers (user_id, email, full_name, phone, accepts_marketing)
    values (
      new.id, new.email,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
      new.raw_user_meta_data->>'phone',
      coalesce((new.raw_user_meta_data->>'marketing_email')::boolean, false)
    )
    on conflict (email) do update set user_id = excluded.user_id,
      full_name = coalesce(public.customers.full_name, excluded.full_name);
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Settings (key/value). is_public rows are readable by the storefront.
-- ---------------------------------------------------------------------------
create table public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create trigger settings_updated before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
