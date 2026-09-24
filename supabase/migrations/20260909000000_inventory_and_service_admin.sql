create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  contact_person text,
  phone text,
  whatsapp text,
  email text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  specialization text,
  status text not null default 'available' check (status in ('available', 'busy', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_parts (
  id uuid primary key default gen_random_uuid(),
  part_name text not null,
  part_number text,
  category text not null default 'Other',
  brand text,
  supplier_id uuid null references public.suppliers(id) on delete set null,
  purchase_price numeric(12,2) default 0,
  selling_price numeric(12,2) default 0,
  quantity_in_stock integer not null default 0,
  minimum_stock_level integer not null default 0,
  unit text not null default 'pcs',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_name_idx on public.suppliers (supplier_name);
create index if not exists technicians_name_idx on public.technicians (full_name);
create index if not exists inventory_parts_name_idx on public.inventory_parts (part_name);
create index if not exists inventory_parts_active_idx on public.inventory_parts (is_active, quantity_in_stock, minimum_stock_level);

alter table public.suppliers enable row level security;
alter table public.technicians enable row level security;
alter table public.inventory_parts enable row level security;

create policy "Admin and staff manage suppliers"
  on public.suppliers for all
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff')
  ));

create policy "Admin and staff manage technicians"
  on public.technicians for all
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff')
  ));

create policy "Admin and staff manage inventory"
  on public.inventory_parts for all
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff')
  ));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger suppliers_updated_at
before update on public.suppliers
for each row execute function public.touch_updated_at();

create trigger technicians_updated_at
before update on public.technicians
for each row execute function public.touch_updated_at();

create trigger inventory_parts_updated_at
before update on public.inventory_parts
for each row execute function public.touch_updated_at();
