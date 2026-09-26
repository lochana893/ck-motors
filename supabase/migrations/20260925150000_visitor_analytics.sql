-- Extend the existing anonymous site_analytics_events with additive, admin-only fields
-- and add a session-level aggregation table for the Visitor Analytics admin dashboard.
-- Nothing here changes existing tables destructively, existing RLS is preserved, and no
-- schema used by auth/booking/vehicle features is touched.

alter table public.site_analytics_events
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists ip_address inet,
  add column if not exists operating_system text,
  add column if not exists region text,
  add column if not exists city text;

create index if not exists site_analytics_events_session_id_idx on public.site_analytics_events (session_id);
create index if not exists site_analytics_events_user_id_idx on public.site_analytics_events (user_id);
create index if not exists site_analytics_events_ip_address_idx on public.site_analytics_events (ip_address);

create table if not exists public.visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  session_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  ip_address inet,
  device_type text,
  browser text,
  operating_system text,
  country text,
  region text,
  city text,
  referrer text,
  landing_page text,
  last_page text,
  page_views integer not null default 0,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists visitor_sessions_visitor_id_idx on public.visitor_sessions (visitor_id);
create index if not exists visitor_sessions_session_id_idx on public.visitor_sessions (session_id);
create index if not exists visitor_sessions_user_id_idx on public.visitor_sessions (user_id);
create index if not exists visitor_sessions_ip_address_idx on public.visitor_sessions (ip_address);
create index if not exists visitor_sessions_last_seen_idx on public.visitor_sessions (last_seen desc);
create index if not exists visitor_sessions_created_at_idx on public.visitor_sessions (created_at desc);

alter table public.visitor_sessions enable row level security;

drop policy if exists "Admins can read visitor sessions" on public.visitor_sessions;
create policy "Admins can read visitor sessions"
  on public.visitor_sessions for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ));

-- Small, non-sensitive singleton settings row that only stores whether the public
-- footer visit counter is enabled. Never stores raw visitor/session data, so it can
-- safely be readable by everyone; only admins may change it.
create table if not exists public.analytics_settings (
  id boolean primary key default true,
  show_public_visit_count boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint analytics_settings_singleton check (id)
);

insert into public.analytics_settings (id, show_public_visit_count)
values (true, false)
on conflict (id) do nothing;

alter table public.analytics_settings enable row level security;

drop policy if exists "Anyone can read the public counter flag" on public.analytics_settings;
create policy "Anyone can read the public counter flag"
  on public.analytics_settings for select to anon, authenticated
  using (true);

drop policy if exists "Admins can manage the public counter flag" on public.analytics_settings;
create policy "Admins can manage the public counter flag"
  on public.analytics_settings for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ));
