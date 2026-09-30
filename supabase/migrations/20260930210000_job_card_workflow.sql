create sequence if not exists public.job_card_number_seq;

create table if not exists public.job_cards (
  id uuid primary key default gen_random_uuid(),
  job_card_number text not null unique,
  booking_id uuid references public.bookings(id) on delete set null,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  assigned_technician_id uuid references public.technicians(id) on delete set null,
  current_mileage integer check (current_mileage is null or current_mileage >= 0),
  fuel_level text,
  customer_complaint text,
  inspection_notes text,
  requested_services text,
  estimated_completion_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'booked', 'checked_in', 'inspection', 'diagnosing', 'waiting_approval', 'repairing', 'cleaning', 'quality_check', 'ready', 'delivered', 'cancelled')),
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_cards_customer_created_idx
  on public.job_cards(customer_id, created_at desc);
create index if not exists job_cards_vehicle_created_idx
  on public.job_cards(vehicle_id, created_at desc);
create index if not exists job_cards_status_created_idx
  on public.job_cards(status, created_at desc);
create unique index if not exists job_cards_booking_unique_idx
  on public.job_cards(booking_id)
  where booking_id is not null and status <> 'cancelled';

alter table public.service_records
  add column if not exists job_card_id uuid references public.job_cards(id) on delete set null;

create unique index if not exists service_records_job_card_unique_idx
  on public.service_records(job_card_id)
  where job_card_id is not null;

create or replace function public.get_admin_workshop_summary()
returns table(
  active_jobs bigint,
  ready_vehicles bigint,
  low_stock_items bigint,
  upcoming_reminders bigint,
  overdue_reminders bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_staff() then
    raise exception 'Not authorized';
  end if;

  return query
  with latest_vehicle_service as (
    select distinct on (sr.vehicle_id)
      sr.next_service_date,
      sr.next_service_mileage,
      v.mileage
    from public.service_records sr
    join public.vehicles v on v.id = sr.vehicle_id
    where sr.next_service_date is not null or sr.next_service_mileage is not null
    order by sr.vehicle_id, sr.service_date desc, sr.created_at desc
  )
  select
    (select count(*) from public.job_cards jc where jc.status not in ('delivered', 'cancelled')),
    (select count(*) from public.job_cards jc where jc.status = 'ready'),
    (select count(*) from public.inventory_parts ip where ip.is_active and ip.quantity_in_stock <= ip.minimum_stock_level),
    (select count(*) from latest_vehicle_service reminder
      where (
        reminder.next_service_date > (now() at time zone 'Asia/Colombo')::date
        and reminder.next_service_date <= (now() at time zone 'Asia/Colombo')::date + 30
      )
      or (
        reminder.next_service_mileage is not null
        and reminder.mileage is not null
        and reminder.mileage < reminder.next_service_mileage
        and reminder.next_service_mileage - reminder.mileage <= 500
      )),
    (select count(*) from latest_vehicle_service reminder
      where reminder.next_service_date <= (now() at time zone 'Asia/Colombo')::date
        or (reminder.next_service_mileage is not null and reminder.mileage >= reminder.next_service_mileage));
end;
$$;

revoke all on function public.get_admin_workshop_summary() from public;
grant execute on function public.get_admin_workshop_summary() to authenticated;

create or replace function public.assign_job_card_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.job_card_number is null or btrim(new.job_card_number) = '' then
    new.job_card_number := 'CKM-' || to_char(current_date, 'YYYY') || '-' ||
      lpad(nextval('public.job_card_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists job_cards_assign_number on public.job_cards;
create trigger job_cards_assign_number
before insert on public.job_cards
for each row execute function public.assign_job_card_number();

drop trigger if exists job_cards_updated_at on public.job_cards;
create trigger job_cards_updated_at
before update on public.job_cards
for each row execute function public.touch_updated_at();

create table if not exists public.job_card_status_history (
  id uuid primary key default gen_random_uuid(),
  job_card_id uuid not null references public.job_cards(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists job_card_status_history_card_idx
  on public.job_card_status_history(job_card_id, created_at);

create or replace function public.record_job_card_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.job_card_status_history (
      job_card_id, previous_status, new_status, changed_by
    ) values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists job_cards_status_history on public.job_cards;
create trigger job_cards_status_history
after insert or update of status on public.job_cards
for each row execute function public.record_job_card_status_change();

create table if not exists public.service_media (
  id uuid primary key default gen_random_uuid(),
  job_card_id uuid not null references public.job_cards(id) on delete cascade,
  media_stage text not null check (media_stage in ('before', 'after')),
  media_type text not null check (media_type in ('image', 'video')),
  storage_path text not null unique,
  caption text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists service_media_job_stage_idx
  on public.service_media(job_card_id, media_stage, created_at desc);

alter table public.job_cards enable row level security;
alter table public.job_card_status_history enable row level security;
alter table public.service_media enable row level security;

drop policy if exists "Staff manage job cards" on public.job_cards;
create policy "Staff manage job cards"
  on public.job_cards for all to authenticated
  using (public.is_active_staff())
  with check (public.is_active_staff());

drop policy if exists "Customers read own job cards" on public.job_cards;
create policy "Customers read own job cards"
  on public.job_cards for select to authenticated
  using (customer_id = auth.uid());

drop policy if exists "Staff manage job card status history" on public.job_card_status_history;
create policy "Staff manage job card status history"
  on public.job_card_status_history for all to authenticated
  using (public.is_active_staff())
  with check (public.is_active_staff());

drop policy if exists "Customers read own job card status history" on public.job_card_status_history;
create policy "Customers read own job card status history"
  on public.job_card_status_history for select to authenticated
  using (
    exists (
      select 1 from public.job_cards jc
      where jc.id = job_card_id and jc.customer_id = auth.uid()
    )
  );

drop policy if exists "Staff manage service media" on public.service_media;
create policy "Staff manage service media"
  on public.service_media for all to authenticated
  using (public.is_active_staff())
  with check (
    public.is_active_staff()
    and exists (select 1 from public.job_cards jc where jc.id = job_card_id)
  );

drop policy if exists "Customers read own service media" on public.service_media;
create policy "Customers read own service media"
  on public.service_media for select to authenticated
  using (
    exists (
      select 1 from public.job_cards jc
      where jc.id = job_card_id and jc.customer_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-media',
  'service-media',
  false,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff upload service media" on storage.objects;
create policy "Staff upload service media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'service-media'
    and public.is_active_staff()
    and exists (
      select 1 from public.job_cards jc
      where name like 'job-cards/' || jc.id::text || '/%'
    )
  );

drop policy if exists "Staff delete service media" on storage.objects;
create policy "Staff delete service media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'service-media'
    and public.is_active_staff()
  );

drop policy if exists "Authorized users read service media" on storage.objects;
create policy "Authorized users read service media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'service-media'
    and (
      public.is_active_staff()
      or exists (
        select 1
        from public.service_media sm
        join public.job_cards jc on jc.id = sm.job_card_id
        where sm.storage_path = name
          and jc.customer_id = auth.uid()
      )
    )
  );
