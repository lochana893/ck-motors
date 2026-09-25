create table if not exists public.login_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  ip_address inet,
  user_agent text,
  device_type text not null default 'Unknown',
  browser text not null default 'Unknown',
  operating_system text not null default 'Unknown',
  country text,
  region text,
  city text,
  session_id text,
  login_status text not null check (login_status in ('success', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists login_activity_created_at_idx on public.login_activity (created_at desc);
create index if not exists login_activity_user_id_idx on public.login_activity (user_id);
create index if not exists login_activity_ip_address_idx on public.login_activity (ip_address);

alter table public.login_activity enable row level security;

drop policy if exists "Admins can read login activity" on public.login_activity;
create policy "Admins can read login activity"
  on public.login_activity for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ));

create table if not exists public.site_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('page_view')),
  page_path text not null check (char_length(page_path) between 1 and 512),
  visitor_id text not null check (char_length(visitor_id) between 16 and 128),
  session_id text,
  referrer text,
  device_type text,
  browser text,
  country text,
  created_at timestamptz not null default now()
);

create index if not exists site_analytics_events_created_at_idx on public.site_analytics_events (created_at desc);
create index if not exists site_analytics_events_page_path_idx on public.site_analytics_events (page_path);
create index if not exists site_analytics_events_visitor_id_idx on public.site_analytics_events (visitor_id);

alter table public.site_analytics_events enable row level security;

drop policy if exists "Admins can read site analytics" on public.site_analytics_events;
create policy "Admins can read site analytics"
  on public.site_analytics_events for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ));
