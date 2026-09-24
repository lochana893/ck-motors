create extension if not exists pgcrypto;

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  title text,
  caption text,
  storage_path text not null,
  image_url text not null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists gallery_active_order_idx
  on public.gallery(is_active, display_order, created_at desc);

alter table public.gallery enable row level security;

create policy "Public can read active gallery items"
  on public.gallery for select
  to anon, authenticated
  using (is_active = true);

create policy "Admins can manage gallery"
  on public.gallery for all
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

insert into storage.buckets (id, name, public)
values ('gallery-images', 'gallery-images', true)
on conflict (id) do update set public = true;

create policy "Admins can upload gallery images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'gallery-images'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Public can view gallery images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'gallery-images');

create policy "Admins can update gallery images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'gallery-images'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (bucket_id = 'gallery-images');

create policy "Admins can delete gallery images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'gallery-images'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
