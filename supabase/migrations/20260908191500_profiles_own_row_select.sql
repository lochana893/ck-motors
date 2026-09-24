alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can read their own profile'
  ) then
    execute $policy$
      create policy "Users can read their own profile"
        on public.profiles
        for select
        to authenticated
        using (id = auth.uid())
    $policy$;
  end if;
end
$$;
