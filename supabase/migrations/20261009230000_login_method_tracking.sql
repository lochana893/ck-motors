alter table public.login_activity
  add column if not exists login_method text;

do $$
begin
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
