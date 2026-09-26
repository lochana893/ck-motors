-- Prevent customer-owned profile updates from changing authorization fields.
create or replace function public.is_active_staff()
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
      and role in ('admin', 'staff')
      and status = 'active'
  );
$$;

create or replace function public.prevent_profile_authorization_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id
    and not public.is_active_staff()
    and (
      new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.must_change_password is distinct from old.must_change_password
    )
  then
    raise exception 'Authorization fields can only be changed by active staff';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_authorization_changes on public.profiles;
create trigger prevent_profile_authorization_changes
before update on public.profiles
for each row execute function public.prevent_profile_authorization_changes();

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select to authenticated
  using (public.is_active_staff());

drop policy if exists "Admins can manage messages" on public.messages;
create policy "Admins can manage messages"
  on public.messages for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
  ));

drop policy if exists "Admins can manage message recipients" on public.message_recipients;
create policy "Admins can manage message recipients"
  on public.message_recipients for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
  ));

drop policy if exists "Admins can manage message attachments" on public.message_attachments;
create policy "Admins can manage message attachments"
  on public.message_attachments for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
  ));

drop policy if exists "Admins can upload message attachments" on storage.objects;
create policy "Admins can upload message attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
    )
  );

drop policy if exists "Admins can delete message attachments" on storage.objects;
create policy "Admins can delete message attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
    )
  );

drop policy if exists "Authorized users can read message attachments" on storage.objects;
create policy "Authorized users can read message attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
      )
      or exists (
        select 1
        from public.message_attachments ma
        join public.message_recipients mr on mr.message_id = ma.message_id
        where ma.storage_path = storage.objects.name
          and mr.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Admin and staff manage suppliers" on public.suppliers;
create policy "Admin and staff manage suppliers"
  on public.suppliers for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
  ));

drop policy if exists "Admin and staff manage technicians" on public.technicians;
create policy "Admin and staff manage technicians"
  on public.technicians for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
  ));

drop policy if exists "Admin and staff manage inventory" on public.inventory_parts;
create policy "Admin and staff manage inventory"
  on public.inventory_parts for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'
  ));
