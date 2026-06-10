-- =====================================================
-- Smart Inventory Features
-- Health Score, QR Passport, Warranty, Lifecycle Events
-- =====================================================

-- =========================
-- INVENTORY ITEMS extra smart fields
-- =========================
alter table public.inventory_items
add column if not exists warranty_start_date date,
add column if not exists warranty_end_date date,
add column if not exists qr_token text unique,
add column if not exists health_score integer not null default 100,
add column if not exists health_status text not null default 'EXCELLENT',
add column if not exists last_health_calculated_at timestamptz;

-- health_status suggestions:
-- EXCELLENT, GOOD, WATCH, RISKY, CRITICAL

-- =========================
-- QR token generator
-- =========================
create or replace function public.generate_inventory_qr_token()
returns trigger
language plpgsql
as $$
begin
  if new.qr_token is null or new.qr_token = '' then
    new.qr_token = encode(gen_random_bytes(16), 'hex');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_generate_inventory_qr_token on public.inventory_items;

create trigger trg_generate_inventory_qr_token
before insert on public.inventory_items
for each row
execute function public.generate_inventory_qr_token();

-- Existing rows üçün qr_token yarat
update public.inventory_items
set qr_token = encode(gen_random_bytes(16), 'hex')
where qr_token is null;

-- =========================
-- SMART HEALTH SCORE FUNCTION
-- =========================
create or replace function public.calculate_inventory_health_score(
  p_purchase_date date,
  p_status text,
  p_condition text,
  p_repair_count integer,
  p_warranty_end_date date
)
returns table(score integer, status text)
language plpgsql
as $$
declare
  v_score integer := 100;
  v_age_years numeric := 0;
begin
  -- Age penalty
  if p_purchase_date is not null then
    v_age_years := extract(day from (current_date - p_purchase_date)) / 365.0;

    if v_age_years >= 7 then
      v_score := v_score - 35;
    elsif v_age_years >= 5 then
      v_score := v_score - 25;
    elsif v_age_years >= 3 then
      v_score := v_score - 12;
    elsif v_age_years >= 1 then
      v_score := v_score - 5;
    end if;
  end if;

  -- Status penalty
  if p_status = 'IN_REPAIR' then
    v_score := v_score - 20;
  elsif p_status = 'LOST' then
    v_score := v_score - 60;
  elsif p_status = 'WRITTEN_OFF' then
    v_score := v_score - 70;
  elsif p_status = 'DISPOSED' then
    v_score := v_score - 80;
  end if;

  -- Condition penalty
  if p_condition = 'DAMAGED' then
    v_score := v_score - 25;
  elsif p_condition = 'UNUSABLE' then
    v_score := v_score - 45;
  elsif p_condition = 'NORMAL' then
    v_score := v_score - 10;
  elsif p_condition = 'GOOD' then
    v_score := v_score - 3;
  end if;

  -- Repair penalty
  if coalesce(p_repair_count, 0) >= 5 then
    v_score := v_score - 25;
  elsif coalesce(p_repair_count, 0) >= 3 then
    v_score := v_score - 15;
  elsif coalesce(p_repair_count, 0) >= 1 then
    v_score := v_score - 6;
  end if;

  -- Warranty penalty
  if p_warranty_end_date is not null and p_warranty_end_date < current_date then
    v_score := v_score - 10;
  end if;

  if v_score < 0 then
    v_score := 0;
  elsif v_score > 100 then
    v_score := 100;
  end if;

  score := v_score;

  if v_score >= 85 then
    status := 'EXCELLENT';
  elsif v_score >= 70 then
    status := 'GOOD';
  elsif v_score >= 50 then
    status := 'WATCH';
  elsif v_score >= 30 then
    status := 'RISKY';
  else
    status := 'CRITICAL';
  end if;

  return next;
end;
$$;

-- =========================
-- Recalculate one inventory health
-- =========================
create or replace function public.recalculate_inventory_health(p_inventory_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_item record;
  v_repair_count integer := 0;
  v_result record;
begin
  select *
  into v_item
  from public.inventory_items
  where id = p_inventory_id;

  if not found then
    return;
  end if;

  select count(*)
  into v_repair_count
  from public.inventory_repairs
  where inventory_id = p_inventory_id;

  select *
  into v_result
  from public.calculate_inventory_health_score(
    v_item.purchase_date,
    v_item.status,
    v_item.condition,
    v_repair_count,
    v_item.warranty_end_date
  );

  update public.inventory_items
  set
    health_score = v_result.score,
    health_status = v_result.status,
    last_health_calculated_at = now()
  where id = p_inventory_id;
end;
$$;

-- =========================
-- Auto recalculate trigger on inventory update
-- =========================
create or replace function public.trigger_recalculate_inventory_health()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_inventory_health(new.id);
  return new;
end;
$$;

drop trigger if exists trg_recalculate_inventory_health_after_update on public.inventory_items;

create trigger trg_recalculate_inventory_health_after_update
after update of purchase_date, status, condition, warranty_end_date
on public.inventory_items
for each row
execute function public.trigger_recalculate_inventory_health();

-- =========================
-- Auto recalculate after repair insert/update/delete
-- =========================
create or replace function public.trigger_recalculate_inventory_health_from_repair()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_inventory_health(old.inventory_id);
    return old;
  else
    perform public.recalculate_inventory_health(new.inventory_id);
    return new;
  end if;
end;
$$;

drop trigger if exists trg_repair_recalculate_after_insert on public.inventory_repairs;
drop trigger if exists trg_repair_recalculate_after_update on public.inventory_repairs;
drop trigger if exists trg_repair_recalculate_after_delete on public.inventory_repairs;

create trigger trg_repair_recalculate_after_insert
after insert on public.inventory_repairs
for each row
execute function public.trigger_recalculate_inventory_health_from_repair();

create trigger trg_repair_recalculate_after_update
after update on public.inventory_repairs
for each row
execute function public.trigger_recalculate_inventory_health_from_repair();

create trigger trg_repair_recalculate_after_delete
after delete on public.inventory_repairs
for each row
execute function public.trigger_recalculate_inventory_health_from_repair();

-- Existing inventory health hesabla
do $$
declare
  r record;
begin
  for r in select id from public.inventory_items loop
    perform public.recalculate_inventory_health(r.id);
  end loop;
end $$;

-- =========================
-- INVENTORY LIFECYCLE EVENTS
-- Timeline üçün ümumi event cədvəli
-- =========================
create table if not exists public.inventory_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory_items(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  old_data jsonb,
  new_data jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- event_type suggestions:
-- CREATED, UPDATED, ASSIGNED, RETURNED, MOVED, REPAIR_SENT,
-- REPAIR_RETURNED, FILE_ADDED, HEALTH_CHANGED, WRITTEN_OFF

-- =========================
-- Handover confirmations
-- =========================
create table if not exists public.inventory_handover_confirmations (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory_items(id) on delete cascade,
  assignment_id uuid references public.inventory_assignments(id) on delete cascade,
  assigned_to uuid references public.profiles(id),
  requested_by uuid references public.profiles(id),
  status text not null default 'PENDING',
  note text,
  confirmed_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

-- status suggestions:
-- PENDING, ACCEPTED, REJECTED, CANCELLED

-- =========================
-- Warranty view
-- =========================
create or replace view public.inventory_warranty_alerts_view as
select
  i.id,
  i.inventory_code,
  i.name,
  i.company_id,
  c.name as company_name,
  i.category_id,
  cat.name as category_name,
  i.responsible_user_id,
  p.full_name as responsible_name,
  i.warranty_start_date,
  i.warranty_end_date,
  case
    when i.warranty_end_date is null then 'NO_WARRANTY'
    when i.warranty_end_date < current_date then 'EXPIRED'
    when i.warranty_end_date <= current_date + interval '30 days' then 'EXPIRING_30_DAYS'
    when i.warranty_end_date <= current_date + interval '60 days' then 'EXPIRING_60_DAYS'
    else 'ACTIVE'
  end as warranty_status
from public.inventory_items i
left join public.companies c on c.id = i.company_id
left join public.inventory_categories cat on cat.id = i.category_id
left join public.profiles p on p.id = i.responsible_user_id;

-- =========================
-- Risk radar view
-- =========================
create or replace view public.inventory_risk_radar_view as
select
  i.id,
  i.inventory_code,
  i.name,
  i.company_id,
  c.name as company_name,
  i.category_id,
  cat.name as category_name,
  i.status,
  i.condition,
  i.health_score,
  i.health_status,
  i.purchase_date,
  i.warranty_end_date,
  i.responsible_user_id,
  p.full_name as responsible_name,
  case
    when i.responsible_user_id is null then true
    else false
  end as is_unassigned,
  case
    when i.purchase_date is not null and i.purchase_date < current_date - interval '5 years' then true
    else false
  end as is_old_asset,
  case
    when i.warranty_end_date is not null and i.warranty_end_date < current_date then true
    else false
  end as is_warranty_expired,
  case
    when i.health_score <= 40 then true
    else false
  end as is_health_risky
from public.inventory_items i
left join public.companies c on c.id = i.company_id
left join public.inventory_categories cat on cat.id = i.category_id
left join public.profiles p on p.id = i.responsible_user_id;

-- =========================
-- RLS
-- =========================
alter table public.inventory_lifecycle_events enable row level security;
alter table public.inventory_handover_confirmations enable row level security;

drop policy if exists "Authenticated can read lifecycle events" on public.inventory_lifecycle_events;
create policy "Authenticated can read lifecycle events"
on public.inventory_lifecycle_events
for select
to authenticated
using (true);

drop policy if exists "Authenticated can read handover confirmations" on public.inventory_handover_confirmations;
create policy "Authenticated can read handover confirmations"
on public.inventory_handover_confirmations
for select
to authenticated
using (true);

drop policy if exists "Authenticated can insert handover confirmations" on public.inventory_handover_confirmations;
create policy "Authenticated can insert handover confirmations"
on public.inventory_handover_confirmations
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated can update own handover confirmations" on public.inventory_handover_confirmations;
create policy "Authenticated can update own handover confirmations"
on public.inventory_handover_confirmations
for update
to authenticated
using (assigned_to = auth.uid() or requested_by = auth.uid())
with check (assigned_to = auth.uid() or requested_by = auth.uid());


drop policy if exists "Authenticated can insert inventory items" on public.inventory_items;
create policy "Authenticated can insert inventory items"
on public.inventory_items
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated can insert inventory assignments" on public.inventory_assignments;
create policy "Authenticated can insert inventory assignments"
on public.inventory_assignments
for insert
to authenticated
with check (true);

grant insert on public.inventory_items to authenticated;
grant insert on public.inventory_assignments to authenticated;