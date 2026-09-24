create table if not exists public.vehicle_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.vehicle_brands(id) on delete restrict,
  name text not null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);
create table if not exists public.vehicle_types (id uuid primary key default gen_random_uuid(), name text not null unique, is_active boolean not null default true, display_order integer not null default 0, created_at timestamptz not null default now());
create table if not exists public.fuel_types (id uuid primary key default gen_random_uuid(), name text not null unique, is_active boolean not null default true, display_order integer not null default 0, created_at timestamptz not null default now());
create table if not exists public.transmission_types (id uuid primary key default gen_random_uuid(), name text not null unique, is_active boolean not null default true, display_order integer not null default 0, created_at timestamptz not null default now());
create table if not exists public.engine_capacity_options (id uuid primary key default gen_random_uuid(), name text not null unique, is_active boolean not null default true, display_order integer not null default 0, created_at timestamptz not null default now());

alter table public.vehicle_brands add column if not exists display_order integer not null default 0;
alter table public.vehicle_brands add column if not exists created_at timestamptz not null default now();
alter table public.vehicle_models add column if not exists display_order integer not null default 0;
alter table public.vehicle_models add column if not exists created_at timestamptz not null default now();
alter table public.vehicle_types add column if not exists display_order integer not null default 0;
alter table public.vehicle_types add column if not exists created_at timestamptz not null default now();
alter table public.fuel_types add column if not exists display_order integer not null default 0;
alter table public.fuel_types add column if not exists created_at timestamptz not null default now();
alter table public.transmission_types add column if not exists display_order integer not null default 0;
alter table public.transmission_types add column if not exists created_at timestamptz not null default now();
alter table public.engine_capacity_options add column if not exists display_order integer not null default 0;
alter table public.engine_capacity_options add column if not exists created_at timestamptz not null default now();

alter table public.vehicle_brands enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_types enable row level security;
alter table public.fuel_types enable row level security;
alter table public.transmission_types enable row level security;
alter table public.engine_capacity_options enable row level security;

drop policy if exists "Anyone can read active vehicle brands" on public.vehicle_brands;
drop policy if exists "Anyone can read active vehicle models" on public.vehicle_models;
drop policy if exists "Anyone can read active vehicle types" on public.vehicle_types;
drop policy if exists "Anyone can read active fuel types" on public.fuel_types;
drop policy if exists "Anyone can read active transmission types" on public.transmission_types;
drop policy if exists "Anyone can read active engine capacities" on public.engine_capacity_options;
drop policy if exists "Admins can manage vehicle brands" on public.vehicle_brands;
drop policy if exists "Admins can manage vehicle models" on public.vehicle_models;
drop policy if exists "Admins can manage vehicle types" on public.vehicle_types;
drop policy if exists "Admins can manage fuel types" on public.fuel_types;
drop policy if exists "Admins can manage transmissions" on public.transmission_types;
drop policy if exists "Admins can manage engine capacities" on public.engine_capacity_options;

create policy "Anyone can read active vehicle brands" on public.vehicle_brands for select to authenticated using (is_active);
create policy "Anyone can read active vehicle models" on public.vehicle_models for select to authenticated using (is_active);
create policy "Anyone can read active vehicle types" on public.vehicle_types for select to authenticated using (is_active);
create policy "Anyone can read active fuel types" on public.fuel_types for select to authenticated using (is_active);
create policy "Anyone can read active transmission types" on public.transmission_types for select to authenticated using (is_active);
create policy "Anyone can read active engine capacities" on public.engine_capacity_options for select to authenticated using (is_active);

create policy "Admins and staff manage vehicle brands" on public.vehicle_brands for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active'));
create policy "Admins and staff manage vehicle models" on public.vehicle_models for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active'));
create policy "Admins and staff manage vehicle types" on public.vehicle_types for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active'));
create policy "Admins and staff manage fuel types" on public.fuel_types for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active'));
create policy "Admins and staff manage transmissions" on public.transmission_types for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active'));
create policy "Admins and staff manage engine capacities" on public.engine_capacity_options for all to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','staff') and p.status = 'active'));

insert into public.vehicle_brands (name, display_order)
select name, row_number() over () from unnest(array['Toyota','Honda','Nissan','Suzuki','Mitsubishi','Mazda','Isuzu','Daihatsu','Hyundai','Kia','Bajaj','TVS','Yamaha','Hero','Tata','Mahindra','Mercedes-Benz','BMW','Audi','Volkswagen','Perodua','Proton','Micro','Ashok Leyland','Leyland','Piaggio','Other']) as x(name)
on conflict (name) do update set is_active = true;

insert into public.vehicle_types (name) select name from unnest(array['Car','Hatchback','Sedan','Station Wagon','SUV','Crossover','Jeep','Van','Mini Van','MPV','Cab','Pickup','Pickup Truck','Lorry','Truck','Bus','Three Wheeler','Motorbike','Motorcycle','Scooter','Commercial Vehicle','Other']) as x(name) on conflict (name) do update set is_active = true;
insert into public.fuel_types (name) select name from unnest(array['Petrol','Diesel','Hybrid','Plug-in Hybrid','Electric','CNG','LPG','Other']) as x(name) on conflict (name) do update set is_active = true;
insert into public.transmission_types (name) select name from unnest(array['Automatic','Manual','CVT','e-CVT','DCT','AMT','Tiptronic','Other']) as x(name) on conflict (name) do update set is_active = true;
insert into public.engine_capacity_options (name) select name from unnest(array['50 cc','100 cc','110 cc','125 cc','150 cc','200 cc','250 cc','300 cc','600 cc','660 cc','800 cc','1000 cc','1200 cc','1300 cc','1400 cc','1500 cc','1600 cc','1800 cc','2000 cc','2200 cc','2500 cc','2700 cc','2800 cc','3000 cc','3500 cc','4000 cc','Electric / N/A','Other']) as x(name) on conflict (name) do update set is_active = true;

insert into public.vehicle_models (brand_id, name)
select b.id, x.model from public.vehicle_brands b join (values
('Toyota','Aqua'),('Toyota','Prius'),('Toyota','Axio'),('Toyota','Allion'),('Toyota','Corolla'),('Toyota','Vitz'),('Toyota','Passo'),('Toyota','Yaris'),('Toyota','Raize'),('Toyota','C-HR'),('Toyota','Hilux'),('Toyota','Hiace'),('Toyota','Land Cruiser'),('Toyota','Premio'),('Toyota','Other'),
('Honda','Fit'),('Honda','Vezel'),('Honda','Grace'),('Honda','Civic'),('Honda','Accord'),('Honda','City'),('Honda','CR-V'),('Honda','Freed'),('Honda','N-WGN'),('Honda','N-Box'),('Honda','Insight'),('Honda','Other'),
('Nissan','March'),('Nissan','Sunny'),('Nissan','Wingroad'),('Nissan','X-Trail'),('Nissan','Navara'),('Nissan','Caravan'),('Nissan','Leaf'),('Nissan','Dayz'),('Nissan','Other'),
('Suzuki','Alto'),('Suzuki','Wagon R'),('Suzuki','Swift'),('Suzuki','Celerio'),('Suzuki','Every'),('Suzuki','Spacia'),('Suzuki','Jimny'),('Suzuki','Baleno'),('Suzuki','Vitara'),('Suzuki','Other'),
('Mitsubishi','Lancer'),('Mitsubishi','Outlander'),('Mitsubishi','Pajero'),('Mitsubishi','L200'),('Mitsubishi','Other'),
('Mazda','Demio'),('Mazda','Axela'),('Mazda','CX-3'),('Mazda','CX-5'),('Mazda','Carol'),('Mazda','Bongo'),('Mazda','Other'),
('Isuzu','ELF'),('Isuzu','D-Max'),('Isuzu','Forward'),('Isuzu','Other'),
('Daihatsu','Mira'),('Daihatsu','Tanto'),('Daihatsu','Hijet'),('Daihatsu','Terios'),('Daihatsu','Other'),
('Hyundai','Eon'),('Hyundai','Grand i10'),('Hyundai','Creta'),('Hyundai','Tucson'),('Hyundai','Santa Fe'),('Hyundai','Other'),
('Kia','Picanto'),('Kia','Rio'),('Kia','Sportage'),('Kia','Sorento'),('Kia','Other'),
('Bajaj','RE'),('Bajaj','Pulsar'),('Bajaj','Discover'),('Bajaj','CT100'),('Bajaj','Other'),
('TVS','King'),('TVS','Apache'),('TVS','Ntorq'),('TVS','XL100'),('TVS','Other'),
('Yamaha','FZ'),('Yamaha','Ray ZR'),('Yamaha','Saluto'),('Yamaha','Other'),
('Hero','HF Deluxe'),('Hero','Splendor'),('Hero','Passion'),('Hero','Glamour'),('Hero','Other'),
('Tata','Nano'),('Tata','Indica'),('Tata','Xenon'),('Tata','Other'),
('Mahindra','KUV100'),('Mahindra','Bolero'),('Mahindra','Scorpio'),('Mahindra','XUV500'),('Mahindra','Other'),
('Mercedes-Benz','C-Class'),('Mercedes-Benz','E-Class'),('Mercedes-Benz','S-Class'),('Mercedes-Benz','GLA'),('Mercedes-Benz','Other'),
('BMW','3 Series'),('BMW','5 Series'),('BMW','X1'),('BMW','X3'),('BMW','X5'),('BMW','Other'),
('Audi','A3'),('Audi','A4'),('Audi','A6'),('Audi','Q2'),('Audi','Q3'),('Audi','Q5'),('Audi','Other'),
('Volkswagen','Polo'),('Volkswagen','Golf'),('Volkswagen','Passat'),('Volkswagen','Tiguan'),('Volkswagen','Other'),
('Perodua','Axia'),('Perodua','Bezza'),('Perodua','Myvi'),('Perodua','Other'),
('Proton','Saga'),('Proton','Persona'),('Proton','Iriz'),('Proton','Exora'),('Proton','Other'),
('Micro','Panda'),('Micro','MX7'),('Micro','Tivoli'),('Micro','Other'),
('Ashok Leyland','Dost'),('Ashok Leyland','Comet'),('Ashok Leyland','Bus'),('Ashok Leyland','Lorry'),('Ashok Leyland','Other'),
('Leyland','Dost'),('Leyland','Comet'),('Leyland','Bus'),('Leyland','Lorry'),('Leyland','Other'),
('Piaggio','Ape'),('Piaggio','Other')
) as x(brand, model) on x.brand = b.name
on conflict (brand_id, name) do update set is_active = true;
