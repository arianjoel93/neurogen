do $$
begin
  create type public.population_type as enum ('patient', 'control');
exception
  when duplicate_object then null;
end $$;

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

create index if not exists patients_population_type_idx on public.patients(population_type);
create index if not exists patients_sample_code_idx on public.patients(sample_code);
create index if not exists patients_created_by_idx on public.patients(created_by);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.patients to authenticated;
grant select on table public.profiles to authenticated;
grant select, insert on table public.activity_logs to authenticated;
grant select, insert, update on table public.notifications to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.patients enable row level security;

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

notify pgrst, 'reload schema';
