create table if not exists public.website_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.website_settings enable row level security;

create policy "Public can read website settings"
  on public.website_settings for select
  to anon, authenticated
  using (true);

create policy "Admins can manage website settings"
  on public.website_settings for all
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

insert into public.website_settings (key, value)
values
  ('business_name', 'CK Motors'),
  ('tagline', 'Drive With Confidence'),
  ('business_description', 'Professional vehicle maintenance, repairs and automotive care.'),
  ('city_area', 'Sri Lanka'),
  ('hero_eyebrow', 'Drive with confidence'),
  ('hero_heading', 'Professional vehicle care, done right.'),
  ('hero_description', 'Full-service maintenance, repairs, diagnostics and detailing from a team that treats your vehicle like their own.'),
  ('primary_cta_text', 'Book a service'),
  ('secondary_cta_text', 'Explore services'),
  ('contact_heading', 'Ready for a smoother drive?'),
  ('contact_description', 'Create your customer account and schedule your next service in minutes.'),
  ('whatsapp_message', 'Hello CK Motors, I would like to inquire about a service.')
on conflict (key) do nothing;
