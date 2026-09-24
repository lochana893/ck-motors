create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.message_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 5242880),
  created_at timestamptz not null default now()
);

create index if not exists message_recipients_user_id_idx
  on public.message_recipients(user_id, created_at desc);

create index if not exists message_attachments_message_id_idx
  on public.message_attachments(message_id);

alter table public.messages enable row level security;
alter table public.message_recipients enable row level security;
alter table public.message_attachments enable row level security;

create policy "Admins can manage messages"
  on public.messages for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Recipients can read their messages"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.message_recipients mr
    where mr.message_id = messages.id and mr.user_id = auth.uid()
  ));

create policy "Admins can manage message recipients"
  on public.message_recipients for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Recipients can read and update their receipt"
  on public.message_recipients for select to authenticated
  using (user_id = auth.uid());

create policy "Recipients can mark their receipt read"
  on public.message_recipients for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Admins can manage message attachments"
  on public.message_attachments for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Recipients can read message attachments"
  on public.message_attachments for select to authenticated
  using (exists (
    select 1
    from public.message_recipients mr
    where mr.message_id = message_attachments.message_id
      and mr.user_id = auth.uid()
  ));

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

create policy "Admins can upload message attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Authorized users can read message attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      or exists (
        select 1
        from public.message_attachments ma
        join public.message_recipients mr on mr.message_id = ma.message_id
        where ma.storage_path = storage.objects.name
          and mr.user_id = auth.uid()
      )
    )
  );

create policy "Admins can delete message attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
