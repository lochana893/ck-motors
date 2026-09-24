alter table public.profiles
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists postal_code text,
  add column if not exists must_change_password boolean not null default false;

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update their own profile'
  ) then
    execute $policy$
      create policy "Users can update their own profile"
        on public.profiles
        for update
        to authenticated
        using (id = auth.uid())
        with check (id = auth.uid())
    $policy$;
  end if;
end
$$;
