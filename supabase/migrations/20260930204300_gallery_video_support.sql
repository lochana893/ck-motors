alter table public.gallery
  add column if not exists media_type text,
  add column if not exists video_url text,
  add column if not exists thumbnail_url text;

update public.gallery
set media_type = 'image'
where media_type is null;

alter table public.gallery
  alter column media_type set default 'image',
  alter column media_type set not null,
  alter column image_url drop not null,
  alter column storage_path drop not null;

alter table public.gallery
  drop constraint if exists gallery_media_type_check;

alter table public.gallery
  add constraint gallery_media_type_check
  check (media_type in ('image', 'video'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery-media',
  'gallery-media',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view gallery media" on storage.objects;
create policy "Public can view gallery media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'gallery-media');

drop policy if exists "Active staff can upload gallery media" on storage.objects;
create policy "Active staff can upload gallery media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'gallery-media'
    and public.is_active_staff()
  );

drop policy if exists "Active staff can update gallery media" on storage.objects;
create policy "Active staff can update gallery media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'gallery-media'
    and public.is_active_staff()
  )
  with check (
    bucket_id = 'gallery-media'
    and public.is_active_staff()
  );

drop policy if exists "Active staff can delete gallery media" on storage.objects;
create policy "Active staff can delete gallery media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'gallery-media'
    and public.is_active_staff()
  );

drop policy if exists "Admins and staff can manage gallery" on public.gallery;
create policy "Admins and staff can manage gallery"
  on public.gallery for all
  to authenticated
  using (public.is_active_staff())
  with check (public.is_active_staff());
