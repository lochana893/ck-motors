# CK Motors Analytics and Login Session Fix Report

## Files changed

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/login/page.tsx`
- `src/app/api/auth/phone-login/route.ts`
- `src/app/api/analytics/route.ts`
- `src/app/api/security/login-activity/route.ts`
- `src/app/api/security/session-heartbeat/route.ts`
- `src/components/SessionHeartbeat.tsx`
- `src/components/PublicVisitCounter.tsx`
- `src/components/admin/VisitorAnalyticsSection.tsx`
- `src/components/admin/LoginActivitySection.tsx`
- `src/lib/login-activity-write.ts`
- `src/lib/login-session-client.ts`
- `src/lib/analytics-admin-auth.ts`
- `supabase/migrations/20261010001500_analytics_settings_and_login_sessions.sql`
- `CK_MOTORS_ANALYTICS_SESSION_FIX_REPORT.md`

## Current database status

Live schema metadata checks found:

- `public.analytics_settings`: missing.
- `public.login_sessions`: missing.
- `public.login_activity.role_at_login`: missing.
- Existing `login_activity` records and visitor events were not modified.

Run the single new additive migration below in Supabase before enabling the counter or session counts. It preserves existing records and does not drop, truncate, or recreate existing analytics/login tables.

## Implemented

- `analytics_settings` is created if missing and its singleton defaults to OFF. Public roles can read only `show_public_visit_count`; only an active admin has update permission. The public count API continues to return only `{ enabled: false }` or `{ enabled: true, count }`.
- The Admin counter control has distinct OFF/ON colors, remains clickable before migration, shows a Saving state, and reports the requested save error. When settings are unavailable, it also shows a setup warning. Once the migration is applied, the warning clears from the live settings check. The public footer renders `Website Visits: <count>` only when enabled. Internal analytics tracking is independent.
- A global heartbeat component creates one random UUID session key per browser tab, immediately sends an authenticated heartbeat, repeats every 60 seconds, and refreshes when the tab becomes visible.
- Heartbeats verify the Supabase user and active profile on the server, capture role/device/browser/OS and IP in the private `login_sessions` table, and do not write login activity events. The active count is based on `ended_at IS NULL` and `last_seen` within the last five minutes.
- Admin, customer dashboard, and public-site logout actions close the current tab session before normal Supabase sign-out. Abandoned sessions expire from the active count naturally after five minutes.
- Login analytics displays successful/failed totals, today’s successful and failed attempts, unique users, role totals, last successful login, and active sessions. Existing sign-in code writes `role_at_login`; history without a snapshot falls back to the current profile role without rewriting old rows. Displayed history times use Asia/Colombo.
- Role Attribution now uses the requested readable light-card colors. The old “active sessions are not reported” warning is replaced by the heartbeat definition; if the migration has not yet been applied, the active-session card explains setup is required.

## RLS and secrets

- `login_sessions` has RLS enabled and grants detailed reads only to authenticated users with an active admin profile. Anonymous users receive no table privileges.
- `analytics_settings` grants public roles a column-level read of the public-counter flag only. Admin-only update policy checks `profiles.role = 'admin'` and `profiles.status = 'active'`.
- Heartbeat and logout use server-side Supabase clients and the service-role key only on the server. The browser receives no session-table data or service-role credentials.

## Exact SQL migration to run

Run [20261010001500_analytics_settings_and_login_sessions.sql](./supabase/migrations/20261010001500_analytics_settings_and_login_sessions.sql):

```sql
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
```

## Validation

- `npx tsc --noEmit`: passed.
- Targeted ESLint for the changed analytics, authentication, and session TypeScript files: passed.
- `npm run lint`: failed on 9 existing untracked root-level installer scripts with 18 `@typescript-eslint/no-require-imports` errors. Those files were not modified.
- `npm run build`: passed.
- Focused `git diff --check` for the API, component, and session-helper changes: passed. The full-worktree check reports CRLF-style trailing whitespace across the broad existing diff of `src/app/admin/page.tsx`; it was not mass-reformatted to avoid unrelated churn.
- Local production route checks: `GET /api/public-visit-count` returned HTTP 200 with exactly `{"enabled":false}`; unauthenticated `POST /api/security/session-heartbeat` and `GET /api/security/login-activity` both returned HTTP 401. The temporary local server was stopped afterward.
- The migration was not applied to the live Supabase project during implementation. Therefore live ON/OFF persistence, real heartbeat rows, and logout row updates require running the SQL above before browser end-to-end testing. No login/session records were inserted or changed during implementation.
