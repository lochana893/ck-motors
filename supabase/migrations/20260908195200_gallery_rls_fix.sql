alter table public.gallery enable row level security;

drop policy if exists "Public can read active gallery items" on public.gallery;
drop policy if exists "Admins can manage gallery" on public.gallery;
drop policy if exists "Admins and staff can manage gallery" on public.gallery;

create policy "Public can read active gallery items"
  on public.gallery
  for select
  to anon, authenticated
  using (is_active = true);

create policy "Admins and staff can manage gallery"
  on public.gallery
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  );

drop policy if exists "Admins can upload gallery images" on storage.objects;
drop policy if exists "Admins can update gallery images" on storage.objects;
drop policy if exists "Admins can delete gallery images" on storage.objects;
drop policy if exists "Admins and staff can upload gallery images" on storage.objects;
drop policy if exists "Admins and staff can update gallery images" on storage.objects;
drop policy if exists "Admins and staff can delete gallery images" on storage.objects;
drop policy if exists "Public can view gallery images" on storage.objects;

create policy "Public can view gallery images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'gallery-images');

create policy "Admins and staff can upload gallery images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'gallery-images'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  );

create policy "Admins and staff can update gallery images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'gallery-images'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  )
  with check (bucket_id = 'gallery-images');

create policy "Admins and staff can delete gallery images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'gallery-images'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  );
