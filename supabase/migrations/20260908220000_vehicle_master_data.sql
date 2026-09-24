create table if not exists public.vehicle_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.vehicle_brands(id) on delete restrict,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

create table if not exists public.vehicle_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table if not exists public.fuel_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table if not exists public.transmission_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table if not exists public.engine_capacity_options (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

alter table public.vehicle_brands enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_types enable row level security;
alter table public.fuel_types enable row level security;
alter table public.transmission_types enable row level security;
alter table public.engine_capacity_options enable row level security;

create policy "Anyone can read active vehicle brands" on public.vehicle_brands for select to anon, authenticated using (is_active);
create policy "Anyone can read active vehicle models" on public.vehicle_models for select to anon, authenticated using (is_active);
create policy "Anyone can read active vehicle types" on public.vehicle_types for select to anon, authenticated using (is_active);
create policy "Anyone can read active fuel types" on public.fuel_types for select to anon, authenticated using (is_active);
create policy "Anyone can read active transmission types" on public.transmission_types for select to anon, authenticated using (is_active);
create policy "Anyone can read active engine capacities" on public.engine_capacity_options for select to anon, authenticated using (is_active);

create policy "Admins can manage vehicle brands" on public.vehicle_brands for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "Admins can manage vehicle models" on public.vehicle_models for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "Admins can manage vehicle types" on public.vehicle_types for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "Admins can manage fuel types" on public.fuel_types for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "Admins can manage transmissions" on public.transmission_types for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "Admins can manage engine capacities" on public.engine_capacity_options for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into public.vehicle_brands (name) values ('Toyota'), ('Suzuki'), ('Honda'), ('Nissan'), ('Mitsubishi'), ('Mazda'), ('BMW'), ('Mercedes-Benz'), ('Other') on conflict (name) do nothing;
insert into public.vehicle_types (name) values ('Car'), ('SUV'), ('Van'), ('Mini Van'), ('Pickup'), ('Motorcycle'), ('Other') on conflict (name) do nothing;
insert into public.fuel_types (name) values ('Petrol'), ('Diesel'), ('Hybrid'), ('Plug-in Hybrid'), ('Petrol / Hybrid'), ('Diesel / Hybrid'), ('Electric'), ('Other') on conflict (name) do nothing;
insert into public.transmission_types (name) values ('Automatic'), ('Manual'), ('CVT'), ('e-CVT'), ('Other') on conflict (name) do nothing;
insert into public.engine_capacity_options (name) values ('660 cc'), ('1000 cc'), ('1200 cc'), ('1300 cc'), ('1500 cc'), ('1800 cc'), ('2000 cc'), ('2500 cc'), ('Electric / N/A'), ('Other') on conflict (name) do nothing;

insert into public.vehicle_models (brand_id, name)
select b.id, m.name from public.vehicle_brands b cross join (values
  ('Toyota', 'Aqua'), ('Toyota', 'Prius'), ('Toyota', 'Corolla'), ('Toyota', 'Vitz'),
  ('Suzuki', 'Swift'), ('Suzuki', 'Wagon R'), ('Suzuki', 'Alto'),
  ('Honda', 'Vezel'), ('Honda', 'Fit'), ('Honda', 'Civic'),
  ('Nissan', 'March'), ('Nissan', 'X-Trail'), ('Mitsubishi', 'Montero'),
  ('Mazda', 'Demio'), ('BMW', '3 Series'), ('Mercedes-Benz', 'C-Class')
) as m(brand, name) where b.name = m.brand
on conflict (brand_id, name) do nothing;
