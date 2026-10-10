alter table public.site_analytics_events
  add column if not exists visitor_type text;

alter table public.login_activity
  add column if not exists role text;

alter table public.site_analytics_events
  drop constraint if exists site_analytics_events_event_type_check;

alter table public.site_analytics_events
  add constraint site_analytics_events_event_type_check
  check (event_type in (
    'page_view',
    'service_price_opened',
    'service_phone_clicked',
    'service_whatsapp_clicked',
    'service_book_clicked',
    'service_directions_clicked',
    'service_shared',
    'callback_requested'
  ));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_analytics_events_visitor_type_check'
      and conrelid = 'public.site_analytics_events'::regclass
  ) then
    alter table public.site_analytics_events
      add constraint site_analytics_events_visitor_type_check
      check (visitor_type in ('guest', 'logged_in'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'login_activity_role_check'
      and conrelid = 'public.login_activity'::regclass
  ) then
    alter table public.login_activity
      add constraint login_activity_role_check
      check (role in ('admin', 'staff', 'customer'));
  end if;
end $$;
