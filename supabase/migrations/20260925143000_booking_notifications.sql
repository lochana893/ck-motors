create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  booking_id uuid references public.bookings(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_created_at_idx on public.admin_notifications (created_at desc);
create index if not exists admin_notifications_unread_idx on public.admin_notifications (is_read, created_at desc);
create unique index if not exists admin_notifications_booking_type_idx
  on public.admin_notifications (booking_id, type)
  where booking_id is not null and type = 'new_booking';

alter table public.admin_notifications enable row level security;
drop policy if exists "Admins and staff can read admin notifications" on public.admin_notifications;
drop policy if exists "Admins and staff can update admin notifications" on public.admin_notifications;
create policy "Admins and staff can read admin notifications"
  on public.admin_notifications for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'));
create policy "Admins and staff can update admin notifications"
  on public.admin_notifications for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'));
create policy "Admins and staff can delete admin notifications"
  on public.admin_notifications for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'staff') and p.status = 'active'));

create or replace function public.notify_admins_of_new_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_name text;
  vehicle_label text;
  service_label text;
begin
  select coalesce(nullif(p.full_name, ''), 'Customer') into customer_name
  from public.profiles p where p.id = new.user_id;
  select trim(concat_ws(' ', nullif(v.brand, ''), nullif(v.model, ''), nullif(v.registration_number, '')))
    into vehicle_label from public.vehicles v where v.id = new.vehicle_id;
  select coalesce(nullif(new.service_name_snapshot, ''), s.name, 'Service')
    into service_label from public.services s where s.id = new.service_id;

  insert into public.admin_notifications (type, title, message, booking_id, user_id)
  values (
    'new_booking',
    'New Service Booking',
    format('New booking received from %s for %s - %s on %s at %s.', coalesce(customer_name, 'Customer'), coalesce(nullif(vehicle_label, ''), 'Vehicle'), coalesce(service_label, 'Service'), new.booking_date, new.booking_time),
    new.id,
    new.user_id
  )
  on conflict (booking_id, type) where booking_id is not null and type = 'new_booking' do nothing;
  return new;
end;
$$;

drop trigger if exists bookings_admin_notification on public.bookings;
create trigger bookings_admin_notification
after insert on public.bookings
for each row execute function public.notify_admins_of_new_booking();

create or replace function public.notify_customer_of_booking_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_label text;
  service_label text;
begin
  status_label := initcap(replace(new.status, '_', ' '));
  select coalesce(nullif(new.service_name_snapshot, ''), s.name, 'service')
    into service_label from public.services s where s.id = new.service_id;
  insert into public.notifications (user_id, booking_id, type, title, message)
  values (
    new.user_id,
    new.id,
    'booking_status',
    'Booking Status Updated',
    format('Your booking for %s has been updated to %s for %s at %s.', coalesce(service_label, 'your service'), status_label, new.booking_date, new.booking_time)
  );
  return new;
end;
$$;

drop trigger if exists bookings_customer_status_notification on public.bookings;
create trigger bookings_customer_status_notification
after update of status on public.bookings
for each row
when (old.status is distinct from new.status)
execute function public.notify_customer_of_booking_status();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_notifications'
  ) then
    alter publication supabase_realtime add table public.admin_notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
