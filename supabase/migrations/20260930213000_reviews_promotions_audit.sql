create table if not exists public.service_reviews (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid not null unique references public.service_records(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  customer_name text not null default 'Customer',
  rating integer not null check (rating between 1 and 5),
  review text not null check (length(btrim(review)) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_reviews_public_idx
  on public.service_reviews(status, created_at desc);
create index if not exists service_reviews_customer_idx
  on public.service_reviews(customer_id, created_at desc);

alter table public.service_reviews enable row level security;

drop policy if exists "Public can read approved service reviews" on public.service_reviews;

drop policy if exists "Customers can read own service reviews" on public.service_reviews;
create policy "Customers can read own service reviews"
  on public.service_reviews for select to authenticated
  using (customer_id = auth.uid());

drop policy if exists "Customers can review own completed services" on public.service_reviews;
create policy "Customers can review own completed services"
  on public.service_reviews for insert to authenticated
  with check (
    customer_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.service_records sr
      where sr.id = service_record_id
        and sr.user_id = auth.uid()
    )
  );

drop policy if exists "Active staff manage service reviews" on public.service_reviews;
create policy "Active staff manage service reviews"
  on public.service_reviews for all to authenticated
  using (public.is_active_staff())
  with check (public.is_active_staff());

create or replace function public.set_service_review_customer_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(nullif(btrim(p.full_name), ''), 'Customer')
  into new.customer_name
  from public.profiles p
  where p.id = new.customer_id;
  return new;
end;
$$;

drop trigger if exists service_reviews_customer_name on public.service_reviews;
create trigger service_reviews_customer_name
before insert or update of customer_id on public.service_reviews
for each row execute function public.set_service_review_customer_name();

create or replace view public.approved_service_reviews
with (security_barrier = true)
as
select id, customer_name, rating, review, created_at
from public.service_reviews
where status = 'approved';

grant select on public.approved_service_reviews to anon, authenticated;

drop trigger if exists service_reviews_updated_at on public.service_reviews;
create trigger service_reviews_updated_at
before update on public.service_reviews
for each row execute function public.touch_updated_at();

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  image_url text,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  cta_text text not null default 'Learn more',
  cta_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_date_order_check check (end_date >= start_date)
);

create index if not exists promotions_active_dates_idx
  on public.promotions(is_active, start_date, end_date);

alter table public.promotions enable row level security;

drop policy if exists "Public can read current promotions" on public.promotions;
create policy "Public can read current promotions"
  on public.promotions for select to anon, authenticated
  using (
    is_active = true
    and current_date between start_date and end_date
  );

drop policy if exists "Active staff manage promotions" on public.promotions;
create policy "Active staff manage promotions"
  on public.promotions for all to authenticated
  using (public.is_active_staff())
  with check (public.is_active_staff());

drop trigger if exists promotions_updated_at on public.promotions;
create trigger promotions_updated_at
before update on public.promotions
for each row execute function public.touch_updated_at();

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx
  on public.audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx
  on public.audit_logs(entity, entity_id, created_at desc);

alter table public.audit_logs enable row level security;
drop policy if exists "Active admins can read audit logs" on public.audit_logs;
create policy "Active admins can read audit logs"
  on public.audit_logs for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.status = 'active'
    )
  );

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb;
  new_row jsonb;
begin
  old_row := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_row := case when tg_op = 'DELETE' then null else to_jsonb(new) end;

  insert into public.audit_logs(actor_id, action, entity, entity_id, old_value, new_value)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(new_row->>'id', old_row->>'id'),
    old_row,
    new_row
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_audit_log on public.bookings;
create trigger bookings_audit_log
after insert or update or delete on public.bookings
for each row execute function public.write_audit_log();

drop trigger if exists job_cards_audit_log on public.job_cards;
create trigger job_cards_audit_log
after insert or update or delete on public.job_cards
for each row execute function public.write_audit_log();

drop trigger if exists service_records_audit_log on public.service_records;
create trigger service_records_audit_log
after insert or update or delete on public.service_records
for each row execute function public.write_audit_log();

drop trigger if exists inventory_parts_audit_log on public.inventory_parts;
create trigger inventory_parts_audit_log
after insert or update or delete on public.inventory_parts
for each row execute function public.write_audit_log();

drop trigger if exists service_reviews_audit_log on public.service_reviews;
create trigger service_reviews_audit_log
after insert or update or delete on public.service_reviews
for each row execute function public.write_audit_log();

drop trigger if exists promotions_audit_log on public.promotions;
create trigger promotions_audit_log
after insert or update or delete on public.promotions
for each row execute function public.write_audit_log();
