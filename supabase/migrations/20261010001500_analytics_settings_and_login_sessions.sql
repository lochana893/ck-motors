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

revoke all on table public.analytics_settings from anon, authenticated;
grant select (show_public_visit_count) on public.analytics_settings to anon, authenticated;
grant update (show_public_visit_count, updated_at) on public.analytics_settings to authenticated;

alter table public.login_activity
  add column if not exists role_at_login text,
  add column if not exists login_method text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'login_activity_role_at_login_check'
      and conrelid = 'public.login_activity'::regclass
  ) then
    alter table public.login_activity
      add constraint login_activity_role_at_login_check
      check (role_at_login in ('admin', 'staff', 'customer'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'login_activity_login_method_check'
      and conrelid = 'public.login_activity'::regclass
  ) then
    alter table public.login_activity
      add constraint login_activity_login_method_check
      check (login_method in ('email', 'phone'));
  end if;
end $$;

create table if not exists public.login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_key text not null unique,
  role text,
  device_type text,
  browser text,
  operating_system text,
  ip_address inet,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  ended_at timestamptz null
);

create index if not exists login_sessions_user_id_idx
  on public.login_sessions (user_id);
create index if not exists login_sessions_last_seen_idx
  on public.login_sessions (last_seen desc);

alter table public.login_sessions enable row level security;

drop policy if exists "Admins can read login sessions" on public.login_sessions;
create policy "Admins can read login sessions"
  on public.login_sessions for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ));

revoke all on table public.login_sessions from anon, authenticated;
grant select on public.login_sessions to authenticated;
