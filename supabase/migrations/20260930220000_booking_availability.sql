create table if not exists public.business_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  is_open boolean not null default true,
  opens_at time not null default '08:00',
  closes_at time not null default '18:00',
  slot_duration_minutes integer not null default 60 check (slot_duration_minutes between 15 and 240),
  max_bookings_per_slot integer not null default 3 check (max_bookings_per_slot between 1 and 100),
  constraint business_hours_time_order_check check (closes_at > opens_at)
);

insert into public.business_hours(day_of_week, is_open, opens_at, closes_at, slot_duration_minutes, max_bookings_per_slot)
select day_number, true, '08:00', '18:00', 60, 3
from generate_series(0, 6) as days(day_number)
on conflict (day_of_week) do nothing;

create table if not exists public.blocked_booking_dates (
  blocked_date date primary key,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint blocked_booking_dates_reason_length check (reason is null or length(reason) <= 250)
);

alter table public.business_hours enable row level security;
alter table public.blocked_booking_dates enable row level security;

drop policy if exists "Public can read business hours" on public.business_hours;
create policy "Public can read business hours"
  on public.business_hours for select to anon, authenticated
  using (true);

drop policy if exists "Active staff manage business hours" on public.business_hours;
create policy "Active staff manage business hours"
  on public.business_hours for all to authenticated
  using (public.is_active_staff())
  with check (public.is_active_staff());

drop policy if exists "Public can read blocked dates" on public.blocked_booking_dates;
create policy "Public can read blocked dates"
  on public.blocked_booking_dates for select to anon, authenticated
  using (true);

drop policy if exists "Active staff manage blocked dates" on public.blocked_booking_dates;
create policy "Active staff manage blocked dates"
  on public.blocked_booking_dates for all to authenticated
  using (public.is_active_staff())
  with check (public.is_active_staff());

create or replace function public.get_available_booking_slots(target_date date)
returns table(slot_time text, remaining_capacity integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    to_char(slots.slot_start, 'HH24:MI') as slot_time,
    greatest(hours.max_bookings_per_slot - count(bookings.id)::integer, 0) as remaining_capacity
  from public.business_hours hours
  cross join lateral generate_series(
    target_date + hours.opens_at,
    target_date + hours.closes_at - make_interval(mins => hours.slot_duration_minutes),
    make_interval(mins => hours.slot_duration_minutes)
  ) as slots(slot_start)
  left join public.bookings bookings
    on bookings.booking_date = target_date
    and bookings.booking_time::time = slots.slot_start::time
    and bookings.status <> 'cancelled'
  where hours.day_of_week = extract(dow from target_date)::smallint
    and hours.is_open
    and target_date >= (now() at time zone 'Asia/Colombo')::date
    and not exists (
      select 1 from public.blocked_booking_dates blocked
      where blocked.blocked_date = target_date
    )
    and (
      target_date > (now() at time zone 'Asia/Colombo')::date
      or slots.slot_start::time > (now() at time zone 'Asia/Colombo')::time
    )
  group by slots.slot_start, hours.max_bookings_per_slot
  having count(bookings.id) < hours.max_bookings_per_slot
  order by slots.slot_start;
$$;

revoke all on function public.get_available_booking_slots(date) from public;
grant execute on function public.get_available_booking_slots(date) to anon, authenticated;

create or replace function public.validate_booking_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hours public.business_hours%rowtype;
  occupied_count integer;
  booking_time_value time;
  local_now timestamp;
begin
  if tg_op = 'UPDATE'
    and new.booking_date is not distinct from old.booking_date
    and new.booking_time is not distinct from old.booking_time
  then
    if old.status <> 'cancelled' or new.status = 'cancelled' then
      return new;
    end if;
  end if;

  if new.status = 'cancelled' then
    return new;
  end if;

  booking_time_value := new.booking_time::time;
  local_now := now() at time zone 'Asia/Colombo';

  if new.booking_date < local_now::date then
    raise exception 'Bookings cannot be scheduled in the past';
  end if;

  if exists (
    select 1 from public.blocked_booking_dates blocked
    where blocked.blocked_date = new.booking_date
  ) then
    raise exception 'The selected date is unavailable';
  end if;

  select * into hours
  from public.business_hours
  where day_of_week = extract(dow from new.booking_date)::smallint
  for update;

  if not found or not hours.is_open then
    raise exception 'The workshop is closed on the selected date';
  end if;

  if booking_time_value < hours.opens_at
    or booking_time_value >= hours.closes_at
    or mod(extract(epoch from (booking_time_value - hours.opens_at))::integer, hours.slot_duration_minutes * 60) <> 0
  then
    raise exception 'The selected time is outside available booking slots';
  end if;

  if new.booking_date = local_now::date and booking_time_value <= local_now::time then
    raise exception 'The selected time is in the past';
  end if;

  select count(*) into occupied_count
  from public.bookings existing
  where existing.booking_date = new.booking_date
    and existing.booking_time::time = booking_time_value
    and existing.status <> 'cancelled'
    and existing.id is distinct from new.id;

  if occupied_count >= hours.max_bookings_per_slot then
    raise exception 'This booking slot is full. Please choose another time.';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_validate_availability on public.bookings;
create trigger bookings_validate_availability
before insert or update of booking_date, booking_time, status on public.bookings
for each row execute function public.validate_booking_availability();
