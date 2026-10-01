-- Additive support for the public Service Contact popup: popular/recommended
-- service badges, a callback-request inbox, and analytics columns for the new
-- contact events. Nothing here alters existing tables destructively, existing
-- RLS stays intact, and no schema used by auth/booking/vehicle features changes.

alter table public.services
  add column if not exists is_popular boolean not null default false,
  add column if not exists is_recommended boolean not null default false;

create table if not exists public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  service_id uuid references public.services(id) on delete set null,
  service_name text,
  preferred_call_time text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null,
  constraint callback_requests_customer_name_length check (char_length(customer_name) between 1 and 150),
  constraint callback_requests_phone_length check (char_length(phone) between 5 and 30)
);

create index if not exists callback_requests_status_idx on public.callback_requests (status);
create index if not exists callback_requests_created_at_idx on public.callback_requests (created_at desc);

alter table public.callback_requests enable row level security;

-- Public visitors may only insert a fresh, unhandled request; they can never
-- read back any callback records (their own or anyone else's).
drop policy if exists "Anyone can request a callback" on public.callback_requests;
create policy "Anyone can request a callback"
  on public.callback_requests for insert to anon, authenticated
  with check (status = 'new' and handled_at is null and handled_by is null);

drop policy if exists "Active staff view callback requests" on public.callback_requests;
create policy "Active staff view callback requests"
  on public.callback_requests for select to authenticated
  using (public.is_active_staff());

drop policy if exists "Active staff update callback requests" on public.callback_requests;
create policy "Active staff update callback requests"
  on public.callback_requests for update to authenticated
  using (public.is_active_staff())
  with check (public.is_active_staff());

alter table public.site_analytics_events
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists service_name text;

create index if not exists site_analytics_events_event_type_idx on public.site_analytics_events (event_type);
create index if not exists site_analytics_events_service_id_idx on public.site_analytics_events (service_id);
