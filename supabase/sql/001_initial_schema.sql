-- Extensions
create extension if not exists "pgcrypto";

-- =========================
-- ROLES
-- =========================
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  label text not null,
  created_at timestamptz not null default now()
);

insert into public.roles (name, label)
values
  ('ADMIN', 'Admin'),
  ('REHBER', 'Rəhbər'),
  ('USER', 'User')
on conflict (name) do nothing;

-- =========================
-- COMPANIES
-- =========================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_number text,
  address text,
  phone text,
  email text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

-- =========================
-- DEPARTMENTS
-- =========================
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

-- =========================
-- PROFILES
-- Supabase auth.users ilə əlaqəli olacaq
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role_id uuid references public.roles(id),
  company_id uuid references public.companies(id),
  department_id uuid references public.departments(id),
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

-- =========================
-- INVENTORY CATEGORIES
-- =========================
create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

insert into public.inventory_categories (name, description)
values
  ('Kompüter avadanlığı', 'Laptop, monitor, klaviatura, mouse və digər IT avadanlıqları'),
  ('Ofis mebeli', 'Masa, stul, dolab və digər mebel avadanlıqları'),
  ('Telefon və rabitə', 'Telefon, sim kart, modem və rabitə avadanlıqları'),
  ('Nəqliyyat', 'Avtomobil və nəqliyyat vasitələri'),
  ('Texniki avadanlıq', 'Texniki və istehsalat avadanlıqları'),
  ('Digər', 'Digər əsas vəsaitlər')
on conflict do nothing;

-- =========================
-- INVENTORY ITEMS
-- =========================
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),

  inventory_code text not null unique,
  name text not null,
  description text,

  company_id uuid references public.companies(id),
  department_id uuid references public.departments(id),
  category_id uuid references public.inventory_categories(id),

  responsible_user_id uuid references public.profiles(id),
  current_location text,

  purchase_date date,
  purchase_price numeric(12,2),
  currency text not null default 'AZN',

  serial_number text,
  model text,
  brand text,

  status text not null default 'IN_STOCK',
  condition text not null default 'GOOD',

  depreciation_rate numeric(5,2),
  useful_life_months integer,

  note text,

  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- status təklifləri:
-- IN_STOCK, ASSIGNED, IN_REPAIR, LOST, WRITTEN_OFF, DISPOSED
-- condition təklifləri:
-- NEW, GOOD, NORMAL, DAMAGED, UNUSABLE

-- =========================
-- INVENTORY ASSIGNMENTS
-- Kimə təhkim olunub tarixçəsi
-- =========================
create table if not exists public.inventory_assignments (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory_items(id) on delete cascade,
  assigned_to uuid references public.profiles(id),
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  return_note text,
  status text not null default 'ACTIVE',
  note text
);

-- =========================
-- INVENTORY MOVEMENTS
-- Şirkət/departament/location transfer tarixçəsi
-- =========================
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory_items(id) on delete cascade,

  from_company_id uuid references public.companies(id),
  to_company_id uuid references public.companies(id),

  from_department_id uuid references public.departments(id),
  to_department_id uuid references public.departments(id),

  from_location text,
  to_location text,

  moved_by uuid references public.profiles(id),
  moved_at timestamptz not null default now(),
  note text
);

-- =========================
-- INVENTORY REPAIRS
-- Təmir tarixçəsi
-- =========================
create table if not exists public.inventory_repairs (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory_items(id) on delete cascade,

  repair_company text,
  repair_reason text,
  repair_cost numeric(12,2),
  currency text not null default 'AZN',

  sent_date date,
  returned_date date,

  status text not null default 'SENT',
  note text,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- =========================
-- INVENTORY FILES
-- Foto, faktura, müqavilə, akt və s.
-- =========================
create table if not exists public.inventory_files (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory_items(id) on delete cascade,
  file_type text not null default 'OTHER',
  file_name text,
  file_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- =========================
-- AUDIT LOGS
-- =========================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- =========================
-- UPDATED_AT trigger
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_inventory_items_updated_at on public.inventory_items;

create trigger trg_inventory_items_updated_at
before update on public.inventory_items
for each row
execute function public.set_updated_at();


alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.companies enable row level security;
alter table public.departments enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Authenticated can read roles" on public.roles;
create policy "Authenticated can read roles"
on public.roles
for select
to authenticated
using (true);

drop policy if exists "Authenticated can read companies" on public.companies;
create policy "Authenticated can read companies"
on public.companies
for select
to authenticated
using (true);

drop policy if exists "Authenticated can read departments" on public.departments;
create policy "Authenticated can read departments"
on public.departments
for select
to authenticated
using (true);

alter table public.inventory_categories enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists "Authenticated can read inventory categories" on public.inventory_categories;
create policy "Authenticated can read inventory categories"
on public.inventory_categories
for select
to authenticated
using (true);

drop policy if exists "Authenticated can read inventory items" on public.inventory_items;
create policy "Authenticated can read inventory items"
on public.inventory_items
for select
to authenticated
using (true);