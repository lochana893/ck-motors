alter table public.gallery
  add column if not exists title text,
  add column if not exists caption text,
  add column if not exists storage_path text,
  add column if not exists image_url text,
  add column if not exists is_active boolean not null default true,
  add column if not exists display_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

alter table public.gallery enable row level security;

drop policy if exists "Public can read active gallery items" on public.gallery;
drop policy if exists "Admins can manage gallery" on public.gallery;
drop policy if exists "Admins and staff can manage gallery" on public.gallery;

create policy "Public can read active gallery items"
  on public.gallery for select
  to anon, authenticated
  using (is_active = true);

create policy "Admins and staff can manage gallery"
  on public.gallery for all
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff')
  ));
