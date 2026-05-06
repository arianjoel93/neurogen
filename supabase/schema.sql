create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('superuser', 'staff');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.population_type as enum ('patient', 'control');
exception
  when duplicate_object then null;
end $$;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role public.user_role not null default 'staff',
  status text not null default 'active' check (status in ('active', 'disabled')),
  color text not null default '#0f766e' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  population_type public.population_type not null default 'patient',
  first_name text not null,
  last_name text not null,
  age integer check (age is null or age >= 0),
  sex text,
  locality text,
  state text,
  birth_place text,
  father_birth_place text,
  mother_birth_place text,
  body_mass_index numeric,
  height numeric,
  height_unit text check (height_unit is null or height_unit in ('cm', 'm')),
  weight numeric,
  symptom_start_year integer,
  comorbidities text[] not null default '{}'::text[],
  neurological_symptoms text[] not null default '{}'::text[],
  education_level text,
  household_size integer check (household_size is null or household_size >= 0),
  room_count integer check (room_count is null or room_count >= 0),
  floor_type text,
  housing_type text,
  housing_material text,
  water_access text,
  sanitation text,
  overcrowding boolean not null default false,
  life_conditions text,
  sample_code text,
  diagnosis text,
  genetic_study text,
  family_history text,
  contact_phone text,
  clinical_notes text,
  custom_fields jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_by_name text not null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patients
  add column if not exists population_type public.population_type not null default 'patient',
  add column if not exists birth_place text,
  add column if not exists father_birth_place text,
  add column if not exists mother_birth_place text,
  add column if not exists body_mass_index numeric,
  add column if not exists height numeric,
  add column if not exists height_unit text,
  add column if not exists weight numeric,
  add column if not exists symptom_start_year integer,
  add column if not exists comorbidities text[] not null default '{}'::text[],
  add column if not exists neurological_symptoms text[] not null default '{}'::text[],
  add column if not exists education_level text,
  add column if not exists household_size integer,
  add column if not exists room_count integer,
  add column if not exists floor_type text,
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

do $$
begin
  alter table public.patients
    add constraint patients_height_unit_check check (height_unit is null or height_unit in ('cm', 'm'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.patients
    add constraint patients_contact_phone_digits_check check (contact_phone is null or contact_phone ~ '^[0-9]{10}$');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  actor_name text not null,
  actor_email text not null,
  action text not null,
  entity_type text not null check (entity_type in ('patient', 'user', 'report', 'import', 'session')),
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  actor_name text not null,
  actor_email text not null,
  title text not null,
  message text not null,
  entity_type text not null check (entity_type in ('patient', 'user', 'report', 'import', 'session')),
  entity_id uuid,
  read_by uuid[] not null default '{}'::uuid[],
  hidden_by uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  category text,
  unit text not null default 'Unidad',
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  location text,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_by_name text not null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  product_name text not null,
  product_sku text,
  movement_type text not null check (movement_type in ('entrada', 'salida', 'ajuste')),
  quantity integer not null check (quantity >= 0),
  previous_stock integer not null check (previous_stock >= 0),
  new_stock integer not null check (new_stock >= 0),
  reason text not null,
  actor_id uuid not null references public.profiles(id),
  actor_name text not null,
  actor_email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.genetic_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  genotyping text,
  relative_gene_quantification text,
  soluble_protein_levels text,
  massive_sequencing text,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_by_name text not null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patients_created_at_idx on public.patients(created_at desc);
create index if not exists patients_state_idx on public.patients(state);
create index if not exists patients_sample_code_idx on public.patients(sample_code);
create index if not exists patients_created_by_idx on public.patients(created_by);
create index if not exists patients_population_type_idx on public.patients(population_type);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_actor_id_idx on public.activity_logs(actor_id);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);
create index if not exists notifications_actor_id_idx on public.notifications(actor_id);
create index if not exists inventory_products_created_at_idx on public.inventory_products(created_at desc);
create index if not exists inventory_products_sku_idx on public.inventory_products(sku);
create index if not exists inventory_movements_created_at_idx on public.inventory_movements(created_at desc);
create index if not exists inventory_movements_product_id_idx on public.inventory_movements(product_id);
create index if not exists inventory_movements_actor_id_idx on public.inventory_movements(actor_id);
create index if not exists profiles_created_by_idx on public.profiles(created_by);
create index if not exists genetic_records_patient_id_idx on public.genetic_records(patient_id);
create index if not exists genetic_records_created_at_idx on public.genetic_records(created_at desc);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.patients to authenticated;
grant select, insert, update, delete on table public.activity_logs to authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;
grant select, insert, update, delete on table public.inventory_products to authenticated;
grant select, insert on table public.inventory_movements to authenticated;
grant select, insert, update, delete on table public.genetic_records to authenticated;
grant usage, select on all sequences in schema public to authenticated;

notify pgrst, 'reload schema';

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_patients_updated_at on public.patients;
create trigger touch_patients_updated_at
before update on public.patients
for each row execute function public.touch_updated_at();

drop trigger if exists touch_inventory_products_updated_at on public.inventory_products;
create trigger touch_inventory_products_updated_at
before update on public.inventory_products
for each row execute function public.touch_updated_at();

drop trigger if exists touch_genetic_records_updated_at on public.genetic_records;
create trigger touch_genetic_records_updated_at
before update on public.genetic_records
for each row execute function public.touch_updated_at();

create or replace function private.create_patient_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    actor_id,
    actor_name,
    actor_email,
    title,
    message,
    entity_type,
    entity_id
  )
  values (
    new.created_by,
    new.created_by_name,
    new.created_by_email,
    'Nuevo paciente registrado',
    new.created_by_name || ' registro a ' || new.first_name || ' ' || new.last_name || ' (' || coalesce(new.state, 'Sin Estado') || ').',
    'patient',
    new.id
  );

  return new;
end;
$$;

drop trigger if exists notify_patient_created on public.patients;
create trigger notify_patient_created
after insert on public.patients
for each row execute function private.create_patient_notification();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status, color)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case
      when lower(new.email) = 'joeltrincadov@gmail.com' then 'superuser'::public.user_role
      else coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'staff'::public.user_role)
    end,
    'active',
    coalesce(new.raw_user_meta_data->>'color', '#0f766e')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        color = excluded.color,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function private.is_superuser()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'superuser'
      and status = 'active'
  );
$$;

revoke execute on function private.handle_new_user() from public;
revoke execute on function private.create_patient_notification() from public;
revoke execute on function private.is_active_user() from public;
revoke execute on function private.is_superuser() from public;
revoke execute on function private.create_patient_notification() from authenticated;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_superuser() to authenticated;

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.inventory_products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.genetic_records enable row level security;

drop policy if exists "profiles_select_own_or_superuser" on public.profiles;
create policy "profiles_select_own_or_superuser"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or (select private.is_superuser()));

drop policy if exists "profiles_insert_superuser" on public.profiles;
create policy "profiles_insert_superuser"
on public.profiles
for insert
to authenticated
with check ((select private.is_superuser()));

drop policy if exists "profiles_update_superuser" on public.profiles;
create policy "profiles_update_superuser"
on public.profiles
for update
to authenticated
using ((select private.is_superuser()))
with check ((select private.is_superuser()));

drop policy if exists "patients_select_active_users" on public.patients;
create policy "patients_select_active_users"
on public.patients
for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists "patients_insert_active_users" on public.patients;
create policy "patients_insert_active_users"
on public.patients
for insert
to authenticated
with check ((select private.is_active_user()) and created_by = (select auth.uid()));

drop policy if exists "patients_update_superuser_or_creator" on public.patients;
create policy "patients_update_superuser_or_creator"
on public.patients
for update
to authenticated
using ((select private.is_superuser()) or created_by = (select auth.uid()))
with check ((select private.is_superuser()) or created_by = (select auth.uid()));

drop policy if exists "patients_delete_superuser" on public.patients;
create policy "patients_delete_superuser"
on public.patients
for delete
to authenticated
using ((select private.is_superuser()));

drop policy if exists "activity_logs_select_active_users" on public.activity_logs;
create policy "activity_logs_select_active_users"
on public.activity_logs
for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists "activity_logs_insert_active_users" on public.activity_logs;
create policy "activity_logs_insert_active_users"
on public.activity_logs
for insert
to authenticated
with check ((select private.is_active_user()) and actor_id = (select auth.uid()));

drop policy if exists "notifications_select_active_users" on public.notifications;
create policy "notifications_select_active_users"
on public.notifications
for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists "notifications_insert_active_users" on public.notifications;
create policy "notifications_insert_active_users"
on public.notifications
for insert
to authenticated
with check ((select private.is_active_user()) and actor_id = (select auth.uid()));

drop policy if exists "notifications_update_active_users" on public.notifications;
create policy "notifications_update_active_users"
on public.notifications
for update
to authenticated
using ((select private.is_active_user()))
with check ((select private.is_active_user()));

drop policy if exists "inventory_products_select_active_users" on public.inventory_products;
create policy "inventory_products_select_active_users"
on public.inventory_products
for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists "inventory_products_insert_active_users" on public.inventory_products;
create policy "inventory_products_insert_active_users"
on public.inventory_products
for insert
to authenticated
with check ((select private.is_active_user()) and created_by = (select auth.uid()));

drop policy if exists "inventory_products_update_active_users" on public.inventory_products;
create policy "inventory_products_update_active_users"
on public.inventory_products
for update
to authenticated
using ((select private.is_active_user()))
with check ((select private.is_active_user()));

drop policy if exists "inventory_products_delete_superuser" on public.inventory_products;
create policy "inventory_products_delete_superuser"
on public.inventory_products
for delete
to authenticated
using ((select private.is_superuser()));

drop policy if exists "inventory_movements_select_active_users" on public.inventory_movements;
create policy "inventory_movements_select_active_users"
on public.inventory_movements
for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists "inventory_movements_insert_active_users" on public.inventory_movements;
create policy "inventory_movements_insert_active_users"
on public.inventory_movements
for insert
to authenticated
with check ((select private.is_active_user()) and actor_id = (select auth.uid()));

drop policy if exists "genetic_records_select_active_users" on public.genetic_records;
create policy "genetic_records_select_active_users"
on public.genetic_records
for select
to authenticated
using ((select private.is_active_user()));

drop policy if exists "genetic_records_insert_active_users" on public.genetic_records;
create policy "genetic_records_insert_active_users"
on public.genetic_records
for insert
to authenticated
with check ((select private.is_active_user()) and created_by = (select auth.uid()));

drop policy if exists "genetic_records_update_superuser_or_creator" on public.genetic_records;
create policy "genetic_records_update_superuser_or_creator"
on public.genetic_records
for update
to authenticated
using ((select private.is_superuser()) or created_by = (select auth.uid()))
with check ((select private.is_superuser()) or created_by = (select auth.uid()));

drop policy if exists "genetic_records_delete_superuser" on public.genetic_records;
create policy "genetic_records_delete_superuser"
on public.genetic_records
for delete
to authenticated
using ((select private.is_superuser()));

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.inventory_products;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.inventory_movements;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.genetic_records;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

drop function if exists public.handle_new_user();
drop function if exists public.is_active_user();
drop function if exists public.is_superuser();
